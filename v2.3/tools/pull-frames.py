#!/usr/bin/env python3
"""Pull animation frames out of a generated video clip, cut off its backdrop.

The pose-by-pose route does not work for an animation sheet.  A still model
handed a strong character reference reproduces the reference's POSE, so every
"act" comes back as the idle; loosen the reference enough to get a new pose and
it stops being the same character.  Identity and motion pull against each other
and the still model can only hold one of them.

A video model holds both by construction: one clip, one figure, every frame the
same painting of her.  So the sheet is CUT OUT OF A CLIP.  The clip is shot on
a flat white void with a locked-off camera, which is what makes the frames
compositable — white keys cleanly off charcoal and bone, and a still camera
means the figure lands in the same place every frame.

  python3 pull-frames.py clip.mp4 --strip strip.png         # contact sheet, pick times
  python3 pull-frames.py clip.mp4 --at idle:0.42 --out frames/
  python3 pull-frames.py clip.mp4 --sheet out.webp --at idle:0.05 idle:0.20 ...

`--strip` writes a labelled filmstrip so the states can be chosen by eye; `--at`
then cuts those exact instants as keyed RGBA PNGs; `--sheet` packs them into a
uniform grid and prints the descriptor to paste into game.js.

WHY A UNIFORM GRID, and not build-anim-sheet.py's packing. That tool trims every
frame to its OWN bounding box and re-seats it on a baseline, which is right for
poses generated one image at a time, each arriving in arbitrary framing. It is
wrong here. These frames come off a locked-off camera, so the figure's drift
WITHIN the frame is the animation — the hover, the sway, the robes carrying past
the body. Trim each frame separately and every one of them gets re-centred on
itself, which subtracts exactly the motion the clip was generated for. So one
crop, computed across the whole set, is shared by every cell.
"""
import argparse, os, subprocess, sys
from PIL import Image

def ffmpeg_exe():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"

def probe_duration(path):
    out = subprocess.run([ffmpeg_exe(), "-i", path], capture_output=True, text=True).stderr
    for line in out.splitlines():
        if "Duration:" in line:
            hms = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = hms.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    return None

def grab(path, t):
    """One frame at time `t`, as RGB. -accurate_seek before -i, so the time is real."""
    cmd = [ffmpeg_exe(), "-accurate_seek", "-ss", "%.3f" % t, "-i", path,
           "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0 or not r.stdout:
        raise SystemExit("ffmpeg could not read a frame at %.3fs\n%s"
                         % (t, r.stderr.decode()[-500:]))
    import io
    return Image.open(io.BytesIO(r.stdout)).convert("RGB")

# ── keying ───────────────────────────────────────────────────────────────────
# The clip's void is white, but a CODEC's white is not 255 everywhere: it rings
# around every dark edge and drifts a few levels across a flat field.  So the
# key is a RAMP rather than a threshold — fully transparent above `hi`, fully
# opaque below `lo`, graded between — which is also what keeps the Regent's
# bone-white robe ribbons, whose value sits well under the void's.
# `floor` is the other half of the job. A codec lays faint horizontal banding
# across a flat white field, a level or two off pure — invisible to the eye, but
# nonzero alpha under a ramp, and nonzero alpha is what a trim measures. Left in,
# those streaks span the frame and every frame's bounding box becomes the whole
# frame, so the scale normaliser sees a figure that never changes size. Anything
# fainter than the floor is void.
def key_white(im, lo=232, hi=250, floor=40):
    px = im.load()
    w, h = im.size
    out = Image.new("RGBA", (w, h))
    op = out.load()
    span = float(max(1, hi - lo))
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            v = min(r, g, b)                     # a coloured pixel is never void
            if v >= hi:
                op[x, y] = (r, g, b, 0)
            elif v <= lo:
                op[x, y] = (r, g, b, 255)
            else:
                a = int(255 * (hi - v) / span)
                op[x, y] = (r, g, b, a if a >= floor else 0)
    return out

# ── the sheet ────────────────────────────────────────────────────────────────
def build_sheet(frames, out, cell_w, cols, quality=78, alpha_quality=60):
    """Pack keyed frames into a uniform grid and describe it.

    `frames` is [(state, image)] in play order. Every cell is the same size and
    carries the same crop, so the runtime paints a frame with nothing but a
    background-position step — no per-frame rects, no atlas to keep in sync with
    the art, and no way for the two to drift apart.
    """
    boxes = [f.getchannel("A").getbbox() for _, f in frames]
    boxes = [b for b in boxes if b]
    if not boxes:
        raise SystemExit("every frame keyed to nothing — check the clip's backdrop")
    union = (min(b[0] for b in boxes), min(b[1] for b in boxes),
             max(b[2] for b in boxes), max(b[3] for b in boxes))
    # a hair of margin, so nothing in the set sits flush against a cell edge
    # where the drop shadow and the reflection would clip it
    pad = int(round(0.02 * max(union[2] - union[0], union[3] - union[1])))
    W, H = frames[0][1].size
    union = (max(0, union[0] - pad), max(0, union[1] - pad),
             min(W, union[2] + pad), min(H, union[3] + pad))
    uw, uh = union[2] - union[0], union[3] - union[1]
    cell_h = max(1, int(round(cell_w * uh / uw)))
    cells = [f.crop(union).resize((cell_w, cell_h), Image.LANCZOS) for _, f in frames]

    # HOW TALL THE CREATURE STANDS INSIDE ITS CELL. The cell carries margin the
    # painted plate does not — the acts reach further than the idle, and every
    # clip framed the character a little differently — so a layer sized to the
    # box would swap the plate for a visibly smaller creature. The runtime sizes
    # the layer by the FIGURE instead, and this is the number it needs. Median,
    # not max: one frame with the staff flung out of frame should not shrink
    # every other frame to accommodate it.
    heights = []
    for c in cells:
        bb = c.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
        if bb:
            heights.append(bb[3] - bb[1])
    heights.sort()
    fig_h = heights[len(heights) // 2] if heights else cell_h

    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGBA", (cell_w * cols, cell_h * rows), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        sheet.paste(c, ((i % cols) * cell_w, (i // cols) * cell_h))
    # THE ALPHA IS THE COST, not the colour. Dropping WebP `quality` from 82 to 66
    # saves 12% because most of the file is the cutout mask, not the painting.
    # `alpha_quality` is the lever that matters: at 60 it takes 30% off, for a
    # mean error of 1.9/255 along the soft edge where the hair and ribbons live
    # (max 10) — measured, not guessed, because that fringe is the one place a
    # cutout can visibly break.
    sheet.save(out, "WEBP", quality=quality, alpha_quality=alpha_quality, method=6)

    states, order = {}, []
    for i, (state, _) in enumerate(frames):
        if state not in states:
            states[state] = []
            order.append(state)
        states[state].append(i)
    print("wrote %s  %dx%d  %d bytes  (%d frames, %dx%d grid, cell %dx%d)"
          % (out, sheet.width, sheet.height, os.path.getsize(out),
             len(cells), cols, rows, cell_w, cell_h))
    print("\nconst FOE_SHEET_<NAME> = {")
    print("  cols: %d, rows: %d, cellW: %d, cellH: %d, figH: %d,"
          % (cols, rows, cell_w, cell_h, fig_h))
    print("  states: { %s }," % ", ".join(
        "%s: [%s]" % (st, ", ".join(str(i) for i in states[st])) for st in order))
    print("};")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("clip")
    ap.add_argument("--strip", help="write a labelled contact sheet here and stop")
    ap.add_argument("--n", type=int, default=24, help="frames in the contact sheet")
    ap.add_argument("--at", nargs="+", default=[], metavar="STATE[:CLIP]:SECONDS",
                    help="cut these instants; CLIP names a --clip key, else the positional clip")
    ap.add_argument("--clip", action="append", default=[], dest="clips",
                    metavar="KEY=PATH",
                    help="another source clip, addressable as KEY in --at")
    ap.add_argument("--out", default="frames", help="directory for --at output")
    ap.add_argument("--sheet", help="pack the --at frames into this grid sheet instead")
    ap.add_argument("--cell", type=int, default=380, help="cell width in the sheet")
    ap.add_argument("--cols", type=int, default=6, help="cells per row")
    ap.add_argument("--q", type=int, default=78, help="WebP quality")
    ap.add_argument("--aq", type=int, default=60, help="WebP alpha quality")
    ap.add_argument("--raw", action="store_true", help="skip keying (debug)")
    a = ap.parse_args(argv)

    dur = probe_duration(a.clip)
    if dur is None:
        raise SystemExit("could not read the clip's duration")

    if a.strip:
        from PIL import ImageDraw
        # sample INSIDE the clip, never the very first or last frame: the first
        # is the source still (no motion yet) and the last is often a fade.
        times = [dur * (i + 0.5) / a.n for i in range(a.n)]
        W = 240
        ims = []
        for t in times:
            im = grab(a.clip, t)
            ims.append((t, im.resize((W, int(im.height * W / im.width)), Image.LANCZOS)))
        cols = 6
        rows = (len(ims) + cols - 1) // cols
        ch = ims[0][1].height + 16
        sheet = Image.new("RGB", (W * cols, ch * rows), (255, 255, 255))
        d = ImageDraw.Draw(sheet)
        for i, (t, im) in enumerate(ims):
            x, y = (i % cols) * W, (i // cols) * ch
            sheet.paste(im, (x, y + 16))
            d.rectangle([x, y, x + W - 1, y + ch - 1], outline=(190, 190, 190))
            d.text((x + 5, y + 3), "%.2fs" % t, fill=(0, 0, 0))
        sheet.save(a.strip)
        print("wrote %s  %d frames over %.2fs" % (a.strip, a.n, dur))
        return 0

    if not a.at:
        print("nothing to do: pass --strip to look, or --at to cut", file=sys.stderr)
        return 2
    # ONE SHEET, SEVERAL CLIPS. A foe's states do not come from one recording —
    # the idle is its own clip and every act is another — and they have to land in
    # ONE sheet, because the shared crop that keeps the character at a constant
    # size across states can only be computed over all of them together.
    extra = {}
    for m in a.clips:
        k, _, v = m.partition("=")
        if not v:
            raise SystemExit("bad --clip (want KEY=PATH): " + m)
        extra[k] = v

    cut = []
    for spec in a.at:
        bits = spec.split(":")
        if len(bits) == 2:
            state, src, ts = bits[0], a.clip, bits[1]
        elif len(bits) == 3:
            state, key, ts = bits
            if key not in extra:
                raise SystemExit("no --clip named %r (have: %s)"
                                 % (key, ", ".join(sorted(extra)) or "none"))
            src = extra[key]
        else:
            raise SystemExit("bad spec (want state:seconds or state:clip:seconds): " + spec)
        t = float(ts)
        im = grab(src, t)
        if not a.raw:
            im = key_white(im)
        cut.append((state, t, im))

    if a.sheet:
        build_sheet([(st, im) for st, _, im in cut], a.sheet, a.cell, a.cols, a.q, a.aq)
        return 0

    os.makedirs(a.out, exist_ok=True)
    seen = {}
    for state, t, im in cut:
        n = seen.get(state, 0)
        seen[state] = n + 1
        p = os.path.join(a.out, "%s%d.png" % (state, n))
        im.save(p)
        print("%-10s %6.2fs  ->  %s" % (state, t, p))
    return 0

if __name__ == "__main__":
    sys.exit(main())
