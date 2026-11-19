# Downloads what the Blender sets use from outside (all free: Poly Haven CC0, Google Fonts OFL) into blender/tex/,
# blender/models/ and blender/fonts/; skips what is already there. Then run make_inscriptions.py.
#   python blender/fetch_assets.py
import json, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PH = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg'
TEXTURES = {  # Poly Haven texture: (resolution, maps)
    'grey_stone_path': ('2k', ['diff', 'nor_gl', 'rough', 'disp']),
    'japanese_cedar_bark': ('2k', ['diff', 'nor_gl', 'rough', 'disp']),
    'brown_mud_leaves_01': ('1k', ['diff', 'nor_gl', 'rough']),
}
MODELS = {'fir_tree_01': '1k', 'jacaranda_tree': '1k'}  # Poly Haven models (.blend and its textures)
FONTS = ['yujisyuku/YujiSyuku-Regular.ttf', 'yujisyuku/OFL.txt']  # google/fonts, ofl/


def get(url, dst):
    if os.path.exists(dst):
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    urllib.request.urlretrieve(url, dst + '.part')
    os.replace(dst + '.part', dst)
    print('got', os.path.relpath(dst, HERE))


def main():
    for tid, (res, maps) in TEXTURES.items():
        for m in maps:
            get(f'{PH}/{res}/{tid}/{tid}_{m}_{res}.jpg', os.path.join(HERE, 'tex', tid, f'{tid}_{m}_{res}.jpg'))
    for mid, res in MODELS.items():
        with urllib.request.urlopen(f'https://api.polyhaven.com/files/{mid}') as r:
            bl = json.load(r)['blend'][res]['blend']
        get(bl['url'], os.path.join(HERE, 'models', mid, os.path.basename(bl['url'])))
        for rel, v in bl.get('include', {}).items():
            get(v['url'], os.path.join(HERE, 'models', mid, rel))
    for f in FONTS:
        d, name = f.split('/')
        get(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{f}', os.path.join(HERE, 'fonts', f'{d}_{name}'))


main()
