# Night cherry trees for the tunnel set, procedural: a leaning trunk forking into spreading limbs (tapered curves),
# and blossom over every outer twig: lumpy puffs whose surface breaks up into single flowers (a Voronoi cut-out), pale
# pink, letting the moonlight through. Deterministic from a seed.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise
import tunnel_set as TS
from tunnel_set import NT, new_mat, rgba


def mat_blossom(cutout=True):
    """cutout: the puff's surface breaks up into single flowers (close shots); off for the distance (solid, cheaper)."""
    m = new_mat('blossom' if cutout else 'blossom_far')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    out = next(n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
    tc = T.coords()
    rnd = T.node('ShaderNodeObjectInfo').outputs['Random']
    vo = T.node('ShaderNodeTexVoronoi', feature='F1')
    T.put(tc['Object'], vo.inputs['Vector'])
    vo.inputs['Scale'].default_value = 26.0 if cutout else 9.0
    vo.inputs['Randomness'].default_value = 0.9
    d = vo.outputs['Distance']
    flower = T.smooth(0.36, 0.22, d)  # a flower per cell, the gaps between them see through
    big = T.noise(tc['Object'], 3.0, 3.0)
    keep = T.math('MAXIMUM', flower, T.smooth(0.62, 0.72, big))
    col = T.mix(T.math('MULTIPLY', rnd, 0.8), rgba('#F8E4EA'), rgba('#F2C2D0'))
    col = T.mix(T.smooth(0.08, 0.0, d), col, rgba('#D9708F'))  # the flowers' darker hearts
    T.put(col, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.6
    b.inputs['Sheen Weight'].default_value = 0.5
    tr = T.node('ShaderNodeBsdfTranslucent')
    T.put(col, tr.inputs['Color'])
    mx = T.node('ShaderNodeMixShader')
    mx.inputs['Fac'].default_value = 0.45
    T.put(b.outputs[0], mx.inputs[1])
    T.put(tr.outputs[0], mx.inputs[2])
    if not cutout:
        # no holes: a soft mottling instead, pale and glowing through (yozakura: the canopy lit from below and within)
        soft = T.math('MULTIPLY', T.smooth(0.1, 0.45, d), 0.22)
        T.put(T.mix(soft, col, rgba('#C98BA0')), b.inputs['Base Color'])
        mx.inputs['Fac'].default_value = 0.55
        T.put(mx.outputs[0], out.inputs['Surface'])
        return m
    tp = T.node('ShaderNodeBsdfTransparent')
    cut = T.node('ShaderNodeMixShader')
    T.put(keep, cut.inputs['Fac'])
    T.put(tp.outputs[0], cut.inputs[1])
    T.put(mx.outputs[0], cut.inputs[2])
    T.put(cut.outputs[0], out.inputs['Surface'])
    return m


def mat_sakura_bark():
    m = new_mat('sakura_bark')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    tc = T.coords()
    # cherry bark: dark, with the horizontal lenticel bands
    bands = T.noise(T.vmath('MULTIPLY', tc['Object'], (3.0, 3.0, 60.0)), 1.0, 4.0, 0.5)
    col = T.mix(T.smooth(0.45, 0.65, bands), rgba('#2A1C17'), rgba('#4A3A34'))
    T.put(col, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.7
    T.put(T.bump(bands, 0.3, 0.01), b.inputs['Normal'])
    return m


def puff_mesh(seed=0):
    """A blossom cluster, radius ~1 (scaled per use): lumpy in shape, bumpy all over with the flowers' clumps."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
    off = Vector((seed * 7.1, seed * 3.3, seed * 5.7))
    for v in bm.verts:
        n = noise.noise(v.co * 1.6 + off)
        bumps = noise.noise(v.co * 7.5 + off * 2.0)
        v.co *= 0.8 + 0.32 * n + 0.09 * bumps
        v.co.z *= 0.72
    me = bpy.data.meshes.new(f'puff.{seed}')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return me


def grow(rnd, base, direction, length, radius, depth, segs, tips):
    """Branch from base: a polyline bending a little, forking at the end; appends (points, radii) to segs and the
    outer twigs' ends to tips."""
    pts, rads = [base.copy()], [radius]
    d = direction.normalized()
    n = 5
    p = base.copy()
    for i in range(1, n + 1):
        d = (d + Vector((rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), rnd.uniform(-0.12, 0.12)))).normalized()
        if depth >= 2:
            d = (d + Vector((0, 0, -0.06 * depth))).normalized()  # the outer limbs droop with the blossom's weight
        p = p + d * (length / n)
        pts.append(p.copy())
        rads.append(radius * (1 - 0.55 * i / n))
    segs.append((pts, rads))
    if depth >= 3 or radius < 0.02:
        tips.append((p, d))
        return
    k = 2 if depth == 0 else rnd.choice((2, 3))
    for j in range(k):
        a = (j - (k - 1) / 2) * rnd.uniform(0.6, 1.0) + rnd.uniform(-0.2, 0.2)
        side = Matrix.Rotation(a, 3, Vector((0, 0, 1))) @ d
        nd = (side + Vector((0, 0, rnd.uniform(0.1, 0.5) if depth < 2 else rnd.uniform(-0.1, 0.25)))).normalized()
        grow(rnd, p, nd, length * rnd.uniform(0.6, 0.8), radius * 0.45, depth + 1, segs, tips)


def tree(name, root, seed, scale, coll, mats, puffs, lean=None):
    """One cherry tree at root (world), about 7 m tall and 9 m across at scale 1. Returns (wood object, puff objects)."""
    rnd = random.Random(seed)
    segs, tips = [], []
    lean = lean or Vector((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), 1.0))
    trunk_len = 2.6 * scale * rnd.uniform(0.85, 1.15)
    top = root + lean.normalized() * trunk_len
    segs.append(([root.copy(), root.lerp(top, 0.5) + Vector((rnd.uniform(-0.1, 0.1), rnd.uniform(-0.1, 0.1), 0)), top], [0.26 * scale, 0.21 * scale, 0.18 * scale]))
    for j in range(rnd.choice((3, 4, 5))):
        az = j / 4 * 2 * math.pi + rnd.uniform(-0.5, 0.5)
        d = Vector((math.cos(az), math.sin(az), rnd.uniform(0.6, 1.2))).normalized()
        grow(rnd, top, d, 2.4 * scale, 0.13 * scale, 1, segs, tips)
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 1.0
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    for pts, rads in segs:
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for i, (p, r) in enumerate(zip(pts, rads)):
            sp.points[i].co = (p.x, p.y, p.z, 1.0)
            sp.points[i].radius = r
    wood = bpy.data.objects.new(name, cu)
    cu.materials.append(mats['bark'])
    coll.objects.link(wood)
    pobs = []
    for k, (p, d) in enumerate(tips):
        for q in range(9):  # many small clusters per twig: the canopy's edge goes fluffy and the branches show between
            ob = bpy.data.objects.new(f'{name}.p{k}{q}', puffs[rnd.randrange(len(puffs))])
            c = p + d * rnd.uniform(-0.2, 0.7) * scale + Vector((rnd.uniform(-0.95, 0.95), rnd.uniform(-0.95, 0.95), rnd.uniform(-0.45, 0.35))) * scale
            s = rnd.uniform(0.17, 0.34) * scale
            ob.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(rnd.uniform(0, 6.28), 4, 'Z') @ Matrix.Diagonal((s, s * rnd.uniform(0.8, 1.2), s, 1.0))
            coll.objects.link(ob)
            pobs.append(ob)
    return wood, pobs


def grove(spots, seed=88):
    """Trees at [(s, a, scale)] along the path (a: across, metres to the right; the root sits on the terrain)."""
    coll = TS.coll('sakura')
    mats = {'bark': mat_sakura_bark(), 'blossom': mat_blossom()}
    puffs = [puff_mesh(k) for k in range(5)]
    for me in puffs:
        me.materials.append(mats['blossom'])
    out = []
    for i, (s, a, sc) in enumerate(spots):
        root = TS.PATH.pos(s, a, TS.terrain(s, a) - 0.1)
        lean = Vector((-math.copysign(0.35, a) * TS.PATH.right(s).x, -math.copysign(0.35, a) * TS.PATH.right(s).y, 1.0))  # toward the tunnel
        out.append(tree(f'sakura.{i:02d}', root, seed + i * 13, sc, coll, mats, puffs, lean))
    return out
