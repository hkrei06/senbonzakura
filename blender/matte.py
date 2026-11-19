# 2.5D matte plates: one Cycles still of a set (a little wider than the frame) and its depth, which the engine's
# matte.ts lifts into a relief mesh and moves its camera through (a push, a rise, a drift: parallax without rendering
# every frame). The user's call (2026-10-26): outside shots this way instead of Cycles frame by frame.
#   blender -b --factory-startup -P blender/matte.py -- --matte reveal [--samples 192] [--scale 100]
# → assets/blender/matte_<name>/color.png (the graded still), depth.png (inverse depth near / z in 16 bits: R high
#   byte, G low byte; 0 = sky), matte.json (the camera: lens, sensor, resolution, overscan, near).
import bpy, sys, os, json, math, time
import numpy as np
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools', 'blender'))
sys.path.insert(0, HERE)
import lib

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d


NEAR = 0.5  # m: the depth code's near end (inverse depth near / z, so the precision is where the parallax is)


def depth_override():
    """An emission-only material giving each pixel its camera-space depth (View Z Depth), for the depth pass."""
    m = bpy.data.materials.new('matte_depth')
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    cam = nt.nodes.new('ShaderNodeCameraData')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.0
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(cam.outputs['View Z Depth'], comb.inputs[0])
    nt.links.new(comb.outputs[0], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


def render(name, eye, target, lens, samples=192, overscan=1.1, roll=0.0, res=(1920, 1080), pct=100, points=None):
    """Render the matte from eye toward target (Blender world) with a lens `overscan` times wider than the frame's.
    points: world positions the engine lights over the relief (matte.ts params.run), written in camera space."""
    out = os.path.join(ROOT, 'assets', 'blender', f'matte_{name}')
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    W, H = int(round(res[0] * overscan)), int(round(res[1] * overscan))
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, pct
    cam = sc.camera
    cam.location = eye
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = lib.cam_quat(eye, target, roll)
    cam.data.lens = lens / overscan
    cam.data.dof.use_dof = False
    sc.render.use_motion_blur = False
    try:
        sc.cycles.samples = samples
    except AttributeError:
        pass
    t0 = time.time()
    bpy.ops.render.render()
    lib.save_result(os.path.join(out, 'color.png'), 'png')
    print(f'COLOR {time.time() - t0:.1f}s', flush=True)
    # the depth: every surface emits its view depth, no volumes, one crisp sample a pixel, no grading
    for ob in bpy.data.objects:
        if ob.type == 'MESH' and any(s.material and s.material.node_tree and any(n.type == 'OUTPUT_MATERIAL' and n.inputs['Volume'].is_linked and not n.inputs['Surface'].is_linked for n in s.material.node_tree.nodes) for s in ob.material_slots):
            ob.hide_render = True
    vl = sc.view_layers[0]
    vl.material_override = depth_override()
    w = bpy.data.worlds.new('matte_black')
    try:
        w.use_nodes = True
    except AttributeError:
        pass
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0, 0, 0, 1)
    sc.world = w
    sc.cycles.samples = 1
    sc.cycles.use_denoising = False
    sc.cycles.use_adaptive_sampling = False
    sc.cycles.filter_width = 0.01
    sc.render.use_compositing = False
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'OPEN_EXR'
    sc.render.image_settings.color_depth = '32'
    t0 = time.time()
    bpy.ops.render.render()
    tmp = os.path.join(out, '_depth.exr')
    bpy.data.images['Render Result'].save_render(tmp)
    img = bpy.data.images.load(tmp)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)  # (rows from the bottom)
    z = px[..., 0]
    inv = np.where(z > 1e-4, np.clip(NEAR / np.maximum(z, NEAR), 0.0, 1.0), 0.0)
    code = np.round(inv * 65535.0).astype(np.uint32)
    rgba = np.zeros((img.size[1], img.size[0], 4), dtype=np.float32)
    rgba[..., 0] = (code >> 8) / 255.0
    rgba[..., 1] = (code & 255) / 255.0
    rgba[..., 3] = 1.0
    dimg = bpy.data.images.new('matte_depth_png', img.size[0], img.size[1], alpha=True)
    dimg.colorspace_settings.name = 'Non-Color'
    dimg.pixels.foreach_set(rgba.ravel())
    dimg.filepath_raw = os.path.join(out, 'depth.png')
    dimg.file_format = 'PNG'
    dimg.save()
    os.remove(tmp)
    print(f'DEPTH {time.time() - t0:.1f}s, depth range {float(z[z > 1e-4].min()):.1f}-{float(z.max()):.1f} m', flush=True)
    meta = {'lens': lens / overscan, 'sensor': cam.data.sensor_width, 'fit': 'HORIZONTAL', 'res': [W, H], 'overscan': overscan,
            'near': NEAR, 'eye': list(eye), 'target': list(target), 'roll': roll, 'frame_lens': lens}
    if points:  # in the camera's space (x right, y up, -z ahead), as the relief is built
        bpy.context.view_layer.update()
        inv = cam.matrix_world.inverted()
        meta['points'] = [[round(c, 3) for c in (inv @ Vector(p))] for p in points]
    with open(os.path.join(out, 'matte.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, indent=1)
    print('MATTE', out, flush=True)


def main():
    import shots_chorus as SC
    name = arg('--matte', 'reveal')
    spec = SC.MATTES[name]
    lib.clear_scene()
    lib.setup_render(fps=30, res=(1920, 1080), samples=int(arg('--samples', '192')), threshold=0.01, min_samples=32,
                     view='AgX', mblur=False)
    lib.camera('cam', lens=spec['lens'], fstop=8.0, clip=(0.05, 6000))
    spec['build']()
    eye, tgt = spec['eye'](), spec['target']()
    render(name, eye, tgt, spec['lens'], samples=int(arg('--samples', '192')), overscan=spec.get('overscan', 1.1),
           pct=int(arg('--scale', '100')), points=spec['points']() if 'points' in spec else None)


main()
