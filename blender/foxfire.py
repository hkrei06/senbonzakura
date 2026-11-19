# Foxfire (狐火) for chorus 2, carried over from the pre-chorus's fox wedding: pale blue flames drifting in the tunnel
# instead of the lamps' warm light, and the title written in them. All in geometry nodes, every input keyed from song
# time by the shots module (EEVEE renders these shots):
#   field()   flames drifting along the tunnel, bobbing, each flickering on its own (Clock, Wind; Swirl > 0 turns them
#             into a vortex round the centre line, the vortex's angle keyed)
#   gather()  a glyph's flames: scattered round it, they converge onto the glyph's faces as it is sung (Gather 0→1)
#             and fly apart at the burst (Tau), fading
import bpy, bmesh, math
import tunnel_set as TS
import tunnel_fx as FX
from tunnel_set import NT, new_mat, rgba


def flame_mesh():
    """A teardrop of flame, ~1 m tall at scale 1 (instances scale it to 6–14 cm), its tip up."""
    bm = bmesh.new()
    seg, rings = 10, 9
    prof = [(math.sin(math.pi * k / rings) ** 0.8 * (1 - 0.55 * k / rings) * 0.42, -0.35 + 1.25 * (k / rings) ** 1.2) for k in range(rings + 1)]
    vs = []
    for r, z in prof:
        vs.append([bm.verts.new((r * math.cos(2 * math.pi * j / seg), r * math.sin(2 * math.pi * j / seg), z)) for j in range(seg)])
    for a, c in zip(vs, vs[1:]):
        for j in range(seg):
            k = (j + 1) % seg
            try:
                bm.faces.new((a[j], a[k], c[k], c[j]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('flame')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return me


def mat_foxfire():
    """Soft blue fire: a pale cyan core deepening to blue toward the silhouette, which fades out to nothing (so a flame
    reads as a glow, not a drop); the strength is the instance's 'flick' (kept low: AgX bleaches bright blue to white)."""
    m = new_mat('foxfire')
    T = NT(m.node_tree)
    out = next(n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
    for n in list(m.node_tree.nodes):
        if n.type == 'BSDF_PRINCIPLED':
            m.node_tree.nodes.remove(n)
    lw = T.node('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.5
    edge = lw.outputs['Facing']
    flick = T.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='flick').outputs['Fac']
    col = T.mix(T.math('POWER', edge, 0.6), rgba('#5CC8FF'), rgba('#1B4DFF'))
    em = T.node('ShaderNodeEmission')
    T.put(col, em.inputs['Color'])
    T.put(T.math('MULTIPLY', flick, 1.5), em.inputs['Strength'])
    tp = T.node('ShaderNodeBsdfTransparent')
    mx = T.node('ShaderNodeMixShader')
    T.put(T.smooth(0.25, 0.85, edge), mx.inputs['Fac'])
    T.put(em.outputs[0], mx.inputs[1])
    T.put(tp.outputs[0], mx.inputs[2])
    T.put(mx.outputs[0], out.inputs['Surface'])
    return m


def source(coll):
    """The flame mesh object (hidden) and its material."""
    ob = bpy.data.objects.get('flame_src')
    if ob:
        return ob, bpy.data.materials['foxfire']
    ob = bpy.data.objects.new('flame_src', flame_mesh())
    coll.objects.link(ob)
    ob.hide_render = True
    ob.hide_viewport = True
    return ob, mat_foxfire()


def field(coll, path_ob, flame_ob, mat, count=260, s0=-3.0, s1=60.0, seed=41, across=0.72, h_lo=0.5, h_hi=2.45, size=(0.035, 0.08)):
    """Flames drifting along the tunnel between s0 and s1. Keyed inputs: Clock (bob and flicker), Wind (m along the
    tunnel, + away), Swirl (0 drifting … 1 a vortex: each flame orbits the centre line at its own radius), Spin (rad:
    the vortex's angle)."""
    G = FX.GN('foxfire_field')
    path = G.inp('Path', 'Object')
    flame = G.inp('Flame', 'Object')
    clock, wind = G.inp('Clock', 'Float', 0.0), G.inp('Wind', 'Float', 0.0)
    swirl, spin = G.inp('Swirl', 'Float', 0.0), G.inp('Spin', 'Float', 0.0)
    pts = G.node('GeometryNodePoints')
    pts.inputs['Count'].default_value = count
    idx = G.node('GeometryNodeInputIndex').outputs[0]
    R = lambda lo, hi, k, kind='FLOAT': G.rand(lo, hi, seed * 100 + k, kind, idx)
    span = s1 - s0
    sb, a0, h0, ph = R(0.0, 1.0, 1), R(-across, across, 2), R(h_lo, h_hi, 3), R(0.0, 6.283, 4)
    wk, size, rr = R(0.6, 1.4, 5), R(size[0], size[1], 6), R(0.35, 0.95, 7)
    s_raw = G.math('ADD', G.math('MULTIPLY_ADD', sb, span, G.math('MULTIPLY', wind, wk)), G.math('MULTIPLY', 0.25, G.math('SINE', G.math('MULTIPLY_ADD', clock, 0.6, ph))))
    s = G.math('ADD', s0, G.math('FLOORED_MODULO', G.math('SUBTRACT', s_raw, s0), span))
    # drifting place, and the vortex place (round the centre line at 1.4 m): blended by Swirl
    bob = G.math('MULTIPLY', 0.12, G.math('SINE', G.math('MULTIPLY_ADD', clock, 1.3, ph)))
    ang = G.math('ADD', G.math('MULTIPLY', ph, 1.0), G.math('MULTIPLY', spin, G.math('MULTIPLY_ADD', rr, -0.6, 1.4)))
    va, vh = G.math('MULTIPLY', rr, G.math('COSINE', ang)), G.math('ADD', 1.4, G.math('MULTIPLY', G.math('MULTIPLY', rr, 1.1), G.math('SINE', ang)))
    a = G.math('ADD', G.math('MULTIPLY', a0, G.math('SUBTRACT', 1.0, swirl)), G.math('MULTIPLY', va, swirl))
    h = G.math('ADD', G.math('MULTIPLY', G.math('ADD', h0, bob), G.math('SUBTRACT', 1.0, swirl)), G.math('MULTIPLY', vh, swirl))
    pos = G.path_point(G.objgeo(path), s, a, h, path_ob['s0'])
    sp = G.node('GeometryNodeSetPosition')
    G.put(pts.outputs[0], sp.inputs['Geometry'])
    G.put(pos, sp.inputs['Position'])
    fade = G.math('MULTIPLY', G.smooth(0.0, 1.5, G.math('SUBTRACT', s, s0)), G.smooth(0.0, 1.5, G.math('SUBTRACT', s1, s)))
    flick = G.math('ADD', 0.75, G.math('MULTIPLY', 0.25, G.math('SINE', G.math('MULTIPLY_ADD', clock, R(7.0, 13.0, 8), ph))))
    geo = G.store(sp.outputs['Geometry'], 'flick', flick)
    rot = G.combine(G.math('MULTIPLY', 0.15, G.math('SINE', G.math('MULTIPLY_ADD', clock, 2.1, ph))), 0.0, ph)
    inst = G.instance(geo, G.objgeo(flame), rot, G.math('MULTIPLY', size, fade))
    G.out(G.material(G.realize(inst), mat))
    ob = FX.host('foxfire_field', coll)
    md = FX.modifier(ob, G.ng, Path=path_ob, Flame=flame_ob)
    return ob, md


def gather(coll, glyph_ob, flame_ob, mat, toward, density=900.0, seed=61):
    """A glyph written in foxfire: flames scattered up to ~3 m round it converge onto its faces as Gather runs 0→1,
    then fly apart at the burst (Tau, s since it) and fade. Keyed: Gather, Tau, Clock."""
    G = FX.GN('foxfire_gather')
    gsock = G.inp('Glyph', 'Object')
    flame = G.inp('Flame', 'Object')
    gat, tau, clock = G.inp('Gather', 'Float', 0.0), G.inp('Tau', 'Float', 0.0), G.inp('Clock', 'Float', 0.0)
    dist = G.node('GeometryNodeDistributePointsOnFaces', distribute_method='RANDOM')
    G.put(G.objgeo(gsock), dist.inputs['Mesh'])
    dist.inputs['Density'].default_value = density
    dist.inputs['Seed'].default_value = seed
    idx = G.node('GeometryNodeInputIndex').outputs[0]
    R = lambda lo, hi, k, kind='FLOAT': G.rand(lo, hi, seed * 100 + k, kind, idx)
    scat = R((-3.0, -2.0, -1.6), (3.0, 1.0, 2.0), 1, 'FLOAT_VECTOR')
    lag = R(0.0, 0.35, 2)  # each flame arrives at its own time
    g = G.smooth(0.0, 1.0, G.math('DIVIDE', G.math('SUBTRACT', gat, lag), 0.65))
    swirl = G.math('MULTIPLY', G.math('SUBTRACT', 1.0, g), 1.8)
    ph = R(0.0, 6.283, 3)
    sw = G.combine(G.math('MULTIPLY', G.math('COSINE', G.math('ADD', ph, G.math('MULTIPLY', clock, 2.0))), swirl), 0.0,
                   G.math('MULTIPLY', G.math('SINE', G.math('ADD', ph, G.math('MULTIPLY', clock, 2.0))), swirl))
    off = G.vmath('ADD', G.vmath('SCALE', scat, scale=G.math('SUBTRACT', 1.0, g)), sw)
    # the burst: out along the face normal and toward the camera, slowing
    dirv = G.vmath('NORMALIZE', G.vmath('ADD', G.vmath('ADD', dist.outputs['Normal'], R((-1.0, -1.0, -0.6), (1.0, 1.0, 1.0), 4, 'FLOAT_VECTOR')), toward * 1.2))
    k = R(1.2, 2.4, 5)
    reach = G.math('DIVIDE', G.math('SUBTRACT', 1.0, G.math('EXPONENT', G.math('MULTIPLY', G.math('MULTIPLY', k, tau), -1.0))), k)
    off = G.vmath('ADD', off, G.vmath('SCALE', dirv, scale=G.math('MULTIPLY', R(2.0, 6.0, 6), reach)))
    sp = G.node('GeometryNodeSetPosition')
    G.put(dist.outputs['Points'], sp.inputs['Geometry'])
    G.put(off, sp.inputs['Offset'])
    alive = G.math('MULTIPLY', G.smooth(0.0, 0.15, gat), G.smooth(1.2, 0.3, tau))
    flick = G.math('MULTIPLY', G.math('ADD', 0.8, G.math('MULTIPLY', 0.2, G.math('SINE', G.math('MULTIPLY_ADD', clock, R(8.0, 14.0, 7), ph)))),
                   G.math('ADD', 1.0, G.math('MULTIPLY', 2.0, G.math('EXPONENT', G.math('MULTIPLY', tau, -8.0)))))
    geo = G.store(sp.outputs['Geometry'], 'flick', G.math('MULTIPLY', flick, G.math('ADD', 0.6, G.math('MULTIPLY', 0.4, g))))
    inst = G.instance(geo, G.objgeo(flame), G.combine(0.0, 0.0, ph), G.math('MULTIPLY', alive, R(0.026, 0.05, 8)))
    G.out(G.material(G.realize(inst), mat))
    ob = FX.host(f'foxfire_{glyph_ob.name}', coll)
    md = FX.modifier(ob, G.ng, Glyph=glyph_ob, Flame=flame_ob)
    return ob, md


# ------------------------------------------------------------------ the procession (chorus 2, inside the tunnel)
def mat_mask():
    """The painted fox mask (make_foxmask.py): its alpha cuts the card, a faint glow of its own in the dark."""
    import os
    m = new_mat('fox_mask')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    col, alpha = T.tex(os.path.join(TS.TEX, 'foxmask.png'), T.coords()['UV'], ext='CLIP')
    T.put(col, b.inputs['Base Color'])
    T.put(alpha, b.inputs['Alpha'])
    T.put(col, b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.35
    b.inputs['Roughness'].default_value = 0.35
    return m


def figure_mesh(name, mats, hakama=False):
    """A walker in kimono, ~1.7 m, facing -Y: the robe (vermilion hakama below the obi if asked), the sleeves, the
    head and the mask card in front of it."""
    robe, red, mask = mats
    B = TS.MB()
    levels = [(0.0, 0.31), (0.5, 0.27), (0.95, 0.22), (1.2, 0.2), (1.45, 0.17), (1.5, 0.08)]
    TS.cylinder(B, 0.0, 0.0, levels[:3] if hakama else levels, 18, 1 if hakama else 0, -1, cap_top=not hakama)
    if hakama:
        TS.cylinder(B, 0.0, 0.0, levels[2:], 18, 0, -1)
    for sx in (-1, 1):  # the sleeves, hanging
        TS.box(B, sx * 0.17 - 0.07, sx * 0.17 + 0.07, -0.14, 0.12, 0.72, 1.36, 0)
    TS.cylinder(B, 0.0, 0.0, [(1.5, 0.05), (1.55, 0.1), (1.66, 0.115), (1.76, 0.1), (1.82, 0.05)], 14, 0, -1)  # the head
    me = B.mesh(name, [robe, red])
    # the mask: a card curved round the face (UV 0..1 over the painted sheet)
    bm_mask = TS.MB()
    cols, rows = 6, 6
    grid = []
    for j in range(rows + 1):
        row = []
        for i in range(cols + 1):
            u, v = i / cols, j / rows
            x = (u - 0.5) * 0.24
            row.append(bm_mask.v((x, -0.125 + 0.06 * x * x / 0.0144 * 0.5, 1.54 + v * 0.3)))
        grid.append(row)
    for j in range(rows):
        for i in range(cols):
            bm_mask.face([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], [(i / cols, j / rows), ((i + 1) / cols, j / rows), ((i + 1) / cols, (j + 1) / rows), (i / cols, (j + 1) / rows)], 0)
    mm = bm_mask.mesh(name + '_mask', [mask])
    return me, mm


def procession(coll, n=8):
    """n walkers (meshes and their masks as one object each, the lantern bearers' lanterns with a warm light).
    Returns [(body, mask, light or None)]."""
    mats = (TS.principled_dark('robe', '#17100f'), TS.principled_dark('hakama', '#8E1F14'), mat_mask())
    paper = bpy.data.materials.get('lamp_paper')
    out = []
    for i in range(n):
        me, mm = figure_mesh(f'walker.{i}', mats, hakama=(i % 3 == 1))
        body = bpy.data.objects.new(f'walker.{i}', me)
        coll.objects.link(body)
        mask = bpy.data.objects.new(f'walkerM.{i}', mm)
        coll.objects.link(mask)
        mask.parent = body
        L = None
        if i % 2 == 0:  # a paper lantern on a pole, held forward
            B = TS.MB()
            TS.box(B, 0.2, 0.22, -0.32, -0.3, 0.9, 1.9, 0)
            TS.cylinder(B, 0.21, -0.32, [(1.55, 0.07), (1.62, 0.09), (1.74, 0.09), (1.8, 0.07)], 12, 1, -1, cap_bot=True)
            lm = B.mesh(f'lantern.{i}', [mats[0], paper] if paper else [mats[0]])
            lo = bpy.data.objects.new(f'lantern.{i}', lm)
            coll.objects.link(lo)
            lo.parent = body
            ld = bpy.data.lights.new(f'lanternL.{i}', 'POINT')
            ld.energy, ld.color, ld.shadow_soft_size = 4.5, (1.0, 0.72, 0.42), 0.06
            L = bpy.data.objects.new(f'lanternL.{i}', ld)
            coll.objects.link(L)
            L.parent = body
            L.location = (0.21, -0.32, 1.68)
        out.append((body, mask, L))
    return out
