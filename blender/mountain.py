# The mountain the tunnel climbs, for the outside shots (chorus 1's aerial reveal; later the summit): the same Inari
# gates, a thousand of them, switching back up a forested spur; the lamps glow out through the slits; cedars and cherry
# trees scattered on the terrain by geometry nodes; mist pooling in the gullies; a big moon low over the top.
# build() sets tunnel_set.PATH to the mountain line (every set function reads it at call time).
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix, kdtree, noise
import tunnel_set as TS
import tunnel_fx as FX
import sakura as SK
from tunnel_set import NT, MB, new_mat, rgba, hexlin, smoothstep

S_LO, S_HI = -10.0, 400.0
MODELS = os.path.join(TS.HERE, 'models')  # Poly Haven (CC0): fir_tree_01, jacaranda_tree (Rob Tuytel, Rico Cilliers)


class MountainPath(TS.Path):
    """The line up the mountain: switchbacks (s0, s1, total turn in radians), climbing 7 % on average, steeper in
    places."""
    BENDS = [(25, 70, 1.0), (85, 140, -1.45), (155, 205, 1.25), (220, 270, -1.1), (285, 330, 0.95), (345, 380, -0.6)]

    def __init__(self):
        super().__init__(S_LO - 30, S_HI + 30)

    def kappa(self, s):
        k = 0.0
        for a, b, turn in self.BENDS:
            if a <= s <= b:
                k += turn * math.pi / (2 * (b - a)) * math.sin(math.pi * (s - a) / (b - a))
        return k

    @staticmethod
    def z(s):
        return 0.07 * s + 1.2 * math.sin(s / 23.0)

    def fwd(self, s):
        th = self.theta(s)
        return Vector((-math.sin(th), math.cos(th), self.z(s + 0.5) - self.z(s - 0.5))).normalized()


# ------------------------------------------------------------------ the land
def natural(x, y, xc=0.0):
    """The mountainside before the path was cut: rising to +Y, a spur (its crest at x = xc, where the line climbs)
    falling off into gullies either side."""
    p = Vector((x / 70.0, y / 70.0, 0.37))
    dx = x - xc
    h = 0.078 * y - 0.0038 * dx * dx / (1 + abs(dx) / 90.0)
    h += 7.0 * noise.noise(p) + 2.6 * noise.noise(p * 3.1 + Vector((4.1, 1.3, 0))) + 0.7 * noise.noise(p * 9.7)
    return h


def terrain(path, mat, x0=-260, x1=160, y0=-90, y1=440, step=2.0, summit=None, blend=7.0):
    """The terrain mesh, carved to the path (a flat bench 1.8 m either side, blending out by 7 m), with each vertex's
    distance to the path stored as 'pathd' (the forest keeps off the line). summit: (x, y, z, r0, r1), a flat top at z
    within r0 of (x, y), the ground falling away round it by r1 (the forest keeps off it too)."""
    kd = kdtree.KDTree(int((S_HI - S_LO + 10) / 0.5) + 3)
    zs = []
    s, i = S_LO - 5, 0
    while s <= S_HI + 5:
        p = path.pos(s)
        kd.insert((p.x, p.y, 0.0), i)
        zs.append(p.z)
        s += 0.5
        i += 1
    kd.balance()
    # the crest follows the line: x of the path at each y (y only grows along it: no bend turns back past 90 degrees)
    ys = [path.pos(S_LO - 5 + 0.5 * k).y for k in range(len(zs))]
    xs = [path.pos(S_LO - 5 + 0.5 * k).x for k in range(len(zs))]

    def crest(y):
        if y <= ys[0]:
            return xs[0]
        if y >= ys[-1]:
            return xs[-1]
        lo, hi = 0, len(ys) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if ys[mid] <= y:
                lo = mid
            else:
                hi = mid
        u = (y - ys[lo]) / max(ys[hi] - ys[lo], 1e-6)
        return xs[lo] + (xs[hi] - xs[lo]) * u

    nx, ny = int((x1 - x0) / step) + 1, int((y1 - y0) / step) + 1
    bm = bmesh.new()
    dl = bm.verts.layers.float.new('pathd')
    grid = []
    for j in range(ny):
        row = []
        y = y0 + j * step
        for k in range(nx):
            x = x0 + k * step
            (cx, cy, _), idx, d = kd.find((x, y, 0.0))
            h = natural(x, y, crest(y))
            dc = d
            if summit:
                sx, sy, sz, r0, r1 = summit
                dp = math.hypot(x - sx, y - sy)
                k = smoothstep(r0, r1, dp)
                h = sz * (1 - k) + min(h, sz - 0.5 * max(0.0, dp - r0)) * k
                d = min(d, max(0.0, dp - r0 + 1.0))
            h = h + (zs[idx] - 0.04 - h) * (1 - smoothstep(1.8, blend, dc))
            v = bm.verts.new((x, y, h))
            v[dl] = d
            row.append(v)
        grid.append(row)
    for j in range(ny - 1):
        for k in range(nx - 1):
            f = bm.faces.new((grid[j][k], grid[j][k + 1], grid[j + 1][k + 1], grid[j + 1][k]))
            f.smooth = True
    me = bpy.data.meshes.new('mountain')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new('mountain', me)
    TS.coll('ground').objects.link(ob)
    return ob


def ridges(mat, coll):
    """Three bands of far ridges (dark silhouettes; their own haze is in the material: farther = lighter, bluer)."""
    obs = []
    for k, (dist, height, rough) in enumerate(((700.0, 120.0, 1.0), (1300.0, 230.0, 0.7), (2400.0, 380.0, 0.5))):
        B = MB()
        n = 220
        ring_lo, ring_hi = [], []
        for i in range(n + 1):
            a = math.radians(-110 + 220 * i / n)  # in front of the line (+Y) and to the sides
            x, y = math.sin(a) * dist, math.cos(a) * dist + 200.0
            hh = height * (0.55 + 0.45 * noise.noise(Vector((i * 0.045 * rough, k * 3.7, 0.5)))) + 40 * noise.noise(Vector((i * 0.21, k, 2.0)))
            ring_lo.append(B.v((x, y, -60.0)))
            ring_hi.append(B.v((x, y, hh)))
        for i in range(n):
            B.face([ring_lo[i], ring_lo[i + 1], ring_hi[i + 1], ring_hi[i]], [(-1, -1)] * 4, 0)
        me = B.mesh(f'ridge.{k}', [mat])
        ob = bpy.data.objects.new(f'ridge.{k}', me)
        ob['far'] = k / 2.0
        coll.objects.link(ob)
        obs.append(ob)
    return obs


def mat_forest_floor():
    """Leaf litter and moss (Poly Haven brown_mud_leaves_01, projected from above in world metres), darker and lighter
    in broad patches; under the cherry trees along the line, single fallen petals."""
    m = new_mat('forest_floor')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    wpos = T.node('ShaderNodeNewGeometry').outputs['Position']
    x, y, _ = T.xyz(wpos)
    uv = T.combine(T.math('DIVIDE', x, 1.3), T.math('DIVIDE', y, 1.3), 0.0)
    d = os.path.join(TS.TEX, 'brown_mud_leaves_01')
    diff, _ = T.tex(os.path.join(d, 'brown_mud_leaves_01_diff_1k.jpg'), uv)
    rough_t, _ = T.tex(os.path.join(d, 'brown_mud_leaves_01_rough_1k.jpg'), uv, noncolor=True)
    big = T.noise(wpos, 0.06, 3.0, 0.5)
    col = T.mix(T.math('MULTIPLY_ADD', big, -0.35, 0.5), (0.0, 0.0, 0.0, 1.0), diff)  # (dark: moonlit open ground reads as frost)
    pd = T.node('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='pathd').outputs['Fac']
    under = T.smooth(17.0, 5.0, pd)
    vo = T.node('ShaderNodeTexVoronoi', feature='F1')
    T.put(wpos, vo.inputs['Vector'])
    vo.inputs['Scale'].default_value = 24.0
    petal = T.math('MULTIPLY', T.smooth(0.16, 0.06, vo.outputs['Distance']), T.smooth(0.7, 0.8, T.xyz(vo.outputs['Color'])[0]))
    col = T.mix(T.math('MULTIPLY', petal, under), col, rgba('#D8A7B6'))
    T.put(col, b.inputs['Base Color'])
    T.put(T.math('MULTIPLY_ADD', T.xyz(rough_t)[0], 0.2, 0.75), b.inputs['Roughness'])
    T.put(T.bump(T.xyz(diff)[1], 0.5, 0.02), b.inputs['Normal'])
    return m


def mat_ridge():
    """Far ridges: near-black blue, lifted toward the sky's plum with distance ('far' 0..1), the rim catching the moon."""
    m = new_mat('ridge')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    far = T.node('ShaderNodeAttribute', attribute_type='OBJECT', attribute_name='far').outputs['Fac']
    b.inputs['Base Color'].default_value = rgba('#0A0A12')
    b.inputs['Roughness'].default_value = 0.9
    b.inputs['Emission Color'].default_value = rgba('#2A2342')
    T.put(T.math('MULTIPLY_ADD', far, 0.05, 0.012), b.inputs['Emission Strength'])
    return m


def mat_foliage():
    m = new_mat('cedar_foliage')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    tc = T.coords()
    n1 = T.noise(tc['Object'], 1.6, 5.0, 0.6)
    T.put(T.mix(n1, rgba('#111A10'), rgba('#22301C')), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.7
    b.inputs['Sheen Weight'].default_value = 0.6
    b.inputs['Sheen Tint'].default_value = rgba('#9DB0D8')
    T.put(T.bump(T.noise(tc['Object'], 9.0, 4.0), 0.6, 0.08), b.inputs['Normal'])
    return m


def cedar(name, seed, coll, mats):
    """A sugi: a straight trunk and a narrow spire of drooping tiers (jagged cones), ~26 m."""
    rnd = random.Random(seed)
    H = rnd.uniform(22.0, 30.0)
    B = MB()
    TS.cylinder(B, 0.0, 0.0, [(0.0, 0.34), (H * 0.3, 0.26), (H * 0.7, 0.16), (H, 0.05)], 10, 0, 0)
    trunk = B.mesh(name + '_trunk', [mats['bark']])
    bm = bmesh.new()
    tiers = 17
    for t in range(tiers):
        u = t / (tiers - 1)
        z0 = H * (0.26 + 0.68 * u)
        r = (2.5 * (1 - u) ** 0.85 + 0.3) * rnd.uniform(0.8, 1.2)
        hgt = 2.6 * (1 - 0.45 * u)
        seg = 15
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg + rnd.uniform(-0.15, 0.15)
            rr = r * rnd.uniform(0.7, 1.25)
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z0 - rr * 0.25)))
        top = bm.verts.new((rnd.uniform(-0.1, 0.1), rnd.uniform(-0.1, 0.1), z0 + hgt))
        core = bm.verts.new((0.0, 0.0, z0 + 0.15))
        for k in range(seg):
            bm.faces.new((ring[k], ring[(k + 1) % seg], top))
            bm.faces.new((ring[(k + 1) % seg], ring[k], core))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + '_crown')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats['foliage'])
    c = bpy.data.collections.new(name)
    coll.children.link(c)
    for nm, data in ((name + '_trunk', trunk), (name + '_crown', me)):
        c.objects.link(bpy.data.objects.new(nm, data))
    return c


def sources(mats):
    """The tree variants the forest instances (hidden: only their instances render)."""
    src = bpy.data.collections.new('tree_src')
    bpy.context.scene.collection.children.link(src)
    cedars = bpy.data.collections.new('cedar_src')
    src.children.link(cedars)
    for k in range(4):
        cedar(f'cedar_v{k}', 300 + k, cedars, mats)
    sakuras = bpy.data.collections.new('sakura_src')
    src.children.link(sakuras)
    puffs = [SK.puff_mesh(k) for k in range(5)]
    for me in puffs:
        me.materials.append(mats['blossom'])
    for k in range(5):
        c = bpy.data.collections.new(f'sakura_v{k}')
        sakuras.children.link(c)
        SK.tree(f'sakura_v{k}', Vector((0, 0, -0.1)), 700 + k * 17, 1.0 + 0.12 * k, c, {'bark': mats['sbark']}, puffs)
    # the sources render only as the forest's instances: their collection is excluded from the view layer
    lc = find_layer(bpy.context.view_layer.layer_collection, 'tree_src')
    if lc:
        lc.exclude = True
    return cedars, sakuras


def find_layer(lc, name):
    if lc.name == name:
        return lc
    for ch in lc.children:
        r = find_layer(ch, name)
        if r:
            return r
    return None


def append_collection(path, name):
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.collections = [name]
    return dst.collections[0]


def blossom_leaves(m):
    """The scanned jacaranda's leaves made night cherry blossom: the leaf texture's green turned pale pink (its
    shading and cut-outs kept)."""
    nt = m.node_tree
    img = next(n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image and 'leaves_diff' in n.image.name)
    targets = [l.to_socket for l in img.outputs['Color'].links]
    hs = nt.nodes.new('ShaderNodeHueSaturation')
    hs.inputs['Hue'].default_value = 0.12  # (0.5 = no shift) green ~0.27 to pink ~0.89 is +0.62, i.e. -0.38: 0.5 - 0.38
    hs.inputs['Saturation'].default_value = 0.55
    hs.inputs['Value'].default_value = 2.8
    nt.links.new(img.outputs['Color'], hs.inputs['Color'])
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    ins = {x.identifier: x for x in mx.inputs}
    ins['Factor_Float'].default_value = 0.6
    nt.links.new(hs.outputs['Color'], ins['A_Color'])
    ins['B_Color'].default_value = rgba('#F7D3DE')
    res = {x.identifier: x for x in mx.outputs}['Result_Color']
    for t in targets:
        nt.links.new(res, t)


def scanned_sources():
    """The forest's tree variants from Poly Haven's scans: three firs for the sugi (scaled to ~26 m), the jacaranda
    for the cherry (scaled to ~10 m across, its leaves turned to blossom). Excluded from the view layer: they render
    only as the forest's instances."""
    src = bpy.data.collections.new('tree_src')
    bpy.context.scene.collection.children.link(src)
    cedars = bpy.data.collections.new('cedar_src')
    sakuras = bpy.data.collections.new('sakura_src')
    src.children.link(cedars)
    src.children.link(sakuras)
    fir = append_collection(os.path.join(MODELS, 'fir_tree_01', 'fir_tree_01_1k.blend'), 'fir_tree_01_LOD2')
    for ob in list(fir.objects):
        fir.objects.unlink(ob)
        ob.location = (0.0, 0.0, 0.0)
        ob.data.transform(Matrix.Scale(1.35, 4))
        cedars.objects.link(ob)
    bpy.data.collections.remove(fir)
    jac = append_collection(os.path.join(MODELS, 'jacaranda_tree', 'jacaranda_tree_1k.blend'), 'jacaranda_tree_LOD1')
    tree_c = bpy.data.collections.new('sakura_jac')  # the tree and its lamp, instanced together
    sakuras.children.link(tree_c)
    for ob in list(jac.objects):
        jac.objects.unlink(ob)
        ob.location = (0.0, 0.0, 0.0)
        ob.data.transform(Matrix.Scale(0.42, 4))
        tree_c.objects.link(ob)
        for slot in ob.material_slots:
            if slot.material and 'leaves' in slot.material.name:
                blossom_leaves(slot.material)
    bpy.data.collections.remove(jac)
    # yozakura: each cherry tree lit from below by its own lamp (instanced with the tree)
    up = bpy.data.lights.new('sakura_uplight', 'SPOT')
    up.energy = MLOOK['uplight']
    up.color = hexlin('#FFE6E2')
    up.spot_size = math.radians(95)
    up.spot_blend = 0.6
    up.shadow_soft_size = 0.25
    lo = bpy.data.objects.new('sakura_uplight', up)
    lo.location = (0.9, 0.4, 0.35)
    lo.rotation_mode = 'QUATERNION'
    lo.rotation_quaternion = Vector((-0.08, -0.05, 1.0)).normalized().to_track_quat('-Z', 'Y')  # up into the crown
    tree_c.objects.link(lo)
    lc = find_layer(bpy.context.view_layer.layer_collection, 'tree_src')
    if lc:
        lc.exclude = True
    return cedars, sakuras


def forest(terr, cedars, sakuras):
    """Cedars everywhere but near the line, cherry trees close to it (the line was planted with them), on the
    terrain by geometry nodes (Poisson spacing, random variant, turn and size)."""
    G = FX.GN('forest')
    cin = G.inp('Cedars', 'Collection')
    sin_ = G.inp('Sakuras', 'Collection')
    land = G.gi.outputs['Geometry']
    pd = G.node('GeometryNodeInputNamedAttribute', data_type='FLOAT')
    pd.inputs['Name'].default_value = 'pathd'
    d = pd.outputs['Attribute']
    pos = G.node('GeometryNodeInputPosition').outputs[0]
    nz = G.node('ShaderNodeTexNoise')
    G.put(pos, nz.inputs['Vector'])
    nz.inputs['Scale'].default_value = 0.012
    nz.inputs['Detail'].default_value = 3.0
    clump = G.smooth(0.35, 0.6, nz.outputs['Fac'])

    def scatter(mask, dmin, dmax, seed, coll_sock, smin, smax):
        dist = G.node('GeometryNodeDistributePointsOnFaces', distribute_method='POISSON')
        G.put(land, dist.inputs['Mesh'])
        dist.inputs['Distance Min'].default_value = dmin
        dist.inputs['Density Max'].default_value = dmax
        G.put(mask, dist.inputs['Density Factor'])
        dist.inputs['Seed'].default_value = seed
        ci = G.node('GeometryNodeCollectionInfo', transform_space='ORIGINAL')
        G.put(coll_sock, ci.inputs['Collection'])
        ci.inputs['Separate Children'].default_value = True
        ci.inputs['Reset Children'].default_value = True
        idx = G.node('GeometryNodeInputIndex').outputs[0]
        iop = G.node('GeometryNodeInstanceOnPoints')
        G.put(dist.outputs['Points'], iop.inputs['Points'])
        G.put(ci.outputs[0], iop.inputs['Instance'])
        iop.inputs['Pick Instance'].default_value = True
        G.put(G.rand(0, 99, seed + 1, 'INT', idx), iop.inputs['Instance Index'])
        e2r = G.node('FunctionNodeEulerToRotation')
        G.put(G.combine(G.rand(-0.04, 0.04, seed + 2, 'FLOAT', idx), G.rand(-0.04, 0.04, seed + 3, 'FLOAT', idx), G.rand(0.0, 6.283, seed + 4, 'FLOAT', idx)), e2r.inputs['Euler'])
        G.put(e2r.outputs[0], iop.inputs['Rotation'])
        G.put(G.rand(smin, smax, seed + 5, 'FLOAT', idx), iop.inputs['Scale'])
        return iop.outputs['Instances']

    # the line runs through a clearing planted with cherry trees; the cedar forest stands back ~25 m, in clumps
    ced = scatter(G.math('MULTIPLY', G.smooth(21.0, 33.0, d), G.math('ADD', 0.25, G.math('MULTIPLY', 0.75, clump))), 3.4, 0.08, 11, cin, 0.65, 1.3)
    sak = scatter(G.math('MULTIPLY', G.smooth(4.8, 6.2, d), G.smooth(22.0, 12.0, d)), 5.0, 0.05, 31, sin_, 0.6, 1.0)
    join = G.node('GeometryNodeJoinGeometry')
    for g in (sak, ced, land):
        G.put(g, join.inputs[0])
    G.out(join.outputs[0])
    FX.modifier(terr, G.ng, Cedars=cedars, Sakuras=sakuras)


def mat_valley_haze():
    """Thin air over everything; mist pooling in the gullies (below the slope's own plane)."""
    m = new_mat('valley_haze')
    T = NT(m.node_tree)
    out = next(n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
    for n in list(m.node_tree.nodes):
        if n.type == 'BSDF_PRINCIPLED':
            m.node_tree.nodes.remove(n)
    v = T.node('ShaderNodeVolumePrincipled')
    wpos = T.node('ShaderNodeNewGeometry').outputs['Position']
    _, y, z = T.xyz(wpos)
    below = T.math('SUBTRACT', T.math('MULTIPLY', y, 0.082), z)  # metres under the slope's plane
    mist = T.smooth(6.0, 22.0, below)
    patch = T.smooth(0.3, 0.7, T.noise(T.vmath('MULTIPLY', wpos, (0.012, 0.012, 0.05)), 1.0, 3.0))
    dens = T.math('ADD', MLOOK['air'], T.math('MULTIPLY', T.math('MULTIPLY', mist, MLOOK['mist']), T.math('MULTIPLY_ADD', patch, 0.8, 0.4)))
    T.put(dens, v.inputs['Density'])
    v.inputs['Anisotropy'].default_value = 0.45
    v.inputs['Color'].default_value = rgba('#DCDDEE')
    T.put(v.outputs[0], out.inputs['Volume'])
    return m


def mat_granite():
    m = new_mat('granite')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    tc = T.coords()
    n1 = T.noise(tc['Object'], 14.0, 6.0, 0.65)
    geo = T.node('ShaderNodeNewGeometry')
    _, _, nz = T.xyz(geo.outputs['Normal'])
    moss = T.math('MULTIPLY', T.smooth(0.5, 0.9, nz), T.smooth(0.45, 0.6, T.noise(tc['Object'], 4.0, 4.0)))
    col = T.mix(n1, rgba('#4E4C47'), rgba('#7D7A72'))
    T.put(T.mix(moss, col, rgba('#33402A')), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.82
    T.put(T.bump(n1, 0.35, 0.01), b.inputs['Normal'])
    return m


def toro_meshes(mats):
    """A kasuga stone lantern, 1.9 m: base, pole, platform, fire box (four posts, its washi lit), roof, finial.
    Returns (stone mesh, washi mesh)."""
    B = MB()
    TS.box(B, -0.3, 0.3, -0.3, 0.3, 0.0, 0.14, 0)
    TS.cylinder(B, 0.0, 0.0, [(0.14, 0.12), (0.5, 0.105), (0.9, 0.1)], 14, 0)
    TS.box(B, -0.26, 0.26, -0.26, 0.26, 0.9, 1.03, 0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            TS.box(B, sx * 0.17 - 0.035, sx * 0.17 + 0.035, sy * 0.17 - 0.035, sy * 0.17 + 0.035, 1.03, 1.33, 0)
    TS.box(B, -0.22, 0.22, -0.22, 0.22, 1.33, 1.37, 0)
    TS.sweep(B, -0.4, 0.4, [(-0.4, 1.37), (0.4, 1.37), (0.4, 1.42), (0.06, 1.62), (-0.06, 1.62), (-0.4, 1.42)], 1, 0)
    TS.cylinder(B, 0.0, 0.0, [(1.6, 0.05), (1.66, 0.075), (1.74, 0.07), (1.8, 0.03), (1.83, 0.005)], 12, 0)
    stone = B.mesh('toro', [mats['granite']])
    B = MB()
    TS.box(B, -0.14, 0.14, -0.14, 0.14, 1.04, 1.32, 0)
    return stone, B.mesh('toro_washi', [mats['paper']])


def lanterns(M):
    """Stone lanterns along the outside of the line, alternating sides: warm pools on the vermilion from outside."""
    st, wa = toro_meshes(M)
    c = TS.coll('lamps')
    out = []
    s, k = S_LO + 4.0, 0
    while s < S_HI - 2:
        side = -1 if k % 2 == 0 else 1
        mw = TS.PATH.matrix(s, side * 2.35, -0.04)
        ob = bpy.data.objects.new(f'toro.{k:03d}', st)
        c.objects.link(ob)
        ob.matrix_world = mw
        wo = bpy.data.objects.new(f'toroW.{k:03d}', wa)
        c.objects.link(wo)
        wo.matrix_world = mw
        wo.visible_shadow = False
        L = bpy.data.lights.new(f'toroL.{k:03d}', 'POINT')
        L.energy = MLOOK['toro']
        L.color = hexlin('#FFA552')
        L.shadow_soft_size = 0.06
        lo = bpy.data.objects.new(f'toroL.{k:03d}', L)
        c.objects.link(lo)
        lo.matrix_world = mw @ Matrix.Translation((0, 0, 1.18))
        out.append((ob, wo, lo))
        s += MLOOK['toro_every']
        k += 1
    return out


# the outside's knobs: moon (direction by elevation / azimuth from +Y, toward -X positive), its light; the air
MLOOK = {'moon_elev': 13.0, 'moon_az': 12.0, 'light_elev': 24.0, 'moon': 1.8, 'disc': 2.1, 'air': 0.0006, 'mist': 0.012,
         'lamp': 45.0, 'stars': 1.0, 'toro': 90.0, 'toro_every': 9.0, 'scanned': 1.0, 'uplight': 900.0}


def build(live=False, seed=77, lamps_every=14, forest_on=True, foxfire=False, summit=False, land_x1=160, land_y0=-90, bench=7.0):
    """summit: the shrine precinct past the line's last gate (summit.py), the ground flattened round it. land_x1,
    land_y0: how far east and south the terrain runs (further for the views from outside it)."""
    TS.PATH = MountainPath()
    TS.LOOK['lamps_every'] = lamps_every
    TS.LOOK['lamp'] = MLOOK['lamp']
    S = TS.build(live=live, seed=seed, s_range=(S_LO, S_HI), interior=False)
    M = S['mats']
    M.update({'floor': mat_forest_floor(), 'ridge': mat_ridge(), 'foliage': mat_foliage(), 'sbark': SK.mat_sakura_bark(),
              'blossom': SK.mat_blossom(cutout=False), 'vhaze': mat_valley_haze()})
    top = None
    if summit:
        import summit as SU
        c = TS.PATH.matrix(S_HI + 0.3) @ Vector((SU.CENTRE[0], SU.CENTRE[1], 0.0))
        top = (c.x, c.y, TS.PATH.pos(S_HI + 0.3).z - 0.04, *SU.FLAT_R)
    terr = terrain(TS.PATH, M['floor'], x1=land_x1, y0=land_y0, summit=top, blend=bench)  # bench: how far the path's level blends into the slope
    S['terrain'] = terr
    M['granite'] = mat_granite()
    S['toro'] = lanterns(M)
    S['ridges'] = ridges(M['ridge'], TS.coll('ground'))
    if forest_on:
        cedars, sakuras = scanned_sources() if MLOOK['scanned'] else sources(M)
        forest(terr, cedars, sakuras)
    # the moon: its disc low over the top of the line; its light a little higher (so it reaches into the forest)
    e, a = math.radians(MLOOK['moon_elev']), math.radians(MLOOK['moon_az'])
    md = Vector((-math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    el = math.radians(MLOOK['light_elev'])
    ld_dir = Vector((md.x, md.y, 0.0)).normalized() * math.cos(el) + Vector((0, 0, math.sin(el)))
    L = bpy.data.lights.new('moon', 'SUN')
    L.energy = MLOOK['moon']
    L.color = hexlin('#C4CFFF')
    L.angle = math.radians(1.0)
    moon = bpy.data.objects.new('moon', L)
    TS.coll('fx').objects.link(moon)
    moon.rotation_mode = 'QUATERNION'
    moon.rotation_quaternion = (-ld_dir).to_track_quat('-Z', 'Y')
    TS.night_world(md, MLOOK['disc'], halo=60.0, stars=MLOOK['stars'])
    B = MB()
    TS.box(B, -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0)
    hz = bpy.data.objects.new('valley_haze', B.mesh('valley_haze', [M['vhaze']]))
    TS.coll('fx').objects.link(hz)
    hz.location = (0.0, 175.0, 20.0)
    hz.scale = (380.0, 530.0, 120.0)
    S.update({'moon': moon, 'moon_dir': md, 'haze': hz})
    if summit:
        S['summit'] = SU.precinct(S_HI, M, cherry=bpy.data.collections.get('sakura_jac'))
    if foxfire:  # chorus 2: blue flames drifting over the whole line, the stone lanterns burning blue-white
        import foxfire as FF
        coll = TS.coll('fx')
        pc = FX.path_curve(coll, S_LO, S_HI)
        fob, fmat = FF.source(coll)
        S['ff_field'], S['ff_md'] = FF.field(coll, pc, fob, fmat, count=900, s0=S_LO, s1=S_HI, seed=43, across=4.0, h_lo=3.2, h_hi=7.5, size=(0.35, 0.7))
        for _, _, lo in S['toro']:
            lo.data.color = (0.62, 0.84, 1.0)
    return S
