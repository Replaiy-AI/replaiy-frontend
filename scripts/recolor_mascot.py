#!/usr/bin/env python3
"""Replaiy mascot fin-recolour — the SINGLE source of truth for persona/stock
mascots.

WHY NOT AI: every persona mascot must be the EXACT same character (body, face,
shape, clean cut-out) with only the fin colour changed. AI generation drifts on
all of those. So instead we take the real mascot PNG and recolour ONLY the fin
pixels in code, preserving the fin's own shading via an HLS hue-swap. Output is
pixel-identical to the original everywhere except the fin.

USAGE
  python scripts/recolor_mascot.py "#F43F5E" preset_direct
  python scripts/recolor_mascot.py 132,204,22 mascot_lime

  arg1 = target fin colour  (#RRGGBB or "r,g,b")
  arg2 = output filename stem (written to client/src/assets/<stem>.png)

Add new persona/stock colours by calling it again with a new colour + name.
The canonical colours we use:
  patient      #F59E0B   warm/blue   #2F6BFF   consultative #14B8A6
  sharp        #6D5BFF   direct      #F43F5E
  stock: lime #84CC16  cyan #06B6D4  fuchsia #EC4899  violet #8B5CF6
"""
import sys, os, colorsys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "client", "src", "assets")
# The real mascot is the only source. (blue fin, transparent bg, 475x512)
SOURCE = os.path.join(ASSETS, "replaiy-mascot.png")

def parse_color(s):
    s = s.strip()
    if s.startswith("#"):
        s = s[1:]
        return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))
    return tuple(int(x) for x in s.split(","))

def recolor(target_rgb, stem, pad_frac=0.10, size=512):
    im = Image.open(SOURCE).convert("RGBA")
    arr = np.array(im).astype(np.uint8)
    r, g, b, a = (arr[:, :, 0].astype(int), arr[:, :, 1].astype(int),
                  arr[:, :, 2].astype(int), arr[:, :, 3])
    # The fin is the only blue-dominant region on the head.
    fin = (b > r + 15) & (b > g + 5) & (b > 70) & (a > 40)
    th, _, _ = colorsys.rgb_to_hls(target_rgb[0]/255, target_rgb[1]/255, target_rgb[2]/255)
    out = arr.copy()
    ys, xs = np.where(fin)
    for y, x in zip(ys, xs):
        cr, cg, cb = arr[y, x, 0]/255, arr[y, x, 1]/255, arr[y, x, 2]/255
        _, l_, s_ = colorsys.rgb_to_hls(cr, cg, cb)
        nr, ng, nb = colorsys.hls_to_rgb(th, l_, max(s_, 0.55))
        out[y, x, 0], out[y, x, 1], out[y, x, 2] = int(nr*255), int(ng*255), int(nb*255)
    # trim to content, pad, square to `size`
    al = out[:, :, 3]
    yy, xx = np.where(al > 12)
    x0, x1, y0, y1 = xx.min(), xx.max(), yy.min(), yy.max()
    c = out[y0:y1+1, x0:x1+1]
    h, w = c.shape[:2]
    side = max(h, w); pad = int(side * pad_frac)
    cv = np.zeros((side + 2*pad, side + 2*pad, 4), dtype=np.uint8)
    cv[pad+(side-h)//2:pad+(side-h)//2+h, pad+(side-w)//2:pad+(side-w)//2+w] = c
    dst = os.path.join(ASSETS, f"{stem}.png")
    Image.fromarray(cv).resize((size, size), Image.LANCZOS).save(dst)
    print(f"wrote {dst}  (fin -> rgb{target_rgb})")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    recolor(parse_color(sys.argv[1]), sys.argv[2])
