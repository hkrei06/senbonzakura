# The film's credits as donors' inscriptions on the last torii (the outro's climb, shots_chorus.credits_walk): on each
# credit gate's left pillar 奉納 and the role, brushed in Yuji Syuku (OFL); on the right pillar the names, Japanese set
# down the column, Latin turned on its side as vertical Japanese sets it (Cormorant, OFL). One atlas: white = ink, the
# same cell size and dry brush as make_inscriptions.py; tunnel_set.mat_vermilion(credits=True) reads it.
#   python blender/make_credits.py      → blender/tex/credits.png (+ .json)
import json, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
JP = os.path.join(HERE, 'fonts', 'yujisyuku_YujiSyuku-Regular.ttf')
LAT = os.path.join(os.path.dirname(HERE), 'app', 'public', 'fonts', 'Cormorant-600.ttf')
CW, CH = 160, 1600  # one cell: a 0.14 m wide column, 1.40 m tall (as the donors')

# (role on the left pillar, then the right pillar's lines: ('jp', text) set down the column, ('lat', text) on its side)
CREDITS = [
    ('楽曲', [('jp', '黒うさP'), ('jp', '初音ミク')]),
    ('映像', [('lat', 'xm-video-engine'), ('lat', 'XIAOMING6680')]),
    ('原典', [('lat', 'pdoom-video'), ('lat', 'Giacomo Magnanini')]),
    ('立体', [('lat', 'Blender'), ('lat', 'Blender Foundation')]),
    ('素材', [('lat', 'Poly Haven'), ('lat', 'CC0')]),
    ('書体', [('lat', 'Noto · Yuji Syuku'), ('lat', 'Cormorant · Archivo')]),
    ('解析', [('lat', 'audio-separator'), ('lat', 'torchaudio MMS')]),
    ('非営利', [('jp', '二次創作')]),
]


def brush(img, rnd):
    """Dry-brush (make_inscriptions.py): the ink thins in streaks along the stroke direction, the edges soften."""
    w, h = img.size
    noise = Image.effect_noise((w // 2, h // 8), 64).resize((w, h), Image.BILINEAR)
    streak = noise.point(lambda v: 255 if v > 92 + rnd.randint(-8, 8) else int(v * 1.6))
    return ImageChops.multiply(img, streak).filter(ImageFilter.GaussianBlur(0.9))


def down(d, font, text, y):
    """Japanese down the column, each glyph centred on its em box."""
    for ch in text:
        d.text((CW / 2, y + font.size / 2), ch, font=font, fill=255, anchor='mm')
        y += font.size * 0.98
    return y


def side(cell, font, text, y):
    """Latin turned on its side (reading top to bottom), centred across the column."""
    w = int(font.getlength(text)) + 8
    strip = Image.new('L', (w, CW), 0)
    ImageDraw.Draw(strip).text((4, CW / 2), text, font=font, fill=255, anchor='lm')
    strip = strip.rotate(-90, expand=True)
    cell.paste(strip, (0, int(y)), strip)
    return y + w


def main():
    big, norm = ImageFont.truetype(JP, 132), ImageFont.truetype(JP, 104)
    rnd = random.Random(2026)
    cols = len(CREDITS)
    atlas = Image.new('L', (CW * cols, CH * 2), 0)
    for i, (role, lines) in enumerate(CREDITS):
        cell = Image.new('L', (CW, CH), 0)
        d = ImageDraw.Draw(cell)
        y = down(d, big, '奉納', 40) + 70
        down(d, norm, role, y)
        atlas.paste(brush(cell, rnd), (i * CW, 0))
        cell = Image.new('L', (CW, CH), 0)
        d = ImageDraw.Draw(cell)
        y = 60.0
        for kind, text in lines:
            if kind == 'jp':
                y = down(d, norm, text, y) + 60
            else:
                f = ImageFont.truetype(LAT, 92 if len(text) < 14 else 76)
                while f.getlength(text) > CH - y - 40 and f.size > 40:
                    f = ImageFont.truetype(LAT, f.size - 6)
                y = side(cell, f, text, y) + 50
        atlas.paste(brush(cell, rnd), (i * CW, CH))
    out = os.path.join(HERE, 'tex', 'credits.png')
    atlas.save(out, optimize=True)
    with open(out[:-4] + '.json', 'w', encoding='utf-8') as fh:
        json.dump({'cols': cols, 'rows': 2, 'cell': [CW, CH], 'credits': [c[0] for c in CREDITS]}, fh, ensure_ascii=False)
    print('wrote', out, atlas.size)


main()
