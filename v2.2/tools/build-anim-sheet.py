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
        state, _, src = spec.partition(":")
        if not src:
            print("bad spec (want state:source): " + spec, file=sys.stderr)
            return 2
        fig = trim(key_out(load(src)))
        # ONE scale for every frame: normalise on height so a wide attack
        # sweep and a narrow idle read at the same character size.
        k = REF_H / fig.height
        fig = fig.resize((max(1, round(fig.width * k)), REF_H), Image.LANCZOS)
        states.setdefault(state, []).append(fig)

    frames = [(s, f) for s, fs in states.items() for f in fs]
    rows = [frames[i:i + COLS] for i in range(0, len(frames), COLS)]
    sheet_w = max(sum(f.width + PAD for _, f in r) + PAD for r in rows)
    sheet_h = len(rows) * (REF_H + PAD) + PAD
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    atlas, y = OrderedDict(), PAD
    for row in rows:
        x = PAD
        for state, f in row:
            sheet.paste(f, (x, y))
            atlas.setdefault(state, []).append([x, y, f.width, f.height])
            x += f.width + PAD
        y += REF_H + PAD

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
