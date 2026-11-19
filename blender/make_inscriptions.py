# The ink inscriptions on the tunnel's torii pillars (奉納 + where + who on the left pillar, the date on the right),
# brushed in Yuji Syuku (OFL) into one atlas: white = ink. tunnel_set.py picks a cell per gate.
#   python blender/make_inscriptions.py      → blender/tex/inscriptions.png (+ .json: the grid)
# The donors are made up; a few are this MV's own (the verse-1 newspaper, the theatre, the clock shop, the tram).
import json, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, 'fonts', 'yujisyuku_YujiSyuku-Regular.ttf')
CW, CH = 160, 1600  # one cell: a 0.14 m wide column, 1.40 m tall
COLS, ROWS = 12, 4  # 48 cells: rows 0-1 the donors (left pillars), rows 2-3 the dates (right)

PLACES = ['東京', '大阪', '京都', '横濱', '神戸', '名古屋', '堺', '奈良', '伏見', '大津', '浪速', '近江']
DONORS = ['櫻都日報社', '初音屋', '千本屋呉服店', '月見堂', '山田商店', '花村組', '春風楼', '丸八酒造',
          '小川屋本店', '朝日屋', '菊乃家', '鶴亀堂', '夜桜座', '白焔社', '佐藤製糸所', '中村金物店',
          '桜井家', '高橋家', '浪花屋', '銀座時計店', '市電組合', '大正寫眞館', '錦絵堂', '鈴木薬局']
NUM = ['元', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五']
MON = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']


def has_glyph(font, ch, notdef):
    m = font.getmask(ch)
    return m.size != notdef.size or bytes(m) != bytes(notdef)


def column(draw, font_big, font, parts, x0, y0):
    """parts: [(text, 'big'|'norm', gap_after_px)] set top to bottom, centred on the cell."""
    y = y0
    for text, kind, gap in parts:
        f = font_big if kind == 'big' else font
        for ch in text:  # each glyph centred on its em box (short ones like 一 十 keep their place in the column)
            draw.text((x0 + CW / 2, y + f.size / 2), ch, font=f, fill=255, anchor='mm')
            y += f.size * 0.98
        y += gap
    return y


def brush(img, rnd):
    """Dry-brush: the ink thins in streaks along the stroke direction, the edges soften a little."""
    w, h = img.size
    noise = Image.effect_noise((w // 2, h // 8), 64).resize((w, h), Image.BILINEAR)
    streak = noise.point(lambda v: 255 if v > 92 + rnd.randint(-8, 8) else int(v * 1.6))
    img = ImageChops.multiply(img, streak)
    return img.filter(ImageFilter.GaussianBlur(0.9))


def main():
    font = ImageFont.truetype(FONT, 104)
    font_big = ImageFont.truetype(FONT, 132)
    notdef = font.getmask('\U0010FFFF')
    used = set(''.join(PLACES + DONORS + NUM + MON) + '奉納大正明治昭和年月吉日')
    missing = [c for c in sorted(used) if not has_glyph(font, c, notdef)]
    if missing:
        raise SystemExit(f'Yuji Syuku is missing {len(missing)} glyphs: {" ".join(missing)}')
    rnd = random.Random(1912)
    atlas = Image.new('L', (CW * COLS, CH * ROWS), 0)
    cells = []
    for i in range(COLS * ROWS):
        cell = Image.new('L', (CW, CH), 0)
        d = ImageDraw.Draw(cell)
        if i < COLS * 2:
            donor = DONORS[i % len(DONORS)]
            place = PLACES[rnd.randrange(len(PLACES))]
            column(d, font_big, font, [('奉納', 'big', 70), (place, 'norm', 26), (donor, 'norm', 0)], 0, 40)
            cells.append({'side': 'L', 'n': len(donor)})
        else:
            era = rnd.random()
            if era < 0.12:
                head = '明治' + rnd.choice(['四十', '四十三', '四十四', '四十五'])
            elif era < 0.2:
                head = '昭和' + rnd.choice(['元', '二', '三'])
            else:
                head = '大正' + NUM[rnd.randrange(len(NUM))]
            column(d, font_big, font, [(head + '年', 'norm', 20), (MON[rnd.randrange(12)] + '月吉日', 'norm', 0)], 0, 250)
            cells.append({'side': 'R'})
        atlas.paste(brush(cell, rnd), ((i % COLS) * CW, (i // COLS) * CH))
    out = os.path.join(HERE, 'tex', 'inscriptions.png')
    atlas.save(out, optimize=True)
    with open(out[:-4] + '.json', 'w', encoding='utf-8') as fh:
        json.dump({'cols': COLS, 'rows': ROWS, 'cell': [CW, CH], 'donor_rows': [0, 1], 'date_rows': [2, 3]}, fh)
    print('wrote', out, atlas.size)


main()
