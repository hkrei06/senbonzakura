# The tunnel's moving parts, all procedural in geometry nodes so Cycles' motion blur sees them move: the petals in the
# air (a clock for their fall and flutter and a wind for their drift, both keyed by the shots module per frame), the
# petals fallen on the path, and the title (千本桜 in gold, a glyph lighting on each sung syllable) that bursts into
# petals. Nothing here reads the time itself: the shots module keys every input from song time.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix
import tunnel_set as TS
from tunnel_set import NT, new_mat, rgba, hexlin

ROOT = os.path.dirname(TS.HERE)


# ------------------------------------------------------------------ geometry-node helpers
class GN:
    def __init__(self, name):
        self.ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
        self.N, self.L = self.ng.nodes, self.ng.links
        self.ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
        self.ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
        self.gi = self.N.new('NodeGroupInput')
        self.go = self.N.new('NodeGroupOutput')

    def inp(self, name, kind, default=None):
        s = self.ng.interface.new_socket(name, in_out='INPUT', socket_type='NodeSocket' + kind)
        if default is not None:
            s.default_value = default
        return self.gi.outputs[name]

    def out(self, geo):
        self.L.new(geo, self.go.inputs['Geometry'])

    def node(self, kind, **props):
        n = self.N.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        return n

    def put(self, v, inp):
        if isinstance(v, bpy.types.NodeSocket):
            self.L.new(v, inp)
        elif v is not None:
            inp.default_value = v

    def math(self, op, a, b=None, c=None):
        n = self.node('ShaderNodeMath', operation=op)
        for k, v in enumerate((a, b, c)):
            self.put(v, n.inputs[k])
        return n.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        n = self.node('ShaderNodeVectorMath', operation=op)
        self.put(a, n.inputs[0])
        if b is not None:
            self.put(b, n.inputs[1])
        if scale is not None:
            self.put(scale, n.inputs['Scale'])
        return n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else n.outputs['Vector']

    def combine(self, x, y, z):
        n = self.node('ShaderNodeCombineXYZ')
        for k, v in enumerate((x, y, z)):
            self.put(v, n.inputs[k])
        return n.outputs[0]

    def xyz(self, v):
        n = self.node('ShaderNodeSeparateXYZ')
        self.put(v, n.inputs[0])
        return n.outputs['X'], n.outputs['Y'], n.outputs['Z']

    def rand(self, lo, hi, seed, kind='FLOAT', ident=None):
        n = self.node('FunctionNodeRandomValue', data_type=kind)
        self.put(lo, n.inputs['Min'])
        self.put(hi, n.inputs['Max'])
        n.inputs['Seed'].default_value = seed
        if ident is not None:
            self.put(ident, n.inputs['ID'])
        return n.outputs['Value']

    def smooth(self, e0, e1, x):
        n = self.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP', clamp=True)
        self.put(x, n.inputs['Value'])
        lo, hi = (e0, e1) if e0 < e1 else (e1, e0)
        self.put(lo, n.inputs['From Min'])
        self.put(hi, n.inputs['From Max'])
        n.inputs['To Min'].default_value, n.inputs['To Max'].default_value = (0.0, 1.0) if e0 < e1 else (1.0, 0.0)
        return n.outputs['Result']

    def objgeo(self, sock):
        n = self.node('GeometryNodeObjectInfo', transform_space='RELATIVE')
        self.put(sock, n.inputs['Object'])
        return n.outputs['Geometry']

    def instance(self, points, inst, rot_euler, scale):
        e2r = self.node('FunctionNodeEulerToRotation')
        self.put(rot_euler, e2r.inputs['Euler'])
        n = self.node('GeometryNodeInstanceOnPoints')
        self.put(points, n.inputs['Points'])
        self.put(inst, n.inputs['Instance'])
        self.put(e2r.outputs[0], n.inputs['Rotation'])
        self.put(scale, n.inputs['Scale'])
        return n.outputs['Instances']

    def realize(self, geo):
        n = self.node('GeometryNodeRealizeInstances')
        self.put(geo, n.inputs['Geometry'])
        return n.outputs['Geometry']

    def material(self, geo, mat):
        n = self.node('GeometryNodeSetMaterial')
        self.put(geo, n.inputs['Geometry'])
        n.inputs['Material'].default_value = mat
        return n.outputs['Geometry']

    def store(self, geo, name, value, kind='FLOAT', domain='POINT'):
        n = self.node('GeometryNodeStoreNamedAttribute', data_type=kind, domain=domain)
        self.put(geo, n.inputs['Geometry'])
        n.inputs['Name'].default_value = name
        self.put(value, n.inputs['Value'])
        return n.outputs['Geometry']

    def path_point(self, curve_geo, s, a, h, s_origin):
        """World position s along the path, a to the right, h up (sampled from the path curve)."""
        sc = self.node('GeometryNodeSampleCurve', mode='LENGTH')
        self.put(curve_geo, sc.inputs['Curves'])
        self.put(self.math('SUBTRACT', s, s_origin), sc.inputs['Length'])
        tx, ty, _ = self.xyz(sc.outputs['Tangent'])
        right = self.vmath('NORMALIZE', self.combine(ty, self.math('MULTIPLY', tx, -1.0), 0.0))
        p = self.vmath('ADD', sc.outputs['Position'], self.vmath('SCALE', right, scale=a))
        return self.vmath('ADD', p, self.combine(0.0, 0.0, h))


def _new_api(md):
    return hasattr(md, 'properties') and hasattr(md.properties, 'inputs')  # Blender 5.x: md.properties.inputs.<id>.value


def set_input(md, name, v):
    ident = md.node_group.interface.items_tree[name].identifier
    if _new_api(md):
        getattr(md.properties.inputs, ident).value = v
    else:
        md[ident] = v


def modifier(ob, ng, **inputs):
    md = ob.modifiers.new(ng.name, 'NODES')
    md.node_group = ng
    for k, v in inputs.items():
        set_input(md, k, v)
    return md


def input_path(md, name):
    """The data path of a geometry-nodes modifier input (for keyframes), on the object."""
    ident = md.node_group.interface.items_tree[name].identifier
    if _new_api(md):
        return f'modifiers["{md.name}"].properties.inputs.{ident}.value'
    return f'modifiers["{md.name}"]["{ident}"]'


def host(name, coll):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


# ------------------------------------------------------------------ the petal
def petal_mesh():
    """A sakura petal, 15 x 12 mm: obovate, notched at the tip, cupped across and curled a little along."""
    bm = bmesh.new()
    L, W = 0.015, 0.0122
    # the right half of the outline (x across in units of W, y along in units of L), base to the notch
    half = [(0.0, 0.0), (0.18, 0.08), (0.33, 0.25), (0.45, 0.45), (0.5, 0.62), (0.48, 0.78), (0.4, 0.9), (0.28, 0.98),
            (0.15, 1.0), (0.06, 0.95), (0.0, 0.88)]
    ring = half + [(-x, y) for x, y in reversed(half[1:-1])]
    co = lambda x, y: (x * W, (y - 0.5) * L, 40.0 * (x * W) ** 2 + 6.0 * ((y - 0.5) * L) ** 2)
    vs = [bm.verts.new(co(x, y)) for x, y in ring]
    c = bm.verts.new(co(0.0, 0.5))
    for i in range(len(vs)):
        bm.faces.new((c, vs[i], vs[(i + 1) % len(vs)]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('petal')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return me


def mat_petal():
    """Pale sakura pink, thin and translucent (a lamp behind a petal shows through it), warm gold while 'heat' > 0
    (the petals the title bursts into start as sparks)."""
    m = new_mat('petal')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    out = next(n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
    rnd = T.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='tint').outputs['Fac']
    gen = T.coords()['Generated']
    _, gy, _ = T.xyz(gen)
    base = T.mix(rnd, rgba('#F7C3D3'), rgba('#EE9DB8'))
    base = T.mix(T.smooth(0.35, 0.0, gy), base, rgba('#E894AE'))  # deeper pink at the base of the petal
    T.put(base, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.48
    b.inputs['Specular IOR Level'].default_value = 0.35
    b.inputs['Sheen Weight'].default_value = 0.4
    heat = T.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='heat').outputs['Fac']
    T.put(T.mix(heat, rgba('#FFB3C9'), rgba('#FF9A45')), b.inputs['Emission Color'])
    T.put(T.math('MULTIPLY_ADD', heat, 5.0, 0.16), b.inputs['Emission Strength'])
    tr = T.node('ShaderNodeBsdfTranslucent')
    T.put(base, tr.inputs['Color'])
    mx = T.node('ShaderNodeMixShader')
    mx.inputs['Fac'].default_value = 0.38
    T.put(b.outputs[0], mx.inputs[1])
    T.put(tr.outputs[0], mx.inputs[2])
    T.put(mx.outputs[0], out.inputs['Surface'])
    return m


# the title's gold (AgX bleaches a bright emission to cream: the inner light stays low and saturated, the metal's
# reflections carry the gold)
GOLD = {'base': '#D9A846', 'rough': 0.14, 'rough_var': 0.18, 'glow': '#FFB21E', 'glow_k': 2.0}


def mat_gold():
    """The title: gold leaf over lacquer (hammered: the roughness varies), lit from within by 'ignite' (keyed per glyph
    object: 0 dark … 1 just struck)."""
    m = new_mat('title_gold')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    tc = T.coords()
    ham = T.noise(tc['Object'], 38.0, 5.0, 0.6)
    b.inputs['Base Color'].default_value = rgba(GOLD['base'])
    b.inputs['Metallic'].default_value = 1.0
    T.put(T.math('MULTIPLY_ADD', ham, GOLD['rough_var'], GOLD['rough']), b.inputs['Roughness'])
    T.put(T.bump(ham, 0.12, 0.002), b.inputs['Normal'])
    ig = T.node('ShaderNodeAttribute', attribute_type='OBJECT', attribute_name='ignite').outputs['Fac']
    b.inputs['Emission Color'].default_value = rgba(GOLD['glow'])
    T.put(T.math('MULTIPLY', T.math('POWER', ig, 2.0), GOLD['glow_k']), b.inputs['Emission Strength'])
    return m


# ------------------------------------------------------------------ the path curve the petals follow
def path_curve(coll, s0=TS.S_FIRST - 4, s1=TS.S_LAST + 4, ds=0.25):
    cu = bpy.data.curves.new('path_curve', 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    n = int(round((s1 - s0) / ds))
    sp.points.add(n)
    for i in range(n + 1):
        p = TS.PATH.pos(s0 + (s1 - s0) * i / n)
        sp.points[i].co = (p.x, p.y, p.z, 1.0)
    ob = bpy.data.objects.new('path_curve', cu)
    coll.objects.link(ob)
    ob.hide_render = True
    ob['s0'] = s0
    return ob


# ------------------------------------------------------------------ petals in the air
def air_petals(coll, path_ob, petal_ob, mat, count=6000, s0=-3.0, s1=42.0, seed=7):
    """Petals hanging and drifting in the tunnel between s0 and s1. Inputs keyed per frame: Clock (s of fall and
    flutter: it stops when the song freezes), Wind (m the air has carried them along the tunnel, + = away)."""
    G = GN('petal_air')
    path = G.inp('Path', 'Object')
    petal = G.inp('Petal', 'Object')
    clock = G.inp('Clock', 'Float', 0.0)
    wind = G.inp('Wind', 'Float', 0.0)
    cnt = G.inp('Count', 'Int', count)
    S0, S1 = G.inp('S0', 'Float', s0), G.inp('S1', 'Float', s1)
    pts = G.node('GeometryNodePoints')
    G.put(cnt, pts.inputs['Count'])
    idx = G.node('GeometryNodeInputIndex').outputs[0]
    R = lambda lo, hi, k, kind='FLOAT': G.rand(lo, hi, seed * 100 + k, kind, idx)
    sb, a0, h0 = R(0.0, 1.0, 1), R(-0.8, 0.8, 2), R(0.0, 2.75, 3)
    vz, ph, wk, size = R(0.14, 0.36, 4), R(0.0, 6.283, 5), R(0.75, 1.25, 6), R(0.7, 1.3, 7)
    rot0 = R((0.0, 0.0, 0.0), (6.283, 6.283, 6.283), 8, 'FLOAT_VECTOR')
    spin = R((-2.6, -2.6, -2.6), (2.6, 2.6, 2.6), 9, 'FLOAT_VECTOR')
    span = G.math('SUBTRACT', S1, S0)
    # height: falls at vz, re-enters at the roof (the petals come in through the gaps between the kasagi)
    h = G.math('ADD', 0.04, G.math('FLOORED_MODULO', G.math('SUBTRACT', h0, G.math('MULTIPLY', vz, clock)), 2.75))
    # along: carried by the wind, swaying; wrapped into [S0, S1] where nobody looks (scaled to nothing at the seam)
    sway = G.math('MULTIPLY', 0.06, G.math('SINE', G.math('MULTIPLY_ADD', clock, 1.7, ph)))
    s_raw = G.math('ADD', G.math('MULTIPLY_ADD', sb, span, G.math('MULTIPLY', wind, wk)), sway)
    s = G.math('ADD', S0, G.math('FLOORED_MODULO', G.math('SUBTRACT', s_raw, S0), span))
    a = G.math('ADD', a0, G.math('MULTIPLY', 0.09, G.math('SINE', G.math('MULTIPLY_ADD', clock, 0.9, G.math('MULTIPLY', ph, 1.3)))))
    pos = G.path_point(G.objgeo(path), s, a, h, path_ob['s0'])
    sp = G.node('GeometryNodeSetPosition')
    G.put(pts.outputs[0], sp.inputs['Geometry'])
    G.put(pos, sp.inputs['Position'])
    fade = G.math('MULTIPLY', G.smooth(0.04, 0.2, h), G.smooth(2.79, 2.6, h))
    fade = G.math('MULTIPLY', fade, G.math('MULTIPLY', G.smooth(0.0, 1.5, G.math('SUBTRACT', s, S0)), G.smooth(0.0, 1.5, G.math('SUBTRACT', S1, s))))
    rot = G.vmath('ADD', rot0, G.vmath('SCALE', spin, scale=clock))
    geo = G.store(sp.outputs['Geometry'], 'tint', R(0.0, 1.0, 10))
    inst = G.instance(geo, G.objgeo(petal), rot, G.math('MULTIPLY', G.math('MULTIPLY', size, 1.35), fade))
    G.out(G.material(G.realize(inst), mat))
    ob = host('petals_air', coll)
    md = modifier(ob, G.ng, Path=path_ob, Petal=petal_ob)
    return ob, md


# ------------------------------------------------------------------ petals falling outside (a box in the world)
def box_petals(coll, petal_ob, mat, centre, size, count=4000, seed=17):
    """Petals falling and drifting in a world-space box (outside shots): Clock (fall, flutter) and Wind (a world
    vector of metres the air has carried them) keyed per frame; wrapped inside the box, shrunk to nothing at its walls."""
    G = GN('petal_box')
    petal = G.inp('Petal', 'Object')
    clock = G.inp('Clock', 'Float', 0.0)
    wx, wy = G.inp('WindX', 'Float', 0.0), G.inp('WindY', 'Float', 0.0)
    pts = G.node('GeometryNodePoints')
    pts.inputs['Count'].default_value = count
    idx = G.node('GeometryNodeInputIndex').outputs[0]
    R = lambda lo, hi, k, kind='FLOAT': G.rand(lo, hi, seed * 100 + k, kind, idx)
    sx, sy, sz = size
    u, v, w0 = R(0.0, 1.0, 1), R(0.0, 1.0, 2), R(0.0, 1.0, 3)
    vz, ph, wk, sc = R(0.5, 1.1, 4), R(0.0, 6.283, 5), R(0.7, 1.3, 6), R(0.9, 1.6, 7)

    def wrap(f, d, k):  # 0..1 position along an axis after drifting d metres (box size k)
        return G.math('FLOORED_MODULO', G.math('ADD', f, G.math('DIVIDE', d, k)), 1.0)
    fx = wrap(u, G.math('ADD', G.math('MULTIPLY', wx, wk), G.math('MULTIPLY', 0.4, G.math('SINE', G.math('MULTIPLY_ADD', clock, 0.8, ph)))), sx)
    fy = wrap(v, G.math('MULTIPLY', wy, wk), sy)
    fz = wrap(w0, G.math('MULTIPLY', G.math('MULTIPLY', vz, clock), -1.0), sz)
    pos = G.combine(G.math('MULTIPLY_ADD', fx, sx, centre[0] - sx / 2), G.math('MULTIPLY_ADD', fy, sy, centre[1] - sy / 2),
                    G.math('MULTIPLY_ADD', fz, sz, centre[2] - sz / 2))
    edge = lambda f: G.math('MULTIPLY', G.smooth(0.0, 0.06, f), G.smooth(1.0, 0.94, f))
    fade = G.math('MULTIPLY', G.math('MULTIPLY', edge(fx), edge(fy)), edge(fz))
    sp = G.node('GeometryNodeSetPosition')
    G.put(pts.outputs[0], sp.inputs['Geometry'])
    G.put(pos, sp.inputs['Position'])
    rot = G.vmath('ADD', R((0.0, 0.0, 0.0), (6.283, 6.283, 6.283), 8, 'FLOAT_VECTOR'), G.vmath('SCALE', R((-3.0, -3.0, -3.0), (3.0, 3.0, 3.0), 9, 'FLOAT_VECTOR'), scale=clock))
    geo = G.store(sp.outputs['Geometry'], 'tint', R(0.0, 1.0, 10))
    inst = G.instance(geo, G.objgeo(petal), rot, G.math('MULTIPLY', sc, fade))
    G.out(G.material(G.realize(inst), mat))
    ob = host('petals_box', coll)
    md = modifier(ob, G.ng, Petal=petal_ob)
    return ob, md


def petal_source(coll):
    """The petal mesh object (hidden) and its material, for the petal systems."""
    ob = bpy.data.objects.get('petal_src')
    if ob:
        return ob, bpy.data.materials['petal']
    ob = bpy.data.objects.new('petal_src', petal_mesh())
    coll.objects.link(ob)
    ob.hide_render = True
    ob.hide_viewport = True
    return ob, mat_petal()


# ------------------------------------------------------------------ petals on the path
def floor_petals(coll, ground_ob, petal_ob, mat, density=260.0, seed=3):
    """Fallen petals on the flagstones: thick along the pillars, thin down the worn middle, in drifts."""
    G = GN('petal_floor')
    ground = G.inp('Ground', 'Object')
    petal = G.inp('Petal', 'Object')
    uv = G.node('GeometryNodeInputNamedAttribute', data_type='FLOAT_VECTOR')
    uv.inputs['Name'].default_value = 'UVMap'
    u, _, _ = G.xyz(uv.outputs['Attribute'])
    a = G.math('ABSOLUTE', G.math('MULTIPLY', u, 1.8))
    pos = G.node('GeometryNodeInputPosition').outputs[0]
    nz = G.node('ShaderNodeTexNoise')
    G.put(pos, nz.inputs['Vector'])
    nz.inputs['Scale'].default_value = 0.9
    nz.inputs['Detail'].default_value = 3.0
    drift = G.smooth(0.38, 0.62, nz.outputs['Fac'])
    mask = G.math('MULTIPLY', G.math('ADD', 0.12, G.math('MULTIPLY', 0.88, G.smooth(0.5, 1.2, a))), G.math('ADD', 0.35, G.math('MULTIPLY', 0.65, drift)))
    dist = G.node('GeometryNodeDistributePointsOnFaces', distribute_method='POISSON')
    G.put(G.objgeo(ground), dist.inputs['Mesh'])
    dist.inputs['Distance Min'].default_value = 0.004
    dist.inputs['Density Max'].default_value = density
    G.put(mask, dist.inputs['Density Factor'])
    dist.inputs['Seed'].default_value = seed
    idx = G.node('GeometryNodeInputIndex').outputs[0]
    rot = G.combine(G.rand(-0.35, 0.35, 11, 'FLOAT', idx), G.rand(-0.35, 0.35, 12, 'FLOAT', idx), G.rand(0.0, 6.283, 13, 'FLOAT', idx))
    sp = G.node('GeometryNodeSetPosition')
    G.put(dist.outputs['Points'], sp.inputs['Geometry'])
    G.put(G.combine(0.0, 0.0, 0.002), sp.inputs['Offset'])
    geo = G.store(sp.outputs['Geometry'], 'tint', G.rand(0.0, 1.0, 14, 'FLOAT', idx))
    inst = G.instance(geo, G.objgeo(petal), rot, G.rand(0.8, 1.15, 15, 'FLOAT', idx))
    G.out(G.material(inst, mat))
    ob = host('petals_floor', coll)
    modifier(ob, G.ng, Ground=ground_ob, Petal=petal_ob)
    return ob


# ------------------------------------------------------------------ the title and its burst
TITLE_FONT = os.path.join(ROOT, 'app', 'public', 'fonts', 'NotoSerifSC-900.ttf')


def glyph(name, ch, size, mat, coll):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = ch
    cu.font = bpy.data.fonts.load(TITLE_FONT, check_existing=True)
    cu.size = size
    cu.extrude = 0.024
    cu.bevel_depth = 0.011
    cu.bevel_resolution = 4
    cu.offset = -0.011
    cu.resolution_u = 12
    cu.align_x, cu.align_y = 'CENTER', 'CENTER'
    tmp = bpy.data.objects.new(name + '_tmp', cu)
    coll.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    me.name = name
    me.transform(Matrix.Rotation(math.radians(90), 4, 'X'))  # standing: the face toward -Y (the approach), up +Z
    xs = [v.co.x for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    me.transform(Matrix.Translation((-(min(xs) + max(xs)) / 2, 0.0, -(min(zs) + max(zs)) / 2)))
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob['ignite'] = 0.0
    return ob


def title(coll, text, s, centre_h=1.32, size=0.62, gap=0.035):
    """The title standing in the tunnel at s, set vertically (one glyph object each, top to bottom), with a light in
    front of each glyph for its strike. Returns (glyph objects, lights)."""
    mat = mat_gold()
    obs, lights = [], []
    n = len(text)
    pitch = size * 0.92 + gap
    for i, ch in enumerate(text):
        h = centre_h + (n - 1) / 2 * pitch - i * pitch
        ob = glyph(f'title.{i}', ch, size, mat, coll)
        ob.matrix_world = TS.PATH.matrix(s, 0.0, h)
        obs.append(ob)
        L = bpy.data.lights.new(f'titleL.{i}', 'POINT')
        L.energy = 0.0
        L.color = hexlin('#FFC874')
        L.shadow_soft_size = 0.18
        lo = bpy.data.objects.new(f'titleL.{i}', L)
        coll.objects.link(lo)
        lo.matrix_world = TS.PATH.matrix(s + 0.32, 0.0, h)
        lights.append(lo)
    return obs, lights


def burst(coll, glyphs, petal_ob, mat, toward, density=9000.0, seed=21):
    """The title bursting into petals: points on the glyphs' faces fly out (mostly toward the camera, `toward` a world
    vector), slowed by the air, tumbling, glowing gold at first. Input keyed per frame: Tau (s since the burst, 0
    before: they are hidden)."""
    G = GN('petal_burst')
    petal = G.inp('Petal', 'Object')
    tau = G.inp('Tau', 'Float', 0.0)
    geos = []
    for i, gob in enumerate(glyphs):
        sock = G.inp(f'Glyph{i}', 'Object')
        geos.append(G.objgeo(sock))
    join = G.node('GeometryNodeJoinGeometry')
    for g in reversed(geos):
        G.put(g, join.inputs[0])
    dist = G.node('GeometryNodeDistributePointsOnFaces', distribute_method='RANDOM')
    G.put(join.outputs[0], dist.inputs['Mesh'])
    dist.inputs['Density'].default_value = density  # per m² of glyph surface (front, back and sides): ~10 000 petals
    dist.inputs['Seed'].default_value = seed
    idx = G.node('GeometryNodeInputIndex').outputs[0]
    R = lambda lo, hi, k, kind='FLOAT': G.rand(lo, hi, seed * 100 + k, kind, idx)
    nrm = dist.outputs['Normal']
    jit = R((-1.0, -1.0, -0.6), (1.0, 1.0, 1.0), 1, 'FLOAT_VECTOR')
    dirv = G.vmath('NORMALIZE', G.vmath('ADD', G.vmath('ADD', G.vmath('SCALE', nrm, scale=0.5), jit), toward * 1.4))
    speed = R(2.0, 7.5, 2)
    k = R(1.0, 2.0, 3)
    # v(tau) = V (1 - e^(-25 tau)) e^(-k tau): the strokes shed their petals over the first frames, then the air slows
    # them; integrated: V [ (1 - e^(-k tau)) / k - (1 - e^(-(k+25) tau)) / (k + 25) ]
    def reach_of(kk):
        return G.math('DIVIDE', G.math('SUBTRACT', 1.0, G.math('EXPONENT', G.math('MULTIPLY', G.math('MULTIPLY', kk, tau), -1.0))), kk)
    reach = G.math('SUBTRACT', reach_of(k), reach_of(G.math('ADD', k, 25.0)))
    off = G.vmath('SCALE', dirv, scale=G.math('MULTIPLY', speed, reach))
    ph = R(0.0, 6.283, 4)
    flut = G.combine(G.math('MULTIPLY', 0.08, G.math('SINE', G.math('MULTIPLY_ADD', tau, 5.0, ph))), 0.0,
                     G.math('SUBTRACT', G.math('MULTIPLY', 0.05, G.math('SINE', G.math('MULTIPLY_ADD', tau, 3.7, ph))), G.math('MULTIPLY', 0.12, tau)))
    sp = G.node('GeometryNodeSetPosition')
    G.put(dist.outputs['Points'], sp.inputs['Geometry'])
    G.put(G.vmath('ADD', off, flut), sp.inputs['Offset'])
    rot = G.vmath('ADD', R((0.0, 0.0, 0.0), (6.283, 6.283, 6.283), 5, 'FLOAT_VECTOR'), G.vmath('SCALE', R((-9.0, -9.0, -9.0), (9.0, 9.0, 9.0), 6, 'FLOAT_VECTOR'), scale=tau))
    show = G.math('MULTIPLY', G.smooth(0.0, 0.012, tau), G.smooth(4.5, 3.0, tau))
    geo = G.store(sp.outputs['Geometry'], 'heat', G.math('EXPONENT', G.math('MULTIPLY', tau, R(-10.0, -4.0, 7))))
    geo = G.store(geo, 'tint', R(0.0, 1.0, 8))
    inst = G.instance(geo, G.objgeo(petal), rot, G.math('MULTIPLY', show, R(1.3, 2.1, 9)))  # (bigger than life: they must read)
    G.out(G.material(G.realize(inst), mat))
    ob = host('petals_burst', coll)
    kw = {'Petal': petal_ob}
    for i, gob in enumerate(glyphs):
        kw[f'Glyph{i}'] = gob
    md = modifier(ob, G.ng, **kw)
    return ob, md


def petal_title(coll, glyphs, petal_ob, mat, toward, density=8000.0, seed=31):
    """The title written in petals (chorus 3a): petals drifting in from up to ~2.5 m round each glyph settle onto its
    faces as its Gather{i} runs 0→1, glowing faintly (Glow); after the release (Rise: s since it) they peel off one by
    one, the top glyph first, and lift (0.6 m/s), loosening into the air tumbling, drifting toward the lens (`toward`,
    a world vector), and fade. Keyed: Gather0.., Glow, Rise, Clock."""
    G = GN('petal_title')
    petal = G.inp('Petal', 'Object')
    rise, clock, glow = G.inp('Rise', 'Float', 0.0), G.inp('Clock', 'Float', 0.0), G.inp('Glow', 'Float', 0.0)
    join = G.node('GeometryNodeJoinGeometry')
    for i, gob in enumerate(glyphs):
        gs, gat = G.inp(f'Glyph{i}', 'Object'), G.inp(f'Gather{i}', 'Float', 0.0)
        dist = G.node('GeometryNodeDistributePointsOnFaces', distribute_method='RANDOM')
        G.put(G.objgeo(gs), dist.inputs['Mesh'])
        dist.inputs['Density'].default_value = density
        dist.inputs['Seed'].default_value = seed + i
        idx = G.node('GeometryNodeInputIndex').outputs[0]
        R = lambda lo, hi, k, kind='FLOAT': G.rand(lo, hi, (seed + i) * 100 + k, kind, idx)
        g = G.smooth(0.0, 1.0, G.math('DIVIDE', G.math('SUBTRACT', gat, R(0.0, 0.4, 1)), 0.6))  # each petal lands at its own time
        left = G.math('POWER', G.math('SUBTRACT', 1.0, g), 1.5)
        ph = R(0.0, 6.283, 3)
        a = G.math('MULTIPLY_ADD', clock, 0.9, ph)
        sw = G.combine(G.math('MULTIPLY', G.math('COSINE', a), 0.6), 0.0, G.math('MULTIPLY', G.math('SINE', a), 0.6))  # swirling in as they settle
        off = G.vmath('ADD', G.vmath('SCALE', R((-2.5, -1.5, -1.2), (2.5, 1.5, 2.2), 2, 'FLOAT_VECTOR'), scale=left), G.vmath('SCALE', sw, scale=left))
        sp = G.node('GeometryNodeSetPosition')
        G.put(dist.outputs['Points'], sp.inputs['Geometry'])
        G.put(off, sp.inputs['Offset'])
        geo = G.store(sp.outputs['Geometry'], 'g', g)
        G.put(G.store(geo, 'd', G.math('ADD', 0.45 * i, R(0.0, 1.5, 4))), join.inputs[0])  # when it lets go, after the release
    idx = G.node('GeometryNodeInputIndex').outputs[0]
    R = lambda lo, hi, k, kind='FLOAT': G.rand(lo, hi, seed * 1000 + k, kind, idx)
    g = G.node('GeometryNodeInputNamedAttribute', data_type='FLOAT')
    g.inputs['Name'].default_value = 'g'
    dl = G.node('GeometryNodeInputNamedAttribute', data_type='FLOAT')
    dl.inputs['Name'].default_value = 'd'
    rise = G.math('MAXIMUM', G.math('SUBTRACT', rise, dl.outputs['Attribute']), 0.0)  # this petal's own time since it let go
    loose = G.math('MINIMUM', rise, 1.0)
    ph = R(0.0, 6.283, 13)
    lift = G.combine(G.math('MULTIPLY', G.math('SINE', G.math('MULTIPLY_ADD', clock, 4.6, ph)), G.math('MULTIPLY', loose, 0.07)), 0.0, G.math('MULTIPLY', rise, 0.6))
    spread = G.vmath('SCALE', R((-1.0, -1.0, -0.2), (1.0, 1.0, 1.0), 11, 'FLOAT_VECTOR'), scale=G.math('MULTIPLY', G.math('POWER', rise, 1.3), 0.22))
    drift = G.vmath('SCALE', toward, scale=G.math('MULTIPLY', rise, R(0.1, 0.5, 12)))
    sp = G.node('GeometryNodeSetPosition')
    G.put(join.outputs[0], sp.inputs['Geometry'])
    G.put(G.vmath('ADD', G.vmath('ADD', lift, spread), drift), sp.inputs['Offset'])
    rot = G.vmath('ADD', R((0.0, 0.0, 0.0), (6.283, 6.283, 6.283), 14, 'FLOAT_VECTOR'), G.vmath('SCALE', R((-7.0, -7.0, -7.0), (7.0, 7.0, 7.0), 15, 'FLOAT_VECTOR'), scale=G.math('MULTIPLY', rise, 0.6)))
    show = G.math('MULTIPLY', G.smooth(0.0, 0.3, g.outputs['Attribute']), G.smooth(4.0, 2.2, rise))
    geo = G.store(sp.outputs['Geometry'], 'heat', G.math('MULTIPLY', glow, R(0.07, 0.2, 16)))
    geo = G.store(geo, 'tint', R(0.0, 1.0, 17))
    inst = G.instance(geo, G.objgeo(petal), rot, G.math('MULTIPLY', show, R(1.4, 2.3, 18)))  # (bigger than life: they must read)
    G.out(G.material(G.realize(inst), mat))
    ob = host('petals_title', coll)
    kw = {'Petal': petal_ob}
    for i, gob in enumerate(glyphs):
        kw[f'Glyph{i}'] = gob
    md = modifier(ob, G.ng, **kw)
    return ob, md


def add_all(S, title_text=None, title_s=6.2, air=6000, air_span=(-3.0, 42.0)):
    """Petals (air, floor) and, if given, the title and its burst. Adds handles to S."""
    coll = TS.coll('fx')
    pm = petal_mesh()
    petal_ob = bpy.data.objects.new('petal_src', pm)
    coll.objects.link(petal_ob)
    petal_ob.hide_render = True
    petal_ob.hide_viewport = True
    mat = mat_petal()
    path_ob = path_curve(coll)
    S['petal_air'], S['petal_air_md'] = air_petals(coll, path_ob, petal_ob, mat, count=air, s0=air_span[0], s1=air_span[1])
    S['petal_floor'] = floor_petals(coll, bpy.data.objects['path'], petal_ob, mat)
    if title_text:
        g, l = title(coll, title_text, title_s)
        S['title'], S['title_lights'] = g, l
        S['burst'], S['burst_md'] = burst(coll, g, petal_ob, mat, -TS.PATH.fwd(title_s))
    return S
