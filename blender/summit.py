# The summit (the outro): the top of the line of gates, a small Inari shrine precinct by moonlight. The approach runs on
# raked gravel between stone lanterns to a pair of fox guardians on tall plinths (one with the key in its mouth, one with
# the jewel) and the hall: nagare-zukuri, the front slope of its cypress-bark roof sweeping far out over the steps, chigi
# and katsuogi on the ridge, on a stone platform with a vermilion veranda; its lattice doors glow from within, four paper
# lanterns hang under the eave, the sacred rope with its paper streamers across the front; cherry trees lit from below.
# precinct() builds it past the end of the current path (tunnel_set.PATH: the mountain line for the outro's mattes).
# Local frame: origin at the line's end, +Y on along the line (level), +X right, Z up.
import bpy, math
from mathutils import Vector, Matrix
import tunnel_set as TS
from tunnel_set import NT, MB, new_mat, rgba, hexlin

CENTRE = (0.0, 12.0)  # the precinct's middle (local): the forest keeps off it, the ground is flat round it
FLAT_R = (13.0, 24.0)  # flat within, falling away beyond


# ------------------------------------------------------------------ materials
def mat_plaster():
    m = new_mat('plaster')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    n = T.noise(T.coords()['Object'], 7.0, 6.0, 0.6)
    T.put(T.mix(T.smooth(0.45, 0.78, n), rgba('#E4DFD2'), rgba('#B7AF9E')), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.9
    return m


def mat_bark_roof():
    """檜皮葺: layers of cypress bark, dark brown, combed in courses across the slope, mossy here and there."""
    m = new_mat('bark_roof')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    obj = T.coords()['Object']
    wave = T.node('ShaderNodeTexWave', wave_type='BANDS', bands_direction='Y')
    T.put(obj, wave.inputs['Vector'])
    wave.inputs['Scale'].default_value = 3.2
    wave.inputs['Distortion'].default_value = 1.2
    wave.inputs['Detail'].default_value = 3.0
    n = T.noise(obj, 2.6, 6.0, 0.6)
    col = T.mix(T.math('MULTIPLY', wave.outputs['Fac'], 0.7), rgba('#2A180F'), rgba('#4C2E1D'))
    col = T.mix(T.math('MULTIPLY', T.smooth(0.56, 0.7, n), 0.55), col, rgba('#2C3820'))
    T.put(col, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.86
    T.put(T.bump(wave.outputs['Fac'], 0.3, 0.01), b.inputs['Normal'])
    return m


def mat_flat(name, base, rough=0.5, metal=0.0, glow=None, strength=0.0):
    m = new_mat(name)
    T = NT(m.node_tree)
    b = T.bsdf(m)
    b.inputs['Base Color'].default_value = rgba(base)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if glow:
        b.inputs['Emission Color'].default_value = rgba(glow)
        b.inputs['Emission Strength'].default_value = strength
    return m


def mat_lantern():
    """A red paper lantern lit from within: the paper glows, brighter at its middle where the flame is."""
    m = new_mat('chochin')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    _, _, z = T.xyz(T.coords()['Generated'])
    b.inputs['Base Color'].default_value = rgba('#B8281A')
    b.inputs['Roughness'].default_value = 0.6
    b.inputs['Emission Color'].default_value = rgba('#FF5A2A')
    T.put(T.math('MULTIPLY', T.smooth(0.0, 0.5, T.math('SUBTRACT', 0.5, T.math('ABSOLUTE', T.math('SUBTRACT', z, 0.5)))), 4.0), b.inputs['Emission Strength'])
    return m


def mat_rope():
    m = new_mat('shimenawa')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    wave = T.node('ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL')
    T.put(T.coords()['Object'], wave.inputs['Vector'])
    wave.inputs['Scale'].default_value = 14.0
    T.put(T.mix(wave.outputs['Fac'], rgba('#8F7A47'), rgba('#C9B27A')), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.92
    T.put(T.bump(wave.outputs['Fac'], 0.6, 0.02), b.inputs['Normal'])
    return m


def mat_gravel():
    """Raked gravel: pale grey stones (a voronoi grain), raked in lines along the approach."""
    m = new_mat('gravel')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    obj = T.coords()['Object']
    vor = T.node('ShaderNodeTexVoronoi', feature='F1')
    T.put(obj, vor.inputs['Vector'])
    vor.inputs['Scale'].default_value = 60.0
    rake = T.node('ShaderNodeTexWave', wave_type='BANDS', bands_direction='X')
    T.put(obj, rake.inputs['Vector'])
    rake.inputs['Scale'].default_value = 2.4
    n = T.noise(obj, 1.2, 4.0)
    T.put(T.mix(T.math('MULTIPLY', vor.outputs['Distance'], 1.6), T.mix(n, rgba('#55524C'), rgba('#6E6A62')), rgba('#3E3B37')), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.9
    T.put(T.bump(T.math('ADD', T.math('MULTIPLY', vor.outputs['Distance'], 0.6), T.math('MULTIPLY', rake.outputs['Fac'], 0.4)), 0.5, 0.02), b.inputs['Normal'])
    return m


def mat_fox_stone():
    """The guardians' stone: pale weathered granite, darker in the hollows, moss on what faces up."""
    m = new_mat('fox_stone')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    obj = T.coords()['Object']
    n1 = T.noise(obj, 18.0, 6.0, 0.6)
    geo = T.node('ShaderNodeNewGeometry')
    _, _, nz = T.xyz(geo.outputs['Normal'])
    col = T.mix(n1, rgba('#8C887E'), rgba('#B4AFA3'))
    col = T.mix(T.math('MULTIPLY', T.smooth(0.55, 0.9, nz), T.smooth(0.5, 0.65, T.noise(obj, 5.0, 4.0))), col, rgba('#3E4A2E'))
    T.put(col, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.82
    T.put(T.bump(n1, 0.3, 0.008), b.inputs['Normal'])
    return m


# ------------------------------------------------------------------ meshes
def slab(B, p0, p1, w, x, t, mat):
    """A board in the YZ plane at x (t thick along X) from p0 to p1 ((y, z)), w wide."""
    dy, dz = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dy, dz)
    ny, nz = -dz / L * w / 2, dy / L * w / 2
    TS.sweep(B, x - t / 2, x + t / 2, [(p0[0] + ny, p0[1] + nz), (p1[0] + ny, p1[1] + nz), (p1[0] - ny, p1[1] - nz), (p0[0] - ny, p0[1] - nz)], 1, mat)


def hall_mesh(M):
    """The hall on its platform, with the veranda, the railing, the lattice doors, the walls, the beams and the roof."""
    B = MB()
    STONE, WOOD, VER, BLK, PLAS, ROOF, GOLD, PAPER = range(8)
    TS.box(B, -5.4, 5.4, 15.0, 24.0, 0.0, 0.85, STONE)  # the platform (kidan) and its coping
    TS.box(B, -5.5, 5.5, 14.9, 24.1, 0.85, 0.92, STONE)
    for k in range(3):
        TS.box(B, -1.8, 1.8, 13.55 + k * 0.45, 15.0, -0.05, (k + 1) * 0.307, STONE)  # the steps
    TS.box(B, -5.1, 5.1, 15.2, 23.8, 0.92, 1.02, WOOD)  # the veranda
    XS = (-3.9, -1.3, 1.3, 3.9)
    for x, y in [(x, 16.4) for x in XS] + [(x, 22.6) for x in XS] + [(-3.9, 19.5), (3.9, 19.5)]:
        TS.cylinder(B, x, y, [(1.02, 0.16), (4.62, 0.15)], 24, VER)
        TS.cylinder(B, x, y, [(1.02, 0.178), (1.3, 0.178), (1.34, 0.166)], 24, BLK)
    for z0, z1 in ((3.12, 3.32), (4.42, 4.62)):  # the beams (nageshi), front, rear and sides
        TS.box(B, -4.12, 4.12, 16.24, 16.56, z0, z1, VER)
        TS.box(B, -4.12, 4.12, 22.44, 22.76, z0, z1, VER)
        for x in (-3.9, 3.9):
            TS.box(B, x - 0.16, x + 0.16, 16.4, 22.6, z0, z1, VER)
    TS.box(B, -3.9, 3.9, 16.37, 16.45, 3.32, 4.42, PLAS)  # the white wall over the doors
    for x in (-3.9, 3.9):
        TS.box(B, x - 0.05, x + 0.05, 16.4, 22.6, 1.02, 4.42, PLAS)
    TS.box(B, -3.9, 3.9, 22.55, 22.65, 1.02, 4.42, PLAS)
    for xa, xb in ((-3.9, -1.3), (-1.3, 1.3), (1.3, 3.9)):  # the lattice doors (shitomido), lit paper behind
        x0, x1 = xa + 0.16, xb - 0.16
        TS.box(B, x0, x1, 16.47, 16.51, 1.32, 3.12, PAPER)
        n = int((x1 - x0) / 0.13)
        for j in range(1, n):
            x = x0 + j * (x1 - x0) / n
            TS.box(B, x - 0.013, x + 0.013, 16.36, 16.43, 1.32, 3.12, VER)
        for k in range(1, 13):
            z = 1.32 + k * 0.15
            TS.box(B, x0, x1, 16.36, 16.43, z - 0.013, z + 0.013, VER)
        TS.box(B, x0, x1, 16.34, 16.45, 1.02, 1.32, VER)  # the kick panel
    for x in (-5.0, -3.9, -2.8, -1.9, 1.9, 2.8, 3.9, 5.0):  # the railing (koran) round the veranda's front
        TS.box(B, x - 0.05, x + 0.05, 15.25, 15.35, 1.02, 1.72, VER)
        if abs(x) > 4.5:
            for y in (17.4, 19.5, 21.6, 23.6):
                TS.box(B, x - 0.05, x + 0.05, y - 0.05, y + 0.05, 1.02, 1.72, VER)
    for xa, xb in ((-5.0, -1.9), (1.9, 5.0)):
        TS.box(B, xa, xb, 15.24, 15.36, 1.62, 1.72, VER)
        TS.box(B, xa, xb, 15.26, 15.34, 1.3, 1.36, VER)
        TS.box(B, xa + (0.0 if xa < 0 else 0.0), xa + 0.12, 15.24, 15.36, 1.72, 1.8, GOLD)  # gilt caps on the end posts
    for x in (-5.0, 5.0):
        TS.box(B, x - 0.06, x + 0.06, 15.3, 23.7, 1.62, 1.72, VER)
        TS.box(B, x - 0.05, x + 0.05, 15.3, 23.7, 1.3, 1.36, VER)
    # the roof: the ridge, the long concave front slope out over the steps, the short rear slope; its corners turn up
    yR, zR, yF, zF, yB, zB, th = 19.5, 7.35, 12.7, 3.95, 24.8, 5.15, 0.3
    top = [(yF + (yR - yF) * (k / 16), zF + (zR - zF) * (k / 16) ** 1.45) for k in range(17)]
    top += [(yR + (yB - yR) * (k / 8), zB + (zR - zB) * (1 - k / 8) ** 1.3) for k in range(1, 9)]
    prof = top + [(y, z - th) for y, z in reversed(top)]
    TS.sweep(B, -5.9, 5.9, prof, 24, ROOF, lambda x: 0.16 * (abs(x) / 5.9) ** 3)
    for x in (-5.15, 5.15):  # the gables: white plaster under the roof, a vermilion bargeboard
        pts = [(y, z - th - 0.02) for y, z in top if 16.2 <= y <= 22.8]
        vs = [B.v((x, 16.2, 4.62)), B.v((x, 22.8, 4.62))] + [B.v((x, y, max(z, 4.64))) for y, z in reversed(pts)]
        B.face(vs, [(-1, -1)] * len(vs), PLAS)
        slab(B, (16.0, 4.6), (yR, zR - 0.32), 0.2, x * 1.08, 0.07, VER)
        slab(B, (yR, zR - 0.32), (23.0, 4.6 + (zR - 4.9) * 0.35), 0.2, x * 1.08, 0.07, VER)
    TS.box(B, -5.75, 5.75, yR - 0.24, yR + 0.24, zR - 0.08, zR + 0.32, BLK)  # the ridge (munagi)
    for x in (-5.75, 5.75):
        TS.box(B, x - 0.07, x + 0.07, yR - 0.27, yR + 0.27, zR - 0.1, zR + 0.36, GOLD)
        slab(B, (yR + 0.5, zR - 0.4), (yR - 0.62, zR + 1.25), 0.24, x * 0.97, 0.09, BLK)  # the chigi: two boards crossed over the ridge
        slab(B, (yR - 0.5, zR - 0.4), (yR + 0.62, zR + 1.25), 0.24, x * 0.97, 0.09, BLK)
    for x in (-3.4, -1.7, 0.0, 1.7, 3.4):  # the katsuogi: short logs laid across the ridge, gilt at the ends
        TS.sweep(B, x - 0.13, x + 0.13, [(yR - 0.62, zR + 0.32), (yR + 0.62, zR + 0.32), (yR + 0.62, zR + 0.58), (yR - 0.62, zR + 0.58)], 1, BLK)
        for y in (yR - 0.66, yR + 0.62):
            TS.sweep(B, x - 0.135, x + 0.135, [(y, zR + 0.31), (y + 0.04, zR + 0.31), (y + 0.04, zR + 0.59), (y, zR + 0.59)], 1, GOLD)
    return B.mesh('hall', [M['stone'], M['wood'], M['ver'], M['blk'], M['plaster'], M['roof'], M['gold'], M['door_paper']])


def lantern_mesh(M):
    B = MB()
    TS.cylinder(B, 0.0, 0.0, [(0.0, 0.15), (0.07, 0.26), (0.22, 0.32), (0.46, 0.32), (0.61, 0.26), (0.68, 0.15)], 20, 0, cap_top=True, cap_bot=True)
    TS.cylinder(B, 0.0, 0.0, [(0.68, 0.165), (0.77, 0.165)], 20, 1, cap_top=True)
    TS.cylinder(B, 0.0, 0.0, [(-0.07, 0.165), (0.0, 0.165)], 20, 1, cap_bot=True)
    TS.cylinder(B, 0.0, 0.0, [(0.77, 0.012), (1.15, 0.012)], 6, 1)  # the cord
    return B.mesh('chochin', [M['lantern'], M['blk']])


def fox_mesh(M, holds):
    """A seated fox guardian (koma-gitsune) on its plinth, facing +Y: haunches and chest turned on a lathe, the head with
    its snout and pricked ears, the tail swept up behind like a flame, a red bib; the key or the jewel in its mouth."""
    B = MB()
    ST, RED, GOLD = 0, 1, 2
    TS.box(B, -0.42, 0.42, -0.42, 0.42, 0.0, 0.25, ST)  # the plinth
    TS.box(B, -0.34, 0.34, -0.34, 0.34, 0.25, 1.35, ST)
    TS.box(B, -0.4, 0.4, -0.4, 0.4, 1.35, 1.45, ST)
    TS.cylinder(B, 0.0, -0.04, [(1.45, 0.2), (1.55, 0.26), (1.7, 0.22), (1.86, 0.15), (2.02, 0.12), (2.14, 0.1)], 18, ST, cap_top=False)  # haunches to neck
    TS.cylinder(B, 0.0, 0.03, [(2.12, 0.11), (2.2, 0.125), (2.3, 0.11), (2.36, 0.06)], 16, ST)  # the head
    sn = [(0.0, 0.1), (0.05, 0.075), (0.15, 0.045), (0.21, 0.02)]  # the snout, forward (+Y)
    rings = [[B.v((r * math.cos(2 * math.pi * j / 10), 0.1 + y, 2.22 + r * math.sin(2 * math.pi * j / 10) * 0.8)) for j in range(10)] for y, r in sn]
    for a, b_ in zip(rings, rings[1:]):
        for j in range(10):
            k = (j + 1) % 10
            B.face([a[j], a[k], b_[k], b_[j]], [(-1, -1)] * 4, ST, True)
    B.face(list(reversed(rings[0])), [(-1, -1)] * 10, ST)
    for sx in (-1, 1):  # the ears
        b0 = [B.v((sx * 0.06 + dx, 0.03 + dy, 2.32)) for dx, dy in ((-0.035, -0.02), (0.035, -0.02), (0.0, 0.03))]
        tip = B.v((sx * 0.085, 0.02, 2.5))
        for i in range(3):
            B.face([b0[i], b0[(i + 1) % 3], tip], [(-1, -1)] * 3, ST)
    tail = [(0.0, -0.3, 1.5, 0.11), (0.0, -0.4, 1.72, 0.13), (0.0, -0.36, 1.98, 0.12), (0.0, -0.24, 2.18, 0.08), (0.0, -0.18, 2.3, 0.02)]
    tr = [[B.v((x + r * math.cos(2 * math.pi * j / 10), y + r * math.sin(2 * math.pi * j / 10) * 0.7, z)) for j in range(10)] for x, y, z, r in tail]
    for a, b_ in zip(tr, tr[1:]):
        for j in range(10):
            k = (j + 1) % 10
            B.face([a[j], a[k], b_[k], b_[j]], [(-1, -1)] * 4, ST, True)
    for sx in (-1, 1):  # the forelegs
        TS.cylinder(B, sx * 0.09, 0.15, [(1.45, 0.045), (1.75, 0.04), (1.95, 0.05)], 10, ST)
    bib = [B.v((-0.13, 0.08, 2.08)), B.v((0.13, 0.08, 2.08)), B.v((0.0, 0.2, 1.86))]  # the red bib (yodarekake)
    B.face(bib, [(-1, -1)] * 3, RED)
    if holds == 'key':
        TS.box(B, -0.16, 0.16, 0.24, 0.26, 2.2, 2.22, GOLD)
        TS.cylinder(B, 0.17, 0.25, [(2.18, 0.03), (2.24, 0.03)], 10, GOLD)
    else:
        TS.cylinder(B, 0.0, 0.33, [(2.16, 0.02), (2.19, 0.045), (2.25, 0.04), (2.28, 0.0)], 12, GOLD)
    return B.mesh(f'fox_{holds}', [M['fox'], M['bib'], M['gold']])


# ------------------------------------------------------------------ the precinct
def precinct(s_end, mats, cherry=None, lamp=30.0, glow=3.0):
    """Build the precinct past s_end of tunnel_set.PATH. mats: the set's materials (TS.build's S['mats']); cherry: the
    collection of a lit cherry tree to instance round it (mountain.scanned_sources' sakura_jac), or None. Returns a dict
    of handles; its lights by name in 'lights'."""
    M = dict(mats)
    M.update({'plaster': mat_plaster(), 'roof': mat_bark_roof(), 'gold': mat_flat('fitting_gold', '#C9A24A', 0.32, 1.0),
              'door_paper': mat_flat('door_paper', '#F2E6CC', 0.8, glow='#FFC27A', strength=glow), 'lantern': mat_lantern(),
              'rope': mat_rope(), 'shide': mat_flat('shide', '#F4F1EA', 0.7, glow='#FFF2DA', strength=0.15),
              'gravel': mat_gravel(), 'fox': mat_fox_stone(), 'bib': mat_flat('bib', '#C02818', 0.7)})
    if 'granite' not in M:
        import mountain
        M['granite'] = mountain.mat_granite()
    if 'stone' not in M:
        M['stone'] = M['granite']
    C = TS.coll('summit')
    F = TS.PATH.matrix(s_end + 0.3)
    out = {'frame': F, 'lights': {}}

    def put(name, me, local, coll=C):
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        ob.matrix_world = F @ local
        return ob

    def light(name, kind, energy, col, local, size=0.1):
        L = bpy.data.lights.new(name, kind)
        L.energy, L.color, L.shadow_soft_size = energy, hexlin(col), size
        lo = put(name, L, local)
        out['lights'][name] = lo
        return lo

    out['hall'] = put('hall', hall_mesh(M), Matrix())
    B = MB()
    TS.box(B, -13.0, 13.0, -1.0, 27.0, -0.06, -0.01, 0)
    put('gravel', B.mesh('gravel', [M['gravel']]), Matrix())
    B = MB()
    TS.box(B, -1.3, 1.3, -1.0, 13.6, -0.02, 0.03, 0)  # the stone approach through the gravel
    put('sando', B.mesh('sando', [M['stone']]), Matrix())
    # the doors' glow spilling out over the veranda and down the steps (a soft panel facing out, unseen itself)
    hl = light('hall_glow', 'AREA', 220.0, '#FFB46A', Matrix.Translation((0.0, 16.05, 2.2)) @ Matrix.Rotation(math.radians(-90), 4, 'X'), 6.0)
    hl.visible_camera = False
    lm = lantern_mesh(M)
    for k, x in enumerate((-2.6, -0.9, 0.9, 2.6)):
        put(f'chochin.{k}', lm, Matrix.Translation((x, 15.5, 3.2))).visible_shadow = False  # (its own light shines through it)
        light(f'chochinL.{k}', 'POINT', lamp, '#FF8A4A', Matrix.Translation((x, 15.5, 3.55)), 0.12)
    # the sacred rope across the front, its paper streamers
    cu = bpy.data.curves.new('shimenawa', 'CURVE')
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution = '3D', 0.07, 4
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(2)
    for bp, (x, z, r) in zip(sp.bezier_points, ((-4.05, 3.02, 0.8), (0.0, 2.62, 1.7), (4.05, 3.02, 0.8))):
        bp.co, bp.radius = (x, 16.2, z), r
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cu.materials.append(M['rope'])
    put('shimenawa', cu, Matrix())
    B = MB()
    for x in (-2.7, -0.9, 0.9, 2.7):
        z0 = 2.62 + 0.4 * (abs(x) / 4.05) ** 2 - 0.08
        zig = [(x + (0.05 if k % 2 else -0.05), z0 - 0.11 * k) for k in range(5)]
        for (xa, za), (xb, zb) in zip(zig, zig[1:]):
            vs = [B.v((xa - 0.045, 16.17, za)), B.v((xa + 0.045, 16.17, za)), B.v((xb + 0.045, 16.17, zb)), B.v((xb - 0.045, 16.17, zb))]
            B.face(vs, [(-1, -1)] * 4, 0)
    put('shide', B.mesh('shide', [M['shide']]), Matrix())
    # the stone lanterns along the approach, lit; the fox guardians on their plinths, turned a little to the approach
    import mountain
    st, wa = mountain.toro_meshes(M)
    for k, (x, y) in enumerate(((-2.1, 3.2), (2.1, 3.2), (-2.1, 8.2), (2.1, 8.2))):
        put(f'stoneL.{k}', st, Matrix.Translation((x, y, 0.0)))
        w = put(f'stoneW.{k}', wa, Matrix.Translation((x, y, 0.0)))
        w.visible_shadow = False
        light(f'stoneLL.{k}', 'POINT', 40.0, '#FFA552', Matrix.Translation((x, y, 1.18)), 0.06)
    for x, holds, yaw in ((-2.5, 'key', -0.45), (2.5, 'jewel', 0.45)):
        put(f'fox.{holds}', fox_mesh(M, holds), Matrix.Translation((x, 11.4, 0.0)) @ Matrix.Rotation(yaw, 4, 'Z'))
    if cherry is not None:  # cherry trees round the hall, each with its uplight
        for k, (x, y, sc, yaw) in enumerate(((-9.5, 17.0, 1.25, 0.4), (9.0, 20.5, 1.1, 2.1), (-6.5, 27.5, 1.0, 4.0), (7.0, 6.0, 0.95, 5.2))):
            ob = put(f'cherry.{k}', None, Matrix.Translation((x, y, -0.05)) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Scale(sc, 4))
            ob.instance_type, ob.instance_collection = 'COLLECTION', cherry
    return out
