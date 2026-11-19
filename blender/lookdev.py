# Look development stills of the tunnel set, rendered in a background Blender (the live one stays free):
#   blender -b --factory-startup -P blender/lookdev.py -- --views entry,flight [--pct 50] [--samples 64] [--tag a]
#   … --mountain --views reveal  (the outside set, mountain.py; --mset moon=3,air=0.002 for its knobs)
# → out/blender/lookdev/<view><tag>.png, with the render time printed.
import bpy, sys, os, time, math, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools', 'blender'))
sys.path.insert(0, HERE)
import lib
import tunnel_set as TS
import tunnel_fx as FX

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d


def flag(k):
    return k in argv


# name: (s, across, height) of the eye, (s, across, height) of the target, lens mm, f-stop
VIEWS = {
    'entry': ((0.6, 0.0, 1.25), (6.2, 0.0, 1.35), 30, 2.8),
    'flight': ((20.0, 0.12, 1.3), (27.0, -0.1, 1.45), 20, 4.0),
    'bend': ((36.0, 0.25, 1.15), (44.0, 0.0, 1.6), 24, 4.0),
    'up': ((10.0, 0.0, 1.0), (12.0, 0.0, 3.2), 18, 5.6),
    'outside': ((30.0, 7.5, 3.2), (36.0, 0.0, 1.5), 28, 5.6),
    'aerial': ((-8.0, 10.0, 10.0), (14.0, -1.0, 2.0), 24, 8.0),
}
# the mountain's views (the same convention, on the mountain line)
MVIEWS = {
    'reveal': ((150.0, 10.0, 14.0), (232.0, 0.0, 3.0), 32, 11.0),
    'side': ((182.0, 4.2, 2.3), (194.0, 1.0, 1.9), 24, 5.6),
    'roof': ((110.0, 2.0, 7.0), (150.0, 0.0, 2.0), 24, 8.0),
    'high': ((-30.0, -60.0, 120.0), (170.0, -20.0, 0.0), 24, 11.0),
    'crane': ((170.4, -3.4, 36.0), (289.0, -6.0, 11.0), 28, 8.0),
}


def main():
    lib.clear_scene()
    pct = int(arg('--pct', '50'))
    lib.setup_render(fps=30, res=(1920, 1080), pct=pct, samples=int(arg('--samples', '64')), threshold=0.02, min_samples=16,
                     exposure=float(arg('--exposure', '0')), view=arg('--view', 'Khronos PBR Neutral'))
    for kv in [x for x in arg('--set', '').split(',') if x]:  # --set moon=4,haze=0.02
        k, v = kv.split('=')
        TS.LOOK[k] = float(v)
    for kv in [x for x in arg('--gold', '').split(';') if x]:  # --gold "base=#C98C2C;glow_k=2"
        k, v = kv.split('=')
        FX.GOLD[k] = v if v.startswith('#') else float(v)
    t0 = time.time()
    if flag('--mountain'):
        import mountain as MT
        for kv in [x for x in arg('--mset', '').split(',') if x]:
            k, v = kv.split('=')
            MT.MLOOK[k] = float(v)
        S = MT.build()
        print(f'BUILD {time.time() - t0:.1f}s, {len(bpy.data.objects)} objects', flush=True)
        render_views(S, MVIEWS, clip=(0.5, 6000))
        return
    S = TS.build()
    FX.add_all(S, title_text='千本桜' if not flag('--notitle') else None, title_s=float(arg('--title_s', '5.4')),
               air=int(arg('--air', '6000')))
    FX.set_input(S['petal_air_md'], 'Clock', float(arg('--clock', '3')))
    FX.set_input(S['petal_air_md'], 'Wind', float(arg('--wind', '0')))
    if 'burst_md' in S:
        FX.set_input(S['burst_md'], 'Tau', float(arg('--tau', '0')))
        for i, g in enumerate(S['title']):
            g['ignite'] = float(arg('--ignite', '0.35'))
            S['title_lights'][i].data.energy = float(arg('--tlight', '12'))
        if float(arg('--tau', '0')) > 0:
            for g in S['title']:
                g.hide_render = True
    print(f'BUILD {time.time() - t0:.1f}s, {len(bpy.data.objects)} objects', flush=True)
    render_views(S, VIEWS)


def render_views(S, views, clip=(0.03, 300)):
    cam = lib.camera('cam', lens=30, fstop=2.8, clip=clip)
    out = os.path.join(ROOT, 'out', 'blender', 'lookdev')
    os.makedirs(out, exist_ok=True)
    for name in arg('--views', 'entry').split(','):
        (es, ea, eh), (ts, ta, th), lens, fst = views[name]
        eye, tgt = TS.PATH.pos(es, ea, eh), TS.PATH.pos(ts, ta, th)
        cam.location = eye
        cam.rotation_quaternion = lib.cam_quat(eye, tgt)
        cam.data.lens = lens
        cam.data.dof.aperture_fstop = fst
        cam.data.dof.focus_distance = (tgt - eye).length
        t1 = time.time()
        bpy.ops.render.render()
        p = os.path.join(out, f'{name}{arg("--tag", "")}.png')
        lib.save_result(p, 'png')
        print(f'VIEW {name} {time.time() - t1:.1f}s -> {p}', flush=True)


main()
