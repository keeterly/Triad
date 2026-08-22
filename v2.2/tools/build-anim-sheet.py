#!/usr/bin/env python3
"""Compose a KIZUNA animation sheet from a set of per-pose source images.

Takes pose images (one figure each, flat background or already transparent),
keys out the flat background, alpha-trims each figure, normalises every frame
to ONE scale with feet on a common baseline, packs them into a single sheet,
and prints the FOE_ANIM_ATLAS-shaped rect table to paste into game.js.

The paint math in game.js scales every frame by `boxH / 230`, so frames are
normalised to a 230px-tall reference here and the sheet is authored at that
same scale.  One scale for every frame keeps the character the same size on a
narrow idle cell and a wide attack sweep alike.

  python3 build-anim-sheet.py out.webp idle:a.png idle:b.png attack:c.png ...

States are emitted in the order first seen; frames within a state in the order
given.  Sources may be local paths or http(s) URLs.

A frame may carry a height factor -- `death:kneel.png@0.78` -- which is what it
measures against the FIRST frame's standing height.  Without it every pose is
stretched to the same height, so a kneeling figure stands as tall as a walking
one and a raised sword shrinks the body holding it.
"""
import sys, os, json, io, urllib.request
from collections import OrderedDict
from PIL import Image

REF_H   = 230     # the reference figure height game.js normalises against
PAD     = 8       # transparent gutter between cells, so neighbours never bleed
COLS    = 5       # cells per row
BG_TOL  = 26      # how close to the corner colour still counts as background


def load(src):
    if src.startswith("http://") or src.startswith("https://"):
        with urllib.request.urlopen(src, timeout=60) as r:
            return Image.open(io.BytesIO(r.read())).convert("RGBA")
    return Image.open(src).convert("RGBA")


def key_out(im):
    """Flat-background keying. No-op when the source already carries alpha."""
    if im.getchannel("A").getextrema()[0] < 255:
        return im                                  # already cut out
    px = im.load()
    w, h = im.size
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    out = im.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if abs(r - bg[0]) < BG_TOL and abs(g - bg[1]) < BG_TOL and abs(b - bg[2]) < BG_TOL:
                op[x, y] = (r, g, b, 0)
    return out


def trim(im):
    box = im.getchannel("A").getbbox()
    return im.crop(box) if box else im


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    out_path, specs = argv[1], argv[2:]

    states = OrderedDict()
    for spec in specs:
        head, _, src = spec.partition(":")
        if not src:
            print("bad spec (want state:source[@factor]): " + spec, file=sys.stderr)
            return 2
        src, _, fac = src.partition("@")
        factor = float(fac) if fac else 1.0
        fig = trim(key_out(load(src)))
        # Each frame is normalised against the reference height it is DECLARED
        # to occupy, not stretched to fill one cell. That keeps the character
        # one size across the set while a kneel stays low and a raised blade
        # reaches above the standing silhouette.
        h = max(1, round(REF_H * factor))
        k = h / fig.height
        fig = fig.resize((max(1, round(fig.width * k)), h), Image.LANCZOS)
        states.setdefault(head, []).append(fig)

    frames = [(s, f) for s, fs in states.items() for f in fs]
    rows = [frames[i:i + COLS] for i in range(0, len(frames), COLS)]
    row_h = [max(f.height for _, f in r) for r in rows]
    sheet_w = max(sum(f.width + PAD for _, f in r) + PAD for r in rows)
    sheet_h = sum(rh + PAD for rh in row_h) + PAD
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    atlas, y = OrderedDict(), PAD
    for row, rh in zip(rows, row_h):
        x = PAD
        for state, f in row:
            # sit every frame on the row's baseline so feet line up
            fy = y + rh - f.height
            sheet.paste(f, (x, fy))
            atlas.setdefault(state, []).append([x, fy, f.width, f.height])
            x += f.width + PAD
        y += rh + PAD

    sheet.save(out_path, "WEBP", quality=88, method=6, lossless=False)
    print("wrote %s  %dx%d  %d bytes" % (out_path, sheet_w, sheet_h, os.path.getsize(out_path)))
    print("\nconst HERO_ANIM_SHEET = { w: %d, h: %d };" % (sheet_w, sheet_h))
    print("const HERO_ANIM_ATLAS = {")
    for state, rects in atlas.items():
        print("  %-9s [%s]," % (state + ":", ",".join(json.dumps(r) for r in rects)))
    print("};")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
