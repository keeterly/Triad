#!/usr/bin/env python3
"""Cut a generated figure off its white backdrop, without eating the figure.

  python3 cutout.py in.png out.webp --height 720

WHY THIS IS NOT A THRESHOLD. The obvious key — "every pixel brighter than X is
background" — works fine for a charcoal foe and destroys a white-robed one. The
oracle's robe highlights measure the SAME VALUE as the backdrop she is standing
on (3119 interior samples at min-channel 250 or above, against a backdrop of
253), so a global threshold punches holes straight through her.

What separates them is not brightness, it is CONNECTION. The backdrop touches
the frame edge; her robes do not. So the fill starts at the border and spreads
only through pixels that are both bright and reachable from outside, and
anything enclosed by the figure survives however white it is.

The soft edge is then applied ONLY in a narrow band along the boundary that fill
found, for the same reason: a brightness ramp applied everywhere would fade the
robes back out again.
"""
import argparse, os, sys
from collections import deque
from PIL import Image


def cut(im, lo=244, band=2):
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()
    bright = [False] * (w * h)
    for y in range(h):
        base = y * w
        for x in range(w):
            r, g, b = px[x, y]
            # min-channel: a coloured pixel is never backdrop, however light
            bright[base + x] = min(r, g, b) >= lo

    bg = [False] * (w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if bright[i] and not bg[i]:
                bg[i] = True; q.append(i)
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if bright[i] and not bg[i]:
                bg[i] = True; q.append(i)
    while q:
        i = q.popleft()
        iy, ix = divmod(i, w)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = ix + dx, iy + dy
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if bright[j] and not bg[j]:
                    bg[j] = True; q.append(j)

    out = Image.new("RGBA", (w, h))
    op = out.load()
    # the boundary band: foreground pixels within `band` of anything the fill
    # reached. Only here does brightness soften the edge.
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if bg[i]:
                op[x, y] = px[x, y] + (0,)
                continue
            near = False
            for dy in range(-band, band + 1):
                for dx in range(-band, band + 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and bg[ny * w + nx]:
                        near = True; break
                if near: break
            if not near:
                op[x, y] = px[x, y] + (255,)
            else:
                v = min(px[x, y])
                a = 255 if v <= lo - 14 else int(255 * (lo - v) / 14.0)
                op[x, y] = px[x, y] + (max(0, min(255, a)),)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--height", type=int, default=720, help="output height in px")
    ap.add_argument("--lo", type=int, default=244, help="backdrop min-channel floor")
    ap.add_argument("--q", type=int, default=88)
    a = ap.parse_args(argv)

    im = cut(Image.open(a.src), a.lo)
    box = im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if box:
        im = im.crop(box)
    k = a.height / im.height
    im = im.resize((max(1, round(im.width * k)), a.height), Image.LANCZOS)
    im.save(a.out, "WEBP", quality=a.q, method=6)
    print("wrote %s  %dx%d  %d bytes" % (a.out, im.width, im.height, os.path.getsize(a.out)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
