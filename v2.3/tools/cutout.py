#!/usr/bin/env python3
"""Cut a generated figure off its white backdrop, without eating the figure.

  python3 cutout.py in.png out.webp --height 720

There are three separate problems here and each one has bitten this project.

1. A PLAIN THRESHOLD DESTROYS A PALE CHARACTER. "Everything brighter than X is
   backdrop" works on a charcoal foe and punches holes straight through a
   white-robed oracle, whose robe highlights measure the SAME VALUE as the
   backdrop she stands on (3119 interior samples at min-channel 250+, on a 253
   field). What separates figure from field is not brightness, it is CONNECTION:
   the backdrop touches the frame edge and her robes do not. So the fill starts
   at the border.

2. BUT A CONNECTED FILL LEAVES THE POCKETS. Backdrop showing through the holes
   in a filigree staff head, between a cloak and a body, around a raised blade,
   is never reachable from the border, so it survives as solid opaque white —
   thousands of pixels of it. Those pockets are recognisable without any
   reference to size or position: the backdrop is FLAT, and paint is not. Every
   enclosed pocket measured here came in at mean 250-254 with a standard
   deviation under 2.6; painted highlights vary far more. So an enclosed bright
   component is backdrop when it is bright AND uniform.

3. AND A FEATHERED EDGE KEEPS THE WHITE. The boundary pixels are a blend of the
   figure over a white page. Give them partial alpha while leaving their colour
   alone and the white is still in there: over a dark background the whole
   silhouette wears a pale halo. Since the backdrop colour is known, the true
   colour can be recovered exactly — F = (C - (1-a)*bg) / a — which is what the
   un-premultiply step below does.

CHECK THE RESULT BY LOOKING AT THE ALPHA, NOT THE HISTOGRAM. An earlier version
of this file produced cutouts whose aggregate alpha statistics matched the
hand-made originals almost exactly and which were still visibly wrong. Composite
on magenta, and map every pixel that is both near-white and not transparent.
"""
import argparse, os, sys
from collections import deque
from PIL import Image


def _bright_mask(px, w, h, lo):
    m = bytearray(w * h)
    for y in range(h):
        base = y * w
        for x in range(w):
            r, g, b = px[x, y]
            m[base + x] = 1 if min(r, g, b) >= lo else 0
    return m


def _flood_from_border(bright, w, h):
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if bright[i] and not bg[i]:
                bg[i] = 1; q.append(i)
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if bright[i] and not bg[i]:
                bg[i] = 1; q.append(i)
    while q:
        i = q.popleft()
        iy, ix = divmod(i, w)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = ix + dx, iy + dy
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if bright[j] and not bg[j]:
                    bg[j] = 1; q.append(j)
    return bg


def _drop_flat_pockets(px, bright, bg, w, h, mean_min, std_max):
    """Enclosed bright regions that are FLAT are backdrop the fill could not reach."""
    seen = bytearray(w * h)
    dropped = 0
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if seen[i] or bg[i] or not bright[i]:
                seen[i] = 1
                continue
            q = deque([i]); seen[i] = 1
            comp = []; vals = []
            while q:
                j = q.popleft()
                comp.append(j)
                jy, jx = divmod(j, w)
                r, g, b = px[jx, jy]
                vals.append(min(r, g, b))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = jx + dx, jy + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        k = ny * w + nx
                        if not seen[k] and bright[k] and not bg[k]:
                            seen[k] = 1; q.append(k)
            m = sum(vals) / len(vals)
            var = sum((v - m) ** 2 for v in vals) / len(vals)
            if m >= mean_min and var ** 0.5 <= std_max:
                for j in comp:
                    bg[j] = 1
                dropped += len(comp)
    return dropped


def _grow(px, bg, w, h, grow_lo, steps):
    """Creep the background outward a couple of pixels through slightly dimmer
    near-white, to take the anti-aliasing the strict threshold leaves behind.

    BOUNDED ON PURPOSE. Simply lowering the strict threshold instead would be
    the same hazard the connected fill exists to avoid: the oracle's robes reach
    those values too, so a free-running fill at 240 can enter at the silhouette
    and keep going. Seeded from a mask that is already known-good and limited to
    a few steps, the worst case is a two-pixel bite out of an edge rather than a
    hole through a garment."""
    frontier = [i for i in range(w * h) if bg[i]]
    for _ in range(steps):
        nxt = []
        for i in frontier:
            iy, ix = divmod(i, w)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = ix + dx, iy + dy
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny * w + nx
                    if not bg[j]:
                        r, g, b = px[nx, ny]
                        if min(r, g, b) >= grow_lo:
                            bg[j] = 1; nxt.append(j)
        if not nxt:
            break
        frontier = nxt


def cut(im, lo=248, band=2, mean_min=249.0, std_max=4.0, bgv=253,
        grow_lo=238, grow_steps=2):
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()

    bright = _bright_mask(px, w, h, lo)
    bg = _flood_from_border(bright, w, h)
    _drop_flat_pockets(px, bright, bg, w, h, mean_min, std_max)
    _grow(px, bg, w, h, grow_lo, grow_steps)

    out = Image.new("RGBA", (w, h))
    op = out.load()
    span = 14.0
    for y in range(h):
        for x in range(w):
            i = y * w + x
            r, g, b = px[x, y]
            if bg[i]:
                op[x, y] = (r, g, b, 0)
                continue
            near = False
            for dy in range(-band, band + 1):
                for dx in range(-band, band + 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and bg[ny * w + nx]:
                        near = True; break
                if near: break
            if not near:
                op[x, y] = (r, g, b, 255)
                continue
            v = min(r, g, b)
            a = 255 if v <= lo - span else int(255 * (lo - v) / span)
            a = max(0, min(255, a))
            if a <= 0:
                op[x, y] = (r, g, b, 0)
                continue
            # UN-PREMULTIPLY against the known white page, so a half-transparent
            # edge pixel carries the figure's colour rather than a smear of the
            # backdrop. Without this every silhouette wears a pale halo on dark.
            f = a / 255.0
            rr = int((r - bgv * (1 - f)) / f)
            gg = int((g - bgv * (1 - f)) / f)
            bb = int((b - bgv * (1 - f)) / f)
            op[x, y] = (max(0, min(255, rr)), max(0, min(255, gg)),
                        max(0, min(255, bb)), a)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--lo", type=int, default=248, help="backdrop min-channel floor")
    ap.add_argument("--mean", type=float, default=249.0, help="pocket mean floor")
    ap.add_argument("--std", type=float, default=4.0, help="pocket flatness ceiling")
    ap.add_argument("--grow-lo", type=int, default=238, help="looser floor for the bounded grow")
    ap.add_argument("--grow", type=int, default=2, help="bounded grow steps")
    ap.add_argument("--q", type=int, default=88)
    a = ap.parse_args(argv)

    im = cut(Image.open(a.src), a.lo, 2, a.mean, a.std, 253, a.grow_lo, a.grow)
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
