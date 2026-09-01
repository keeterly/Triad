"""KIZUNA v2.3 — cutting a hero plate in for the board.

Input:  <src>/{kai,mira,elin}-rb.png — the uploads run through a real matting
        model (Higgsfield `remove_background`). Do NOT flood-fill from the edge:
        a fill cannot reach a gap ENCLOSED by hair, and every strand keeps a
        halo besides. Build 102 shipped that and the screen showed it.
Output: art/<name>.webp (720 tall, stance centred) and art/<name>-face.webp
        (192x192, head found up the stance column).

    python3 v2.3/docs/art-export.py <src-dir>

Every rule this file enforces is one the SCREEN caught after the numbers passed,
so each one asserts rather than warns.
"""
import sys
from PIL import Image
S = sys.argv[1] if len(sys.argv) > 1 else 'art/src'

def stance_x(alpha, w, h):
    band = alpha.crop((0, int(h * 0.80), w, h)); pb = band.load()
    tot = sx = 0.0
    for y in range(0, band.size[1], 2):
        for x in range(0, w, 2):
            q = pb[x, y]
            if q > 24: tot += q; sx += q * x
    return (sx / tot) if tot else w / 2.0

def decontaminate(im):
    """The matte's RGB is the plate COMPOSITED OVER WHITE, so every soft pixel
    carries a share of the backdrop: on a dark stage that reads as a pale haze
    along every hair strand. Undo the composite — C = a·F + (1−a)·255 — and the
    strand gets its own colour back."""
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or a == 255: continue
            k = a / 255.0
            px[x, y] = (
                max(0, min(255, int(round((r - (1 - k) * 255) / k)))),
                max(0, min(255, int(round((g - (1 - k) * 255) / k)))),
                max(0, min(255, int(round((b - (1 - k) * 255) / k)))), a)
    return im

for k in ('kai', 'mira', 'elin'):
    cut = decontaminate(Image.open('%s/%s-rb.png' % (S, k)).convert('RGBA'))
    a = cut.split()[-1]
    cut = cut.crop(a.point(lambda p: 255 if p > 8 else 0).getbbox())
    a = cut.split()[-1]; w2, h2 = cut.size
    opaque = sum(a.histogram()[200:]) / float(w2 * h2)
    assert 0.15 < opaque < 0.72, '%s: matte failed, %.0f%% opaque' % (k, opaque * 100)
    cx = stance_x(a, w2, h2)
    padR = max(0, int(round(2 * cx - w2))); padL = max(0, int(round(w2 - 2 * cx)))
    fin = Image.new('RGBA', (w2 + padL + padR, h2), (0, 0, 0, 0)); fin.paste(cut, (padL, 0))
    H = 720; W = max(1, int(round(fin.width * H / fin.height)))
    fin = fin.resize((W, H), Image.LANCZOS)
    fin.save('art/%s.webp' % k, 'WEBP', quality=88, method=6)
    fa = fin.split()[-1]
    c2 = stance_x(fa, W, H)
    assert abs(c2 - W / 2.0) < W * 0.06, '%s: stance %d not centred in %d' % (k, c2, W)
    pf = fa.load(); lo, hi = int(W * 0.42), int(W * 0.58); top = H
    for y in range(H):
        if any(pf[x, y] > 40 for x in range(lo, hi, 2)): top = y; break
    # THE HAIR TEST, in numbers. Backdrop left in the hair is pale AND soft —
    # a strand's edge still carrying the white it was cut from. Elin's habit is
    # pale too, so the count has to exclude anything fully opaque, or the check
    # fails her cream hood and passes nobody. This is the fault the last two
    # exports shipped, so it fails the build now. The raw mattes read 4.5–6.2%;
    # undoing the white composite halves that, and the bar sits between.
    pc = fin.load(); band = int(H * 0.22); haze = seen = 0
    for y in range(top, min(H, top + band)):
        for x in range(0, W, 2):
            r, g, b, al = pc[x, y]
            if al < 8: continue
            seen += 1
            if al < 200 and (r + g + b) / 3 > 200: haze += 1
    pct = 100.0 * haze / max(1, seen)
    assert pct < 3.5, '%s: head band is %.1f%% pale haze — backdrop still in the hair' % (k, pct)
    side = int(H * 0.30)
    x0 = max(0, W // 2 - side // 2); y0 = max(0, top - int(side * 0.06))
    fin.crop((x0, y0, x0 + side, y0 + side)).resize((192, 192), Image.LANCZOS) \
       .save('art/%s-face.webp' % k, 'WEBP', quality=90, method=6)
    print('%-5s %.0f%% opaque  stance %d/%d  head y=%d  haze %.2f%%  -> %dx%d'
          % (k, opaque * 100, int(c2), W, top, pct, W, H))
