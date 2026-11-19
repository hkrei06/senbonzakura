# The fox mask (狐面) the procession wears in chorus 2: white with vermilion flame brows and eye sweeps, gold in the
# ears, the eyes slits; painted with PIL onto a transparent sheet (the same design as cards.ts's foxMask).
#   python blender/make_foxmask.py   → blender/tex/foxmask.png (512 x 640, RGBA)
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 512, 640
S = 4  # supersample


def P(x, y):
    """Mask coordinates (the 2D design's: x -50..50, y -70..50) to supersampled pixels."""
    return ((x + 50) / 100 * W * S, (y + 70) / 120 * H * S)


def main():
    im = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    face = [(-30, -18), (-40, -62), (-14, -34), (0, -37), (14, -34), (40, -62), (30, -18), (36, 2), (26, 18), (16, 27), (8, 40), (0, 46),
            (-8, 40), (-16, 27), (-26, 18), (-36, 2)]
    d.polygon([P(*p) for p in face], fill=(246, 239, 226, 255), outline=(30, 18, 20, 255))
    for sx in (-1, 1):
        d.polygon([P(sx * 30, -27), P(sx * 36, -52), P(sx * 19, -34)], fill=(201, 162, 74, 255))  # inside the ears
        for pts in ([(6, -22), (12, -27), (19, -27), (26, -20)], [(8, -8), (14, -12), (21, -11), (27, -6)]):  # brows, eye sweep
            d.line([P(sx * x, y) for x, y in pts], fill=(200, 50, 30, 255), width=int(3.2 * S * W / 512 * 1.6), joint='curve')
        d.polygon([P(sx * 9, -9), P(sx * 16, -12), P(sx * 25, -14), P(sx * 17, -9.2)], fill=(18, 10, 16, 255))  # the eye: a slit, upturned
    d.polygon([P(-3, -30), P(0, -22), P(3, -30)], fill=(200, 50, 30, 255))  # the forehead jewel
    d.line([P(-9, 32), P(0, 37), P(9, 32)], fill=(200, 50, 30, 255), width=int(2.6 * S * 1.6), joint='curve')  # the mouth
    d.ellipse([P(-4, 37), P(4, 43)], fill=(18, 10, 16, 255))  # the nose
    im = im.resize((W, H), Image.LANCZOS)
    out = os.path.join(HERE, 'tex', 'foxmask.png')
    im.save(out)
    print('wrote', out, im.size)


main()
