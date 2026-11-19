# 千本鳥居 by moonlight: the chorus tunnel as a Cycles set (Blender 5.2), built entirely from code.
# The shots module (shots_chorus.py, run by tools/blender/render.py) calls build(); for look development the same file
# is loaded into the live Blender over MCP (load it with importlib, then build(live=True): it clears the scene by hand,
# because read_factory_settings would also reset the add-ons).
# Textures: Poly Haven (CC0): grey_stone_path (Amal Kumar), japanese_cedar_bark (Charlotte Baglioni). The pillar
# inscriptions: make_inscriptions.py (Yuji Syuku, OFL).
#
# Coordinates: metres, Z up. The path's arc length s runs along the tunnel (s = 0 where the chorus cuts in), the
# tunnel heads +Y at s = 0; "across" a is metres to the right of the centre line.
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'tex')

PITCH = 0.38  # m between gates: the pillars (0.27 m) all but touch, light comes in through 0.1 m slits
HX = 1.0  # pillar centres at ±HX
S_FIRST, S_LAST = -8.0, 92.0
GRADE = 0.03  # the path climbs 3 %


def hexlin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def rgba(h, a=1.0):
    return (*hexlin(h), a)


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ the path
class Path:
    """The tunnel's centre line by arc length: straight past the title, a long bend left, then one right; climbing."""
    DS = 0.05

    def __init__(self, s0=S_FIRST - 20, s1=S_LAST + 20):
        self.s0, self.s1 = s0, s1
        self.n = int(round((s1 - s0) / self.DS)) + 1
        th = [0.0] * self.n
        xy = [(0.0, 0.0)] * self.n
        i0 = int(round(-s0 / self.DS))
        for i in range(i0, self.n - 1):  # integrate the heading and the position both ways from s = 0
            sm = s0 + (i + 0.5) * self.DS
            th[i + 1] = th[i] + self.kappa(sm) * self.DS
            tm = (th[i] + th[i + 1]) / 2
            xy[i + 1] = (xy[i][0] - math.sin(tm) * self.DS, xy[i][1] + math.cos(tm) * self.DS)
        for i in range(i0, 0, -1):
            sm = s0 + (i - 0.5) * self.DS
            th[i - 1] = th[i] - self.kappa(sm) * self.DS
            tm = (th[i] + th[i - 1]) / 2
            xy[i - 1] = (xy[i][0] + math.sin(tm) * self.DS, xy[i][1] - math.cos(tm) * self.DS)
        self.th, self.xy = th, xy

    @staticmethod
    def kappa(s):
        if 14 <= s <= 44:
            return 0.018 * math.sin(math.pi * (s - 14) / 30)
        if 50 <= s <= 86:
            return -0.020 * math.sin(math.pi * (s - 50) / 36)
        return 0.0

    @staticmethod
    def z(s):
        return GRADE * s

    def _at(self, s):
        f = (min(max(s, self.s0), self.s1) - self.s0) / self.DS
        i = min(int(f), self.n - 2)
        return i, f - i

    def theta(self, s):
        i, u = self._at(s)
        return self.th[i] * (1 - u) + self.th[i + 1] * u

    def pos(self, s, a=0.0, h=0.0):
        """World point s along, a to the right, h above the path."""
        i, u = self._at(s)
        x = self.xy[i][0] * (1 - u) + self.xy[i + 1][0] * u
        y = self.xy[i][1] * (1 - u) + self.xy[i + 1][1] * u
        th = self.theta(s)
        return Vector((x + math.cos(th) * a, y + math.sin(th) * a, self.z(s) + h))

    def fwd(self, s):
        th = self.theta(s)
        return Vector((-math.sin(th), math.cos(th), GRADE)).normalized()

    def right(self, s):
        th = self.theta(s)
        return Vector((math.cos(th), math.sin(th), 0.0))

    def matrix(self, s, a=0.0, h=0.0, yaw=0.0):
        """Local frame at s: +X right, +Y along the tunnel (level), +Z up."""
        return Matrix.Translation(self.pos(s, a, h)) @ Matrix.Rotation(self.theta(s) + yaw, 4, 'Z')


PATH = Path()


# ------------------------------------------------------------------ node helpers
def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    return m


class NT:
    """Small builder for shader node trees: sockets or plain values wherever an input is expected."""

    def __init__(self, tree):
        self.tree, self.N, self.L = tree, tree.nodes, tree.links

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

    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for k, v in enumerate((a, b, c)):
            self.put(v, n.inputs[k])
        return n.outputs[0]

    def mix(self, fac, a, b, kind='RGBA', blend='MIX'):
        n = self.node('ShaderNodeMix', data_type=kind, blend_type=blend, clamp_factor=True)
        ins = {s.identifier: s for s in n.inputs}
        suf = {'RGBA': 'Color', 'FLOAT': 'Float', 'VECTOR': 'Vector'}[kind]
        self.put(fac, ins['Factor_Float'])
        self.put(a, ins['A_' + suf])
        self.put(b, ins['B_' + suf])
        return {s.identifier: s for s in n.outputs}['Result_' + suf]

    def smooth(self, e0, e1, x):
        """smoothstep(e0, e1, x); e0 > e1 gives the falling edge."""
        n = self.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP', clamp=True)
        self.put(x, n.inputs['Value'])
        lo, hi = (e0, e1) if e0 < e1 else (e1, e0)
        n.inputs['From Min'].default_value, n.inputs['From Max'].default_value = lo, hi
        n.inputs['To Min'].default_value, n.inputs['To Max'].default_value = (0.0, 1.0) if e0 < e1 else (1.0, 0.0)
        return n.outputs['Result']

    def noise(self, vec, scale=5.0, detail=4.0, rough=0.55, distortion=0.0, dims='3D'):
        n = self.node('ShaderNodeTexNoise', noise_dimensions=dims)
        self.put(vec, n.inputs['Vector'])
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        n.inputs['Distortion'].default_value = distortion
        return n.outputs['Fac']

    def vmath(self, op, a, b=None, scale=None):
        n = self.node('ShaderNodeVectorMath', operation=op)
        self.put(a, n.inputs[0])
        if b is not None:
            self.put(b, n.inputs[1])
        if scale is not None:
            self.put(scale, n.inputs['Scale'])
        return n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else n.outputs['Vector']

    def xyz(self, vec):
        n = self.node('ShaderNodeSeparateXYZ')
        self.put(vec, n.inputs[0])
        return n.outputs['X'], n.outputs['Y'], n.outputs['Z']

    def combine(self, x, y, z=0.0):
        n = self.node('ShaderNodeCombineXYZ')
        for k, v in enumerate((x, y, z)):
            self.put(v, n.inputs[k])
        return n.outputs[0]

    def tex(self, path, vec, noncolor=False, ext='REPEAT', interp='Linear'):
        img = bpy.data.images.load(path, check_existing=True)
        if noncolor:
            img.colorspace_settings.name = 'Non-Color'
        n = self.node('ShaderNodeTexImage', image=img, extension=ext, interpolation=interp)
        self.put(vec, n.inputs['Vector'])
        return n.outputs['Color'], n.outputs['Alpha']

    def bump(self, height, strength, distance=0.01, normal=None):
        n = self.node('ShaderNodeBump')
        self.put(height, n.inputs['Height'])
        n.inputs['Strength'].default_value = strength
        n.inputs['Distance'].default_value = distance
        if normal is not None:
            self.put(normal, n.inputs['Normal'])
        return n.outputs['Normal']

    def coords(self):
        n = self.node('ShaderNodeTexCoord')
        return n.outputs

    def bsdf(self, m):
        return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


# ------------------------------------------------------------------ materials
def mat_vermilion(credits=False):
    """丹塗り: semi-matte vermilion paint over cypress, each gate its own age (fresh orange … weathered red), splash dirt
    above the black base, dark streaks under the beams, and on the pillars' faces the donors' ink (inscription atlas).
    credits: the credit gates' variant (make_credits.py's atlas; the cell from the gate object's 'credit')."""
    m = new_mat('vermilion_credits' if credits else 'vermilion')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    rnd = T.node('ShaderNodeObjectInfo').outputs['Random']
    tc = T.coords()
    obj = tc['Object']
    _, _, z = T.xyz(obj)
    age = T.math('POWER', rnd, 0.75)
    col = T.mix(age, rgba('#C9431D'), rgba('#962B1B'))
    n1 = T.noise(obj, 5.0, 8.0, 0.6)
    dirt = T.math('MULTIPLY', T.smooth(1.0, 0.36, z), T.math('MULTIPLY_ADD', n1, 0.7, 0.3))
    streak_v = T.vmath('MULTIPLY', obj, (26.0, 26.0, 1.1))
    streak = T.math('MULTIPLY', T.smooth(0.5, 0.72, T.noise(streak_v, 1.0, 6.0, 0.6)), T.math('MULTIPLY', age, T.smooth(1.1, 2.4, z)))
    grime = T.math('MAXIMUM', T.math('MULTIPLY', dirt, 0.6), T.math('MULTIPLY', streak, 0.55))
    col = T.mix(grime, col, rgba('#2A1911'))
    # the inscriptions: UV u = side + around (0.5 = the face toward the approach, turned in to the tunnel), v = height
    uv = tc['UV']
    u, v, _ = T.xyz(uv)
    side = T.math('FLOOR', u)
    fu = T.math('SUBTRACT', u, side)
    UW, ZLO, ZHI = 0.171, 0.80, 2.20
    cu = T.math('ADD', T.math('DIVIDE', T.math('SUBTRACT', fu, 0.5), UW), 0.5)
    cv = T.math('DIVIDE', T.math('SUBTRACT', v, ZLO), ZHI - ZLO)
    inside = T.math('MULTIPLY', T.math('MULTIPLY', T.math('GREATER_THAN', cu, 0.0), T.math('LESS_THAN', cu, 1.0)),
                    T.math('MULTIPLY', T.math('GREATER_THAN', cv, 0.0), T.math('LESS_THAN', cv, 1.0)))
    inside = T.math('MULTIPLY', inside, T.math('GREATER_THAN', side, -0.5))
    right = T.math('GREATER_THAN', side, 0.5)
    if credits:  # an atlas of n columns: the left pillars' row over the right pillars'
        import json
        with open(os.path.join(TEX, 'credits.json'), encoding='utf-8') as fh:
            ncol = json.load(fh)['cols']
        cid = T.node('ShaderNodeAttribute', attribute_type='OBJECT', attribute_name='credit').outputs['Fac']
        au = T.math('DIVIDE', T.math('ADD', cid, T.math('MINIMUM', T.math('MAXIMUM', cu, 0.0), 1.0)), float(ncol))
        av = T.math('DIVIDE', T.math('ADD', T.math('SUBTRACT', 1.0, right), T.math('MINIMUM', T.math('MAXIMUM', cv, 0.0), 1.0)), 2.0)
        ink_c, _ = T.tex(os.path.join(TEX, 'credits.png'), T.combine(au, av), noncolor=True, ext='CLIP')
    else:
        r2 = T.math('FRACT', T.math('MULTIPLY_ADD', rnd, 7.31, 0.37))
        cell = T.math('FLOOR', T.math('MULTIPLY', T.mix(right, rnd, r2, 'FLOAT'), 23.999))
        ccol = T.math('FLOORED_MODULO', cell, 12.0)
        crow = T.math('ADD', T.math('FLOOR', T.math('DIVIDE', cell, 12.0)), T.math('MULTIPLY', right, 2.0))
        au = T.math('DIVIDE', T.math('ADD', ccol, T.math('MINIMUM', T.math('MAXIMUM', cu, 0.0), 1.0)), 12.0)
        av = T.math('DIVIDE', T.math('ADD', T.math('SUBTRACT', 3.0, crow), T.math('MINIMUM', T.math('MAXIMUM', cv, 0.0), 1.0)), 4.0)
        ink_c, _ = T.tex(os.path.join(TEX, 'inscriptions.png'), T.combine(au, av), noncolor=True, ext='CLIP')
    ink = T.math('MULTIPLY', T.math('MULTIPLY', T.xyz(ink_c)[0], inside), T.math('MULTIPLY_ADD', age, -0.5, 1.0))
    col = T.mix(ink, col, rgba('#100A09'))
    T.put(col, b.inputs['Base Color'])
    n2 = T.noise(obj, 22.0, 4.0)
    rough = T.math('ADD', T.math('MULTIPLY_ADD', n2, 0.16, 0.30), T.math('MULTIPLY', age, 0.14))
    T.put(T.mix(ink, rough, 0.34, 'FLOAT'), b.inputs['Roughness'])
    grain_v = T.vmath('MULTIPLY', obj, (60.0, 60.0, 2.2))
    T.put(T.bump(T.noise(grain_v, 1.0, 6.0, 0.6), 0.05, 0.004), b.inputs['Normal'])
    b.inputs['Specular IOR Level'].default_value = 0.45
    return m


def mat_black():
    """Black lacquer of the kasagi and the pillar bases; dust and moss settle on the tops."""
    m = new_mat('black_lacquer')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    tc = T.coords()
    geo = T.node('ShaderNodeNewGeometry')
    _, _, nz = T.xyz(geo.outputs['Normal'])
    n1 = T.noise(tc['Object'], 9.0, 6.0)
    top = T.math('MULTIPLY', T.smooth(0.55, 0.9, nz), T.smooth(0.42, 0.62, n1))
    col = T.mix(top, rgba('#0C0A09'), rgba('#1C2016'))
    T.put(col, b.inputs['Base Color'])
    # the tops weathered rough (dust, lichen): smooth they mirror the sky at a grazing view, a white ribbon from above
    up = T.smooth(0.3, 0.75, nz)
    T.put(T.math('ADD', T.math('MULTIPLY_ADD', n1, 0.2, 0.3), T.math('MULTIPLY', up, 0.55)), b.inputs['Roughness'])
    T.put(T.math('MULTIPLY_ADD', up, -0.25, 0.5), b.inputs['Specular IOR Level'])
    T.put(T.math('MULTIPLY_ADD', up, -0.12, 0.12), b.inputs['Coat Weight'])
    b.inputs['Coat Roughness'].default_value = 0.18
    T.put(T.bump(T.noise(tc['Object'], 40.0, 3.0), 0.04, 0.003), b.inputs['Normal'])
    return m


def mat_stone():
    """The flagstone path, wet: dark in the joints and the puddles, the puddles mirror-smooth."""
    m = new_mat('stone_path')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    tc = T.coords()
    uv = tc['UV']
    d = os.path.join(TEX, 'grey_stone_path')
    diff, _ = T.tex(os.path.join(d, 'grey_stone_path_diff_2k.jpg'), uv)
    rough_t, _ = T.tex(os.path.join(d, 'grey_stone_path_rough_2k.jpg'), uv, noncolor=True)
    nor_t, _ = T.tex(os.path.join(d, 'grey_stone_path_nor_gl_2k.jpg'), uv, noncolor=True)
    disp_t, _ = T.tex(os.path.join(d, 'grey_stone_path_disp_2k.jpg'), uv, noncolor=True)
    disp = T.xyz(disp_t)[0]
    wpos = T.node('ShaderNodeNewGeometry').outputs['Position']
    puddle = T.smooth(0.53, 0.6, T.noise(wpos, 0.42, 3.0, 0.5))
    joints = T.smooth(0.42, 0.2, disp)
    wet = T.math('MAXIMUM', T.math('MAXIMUM', puddle, T.math('MULTIPLY', joints, 0.85)), 0.3)
    col = T.mix(T.math('MULTIPLY', wet, 0.55), diff, (0.0, 0.0, 0.0, 1.0))
    T.put(col, b.inputs['Base Color'])
    T.put(T.mix(wet, T.xyz(rough_t)[0], 0.05, 'FLOAT'), b.inputs['Roughness'])
    nm = T.node('ShaderNodeNormalMap')
    T.put(nor_t, nm.inputs['Color'])
    T.put(T.math('MULTIPLY_ADD', puddle, -0.9, 1.0), nm.inputs['Strength'])
    T.put(nm.outputs['Normal'], b.inputs['Normal'])
    return m


def mat_ground():
    """Outside the gates: dark earth, moss in drifts, everything damp."""
    m = new_mat('ground')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    wpos = T.node('ShaderNodeNewGeometry').outputs['Position']
    n1 = T.noise(wpos, 1.6, 8.0, 0.6)
    moss = T.smooth(0.46, 0.6, T.noise(wpos, 0.3, 4.0))
    col = T.mix(moss, rgba('#231B15'), rgba('#26301B'))
    col = T.mix(T.math('MULTIPLY_ADD', n1, 0.9, 0.0), (0.0, 0.0, 0.0, 1.0), col)
    T.put(col, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.78
    T.put(T.bump(T.noise(wpos, 6.0, 6.0), 0.35, 0.02), b.inputs['Normal'])
    return m


def mat_bark():
    m = new_mat('cedar_bark')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    uv = T.coords()['UV']
    d = os.path.join(TEX, 'japanese_cedar_bark')
    diff, _ = T.tex(os.path.join(d, 'japanese_cedar_bark_diff_2k.jpg'), uv)
    rough_t, _ = T.tex(os.path.join(d, 'japanese_cedar_bark_rough_2k.jpg'), uv, noncolor=True)
    nor_t, _ = T.tex(os.path.join(d, 'japanese_cedar_bark_nor_gl_2k.jpg'), uv, noncolor=True)
    T.put(T.mix(0.35, diff, (0.0, 0.0, 0.0, 1.0)), b.inputs['Base Color'])
    T.put(T.xyz(rough_t)[0], b.inputs['Roughness'])
    nm = T.node('ShaderNodeNormalMap')
    T.put(nor_t, nm.inputs['Color'])
    T.put(nm.outputs['Normal'], b.inputs['Normal'])
    return m


def principled_dark(name, base, rough=0.8):
    """A plain cloth (the procession's robes)."""
    m = new_mat(name)
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = rgba(base)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Sheen Weight'].default_value = 0.4
    return m


def mat_paper():
    """The lamp's washi panels, lit from inside (the lamp's own light passes them: they cast no shadow)."""
    m = new_mat('lamp_paper')
    T = NT(m.node_tree)
    out = next(n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
    for n in list(m.node_tree.nodes):
        if n.type == 'BSDF_PRINCIPLED':
            m.node_tree.nodes.remove(n)
    uv = T.coords()['Generated']
    fib = T.noise(T.vmath('MULTIPLY', uv, (14.0, 14.0, 40.0)), 1.0, 8.0, 0.7)
    em = T.node('ShaderNodeEmission')
    T.put(T.mix(T.math('MULTIPLY_ADD', fib, 0.5, 0.25), rgba('#FFB867'), rgba('#FFE2B0')), em.inputs['Color'])
    # 'glow' on each paper object (1 = lit, keyed with its lamp's light where a shot switches lamps on and off)
    glow = T.node('ShaderNodeAttribute', attribute_type='OBJECT', attribute_name='glow').outputs['Fac']
    T.put(T.math('MULTIPLY', glow, LOOK['paper']), em.inputs['Strength'])
    em.name = 'paper_glow'
    tr = T.node('ShaderNodeBsdfTranslucent')
    tr.inputs['Color'].default_value = rgba('#F3D9B5')
    add = T.node('ShaderNodeAddShader')
    T.put(em.outputs[0], add.inputs[0])
    T.put(tr.outputs[0], add.inputs[1])
    T.put(add.outputs[0], out.inputs['Surface'])
    return m


def mat_wood_dark():
    m = new_mat('lamp_wood')
    T = NT(m.node_tree)
    b = T.bsdf(m)
    b.inputs['Base Color'].default_value = rgba('#1E120C')
    b.inputs['Roughness'].default_value = 0.5
    return m


def mat_haze():
    """The mountain air: thin, forward-scattering haze that shows the moonbeams and the lamps' halos."""
    m = new_mat('haze')
    T = NT(m.node_tree)
    out = next(n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
    for n in list(m.node_tree.nodes):
        if n.type == 'BSDF_PRINCIPLED':
            m.node_tree.nodes.remove(n)
    v = T.node('ShaderNodeVolumePrincipled')
    v.name = 'haze'
    # thin everywhere, thick in the last metre above the path (height above the path ~ z - GRADE * y: the path heads
    # within 26 degrees of +Y), and broken into drifting patches
    wpos = T.node('ShaderNodeNewGeometry').outputs['Position']
    x, y, z = T.xyz(wpos)
    zr = T.math('SUBTRACT', z, T.math('MULTIPLY', y, GRADE))
    ground = T.math('EXPONENT', T.math('DIVIDE', zr, -LOOK['fog_h']))
    patch = T.smooth(0.3, 0.75, T.noise(T.vmath('MULTIPLY', wpos, (0.22, 0.22, 0.6)), 1.0, 3.0, 0.5))
    dens = T.math('MULTIPLY', T.math('MULTIPLY_ADD', ground, LOOK['fog'], 1.0), T.math('MULTIPLY_ADD', patch, 1.2, 0.3))
    T.put(T.math('MULTIPLY', dens, LOOK['haze']), v.inputs['Density'])
    v.inputs['Anisotropy'].default_value = LOOK['aniso']
    v.inputs['Color'].default_value = rgba('#E8E6F2')
    T.put(v.outputs[0], out.inputs['Volume'])
    return m


def night_world(moon_dir, disc=0.55, halo=300.0, stars=0.0):
    """Plum night sky: indigo at the zenith, plum at the horizon, the moon's disc (angular radius `disc` degrees) and a
    halo, stars if asked (for the open shots; the moonlight itself is the sun lamp)."""
    w = bpy.data.worlds.new('night')
    try:
        w.use_nodes = True
    except AttributeError:
        pass
    T = NT(w.node_tree)
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    d = T.coords()['Generated']
    dn = T.vmath('NORMALIZE', d)
    _, _, dz = T.xyz(dn)
    sky = T.mix(T.smooth(-0.05, 0.6, dz), rgba('#1A1226'), rgba('#07061A'))
    cosm = T.vmath('DOT_PRODUCT', dn, tuple(moon_dir))
    dsk = T.smooth(math.cos(math.radians(disc * 1.12)), math.cos(math.radians(disc * 0.94)), cosm)
    hl = T.math('POWER', T.math('MAXIMUM', cosm, 0.0), halo)
    col = T.mix(T.math('MULTIPLY', hl, 0.25), sky, rgba('#8A90C0'))
    if stars:
        st = T.node('ShaderNodeTexVoronoi', feature='F1')
        T.put(T.vmath('MULTIPLY', dn, (420.0, 420.0, 420.0)), st.inputs['Vector'])
        pin = T.math('MULTIPLY', T.smooth(0.07, 0.0, st.outputs['Distance']), T.smooth(0.82, 0.97, st.outputs['Color']))
        tw = T.math('MULTIPLY', pin, T.math('MULTIPLY', T.smooth(0.0, 0.35, dz), stars))
        col = T.mix(tw, col, (1.6, 1.6, 1.9, 1.0))
    # the moon's face: a little mottled (maria), cool white
    mare = T.smooth(0.42, 0.62, T.noise(T.vmath('MULTIPLY', dn, (900.0 / max(disc, 0.3),) * 3), 1.0, 4.0, 0.6))
    face = T.mix(T.math('MULTIPLY', mare, 0.35), (40.0, 42.0, 48.0, 1.0), (24.0, 26.0, 31.0, 1.0))
    col = T.mix(dsk, col, face)
    T.put(col, bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    bpy.context.scene.world = w
    return w


# ------------------------------------------------------------------ meshes
class MB:
    """Mesh builder: quads with per-loop UVs and material indices."""

    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')

    def face(self, verts, uvs, mat=0, smooth=False):
        f = self.bm.faces.new(verts)
        for lp, t in zip(f.loops, uvs):
            lp[self.uv].uv = t
        f.material_index = mat
        f.smooth = smooth
        return f

    def v(self, co):
        return self.bm.verts.new(co)

    def mesh(self, name, mats):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for mt in mats:
            me.materials.append(mt)
        return me


def cylinder(B, cx, cy, levels, seg, mat, side=-1, a_front=-math.pi / 2, lean=0.0, cap_top=True, cap_bot=False):
    """A turned post: levels = [(z, r)], leaning lean m toward +x at the top. UV u = side + around (front at 0.5), v = z."""
    ztop = levels[-1][0]
    rings = []
    for z, r in levels:
        ox = cx + lean * (z / ztop if ztop else 0)
        ring = [B.v((ox + r * math.cos(a_front + math.pi + 2 * math.pi * j / seg), cy + r * math.sin(a_front + math.pi + 2 * math.pi * j / seg), z)) for j in range(seg)]
        rings.append((z, ring))
    us = (lambda j: (side + j / seg) if side >= 0 else -1.0)
    for (z0, r0), (z1, r1) in zip(rings, rings[1:]):
        for j in range(seg):
            k = (j + 1) % seg
            B.face([r0[j], r0[k], r1[k], r1[j]], [(us(j), z0), (us(j + 1), z0), (us(j + 1), z1), (us(j), z1)], mat, True)
    if cap_top:
        B.face(list(rings[-1][1]), [(-1, -1)] * seg, mat)
    if cap_bot:
        B.face(list(reversed(rings[0][1])), [(-1, -1)] * seg, mat)


def sweep(B, x0, x1, profile, nx, mat, lift=lambda x: 0.0, flare=0.0):
    """A beam along X: profile = [(y, z)] counter-clockwise seen from +X, nx segments, z raised by lift(x) (the sori),
    the top of each end pushed out by flare m (the slanted end cut of a kasagi)."""
    zs = [p[1] for p in profile]
    zlo, zhi = min(zs), max(zs)
    secs = []
    for i in range(nx + 1):
        x = x0 + (x1 - x0) * i / nx
        sec = []
        for (y, z) in profile:
            k = (z - zlo) / (zhi - zlo) if zhi > zlo else 0
            xe = x + (flare * k * (-1 if i == 0 else 1) if i in (0, nx) else 0.0)
            sec.append(B.v((xe, y, z + lift(x))))
        secs.append(sec)
    n = len(profile)
    for a, c in zip(secs, secs[1:]):
        for j in range(n):
            k = (j + 1) % n
            B.face([a[j], c[j], c[k], a[k]], [(-1, -1)] * 4, mat)
    B.face(list(reversed(secs[0])), [(-1, -1)] * n, mat)
    B.face(list(secs[-1]), [(-1, -1)] * n, mat)


def box(B, x0, x1, y0, y1, z0, z1, mat):
    sweep(B, x0, x1, [(y0, z0), (y1, z0), (y1, z1), (y0, z1)], 1, mat)


def gate_mesh(mats):
    """One Inari torii (稲荷鳥居): black-based pillars with a ring (daiwa) at the top, the nuki through them, the
    gakuzuka, and the two-layer lintel: vermilion shimaki under the black kasagi, both swept up at the ends."""
    B = MB()
    VER, BLK = 0, 1
    for sx in (-1, 1):
        side = 0 if sx < 0 else 1
        a_front = -math.pi / 2 - sx * math.radians(28)  # the inscription faces the approach, turned in to the tunnel
        cylinder(B, sx * HX, 0.0, [(0.0, 0.135), (0.5, 0.1335), (1.0, 0.1315), (1.5, 0.1295), (2.0, 0.1275), (2.62, 0.1255)], 40, VER,
                 side, a_front, lean=-sx * 0.028, cap_top=False)
        cylinder(B, sx * HX, 0.0, [(0.0, 0.151), (0.33, 0.151), (0.36, 0.144), (0.362, 0.137)], 40, BLK, -1, a_front, cap_top=True)
        cylinder(B, sx * (HX - 0.028), 0.0, [(2.6, 0.16), (2.615, 0.168), (2.685, 0.168), (2.70, 0.16)], 40, VER, -1, a_front, cap_top=True, cap_bot=True)
        box(B, sx * (HX + 0.155) - 0.022, sx * (HX + 0.155) + 0.022, -0.062, 0.062, 2.20, 2.37, VER)  # the wedge (kusabi) outside the pillar
    sori = lambda x: 0.10 * (abs(x) / 1.56) ** 2.4
    box(B, -1.30, 1.30, -0.05, 0.05, 2.22, 2.35, VER)  # nuki
    box(B, -0.055, 0.055, -0.042, 0.042, 2.35, 2.70, VER)  # gakuzuka
    sweep(B, -1.42, 1.42, [(-0.085, 2.70), (0.085, 2.70), (0.085, 2.84), (-0.085, 2.84)], 32, VER, sori)  # shimaki
    sweep(B, -1.56, 1.56, [(-0.115, 2.84), (0.115, 2.84), (0.115, 2.95), (0.07, 3.0), (-0.07, 3.0), (-0.115, 2.95)], 40, BLK, sori, flare=0.05)  # kasagi
    return B.mesh('torii', mats)


def lamp_meshes(mats):
    """A small hanging lamp on a pillar's inner face: dark wood frame, black cap and iron arm (casting the frame's
    shadows), and the washi panels as their own mesh (the lamp's light passes them). Local frame: the lamp's centre at
    the origin, the pillar on its -X side."""
    wood, paper, blk = mats
    B = MB()
    w, h = 0.075, 0.13
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(B, sx * w - 0.009, sx * w + 0.009, sy * w - 0.009, sy * w + 0.009, -h, h, 0)
    for z in (-h, h - 0.012):
        box(B, -w - 0.01, w + 0.01, -w - 0.01, w + 0.01, z, z + 0.014, 0)
    sweep(B, -0.115, 0.115, [(-0.115, h), (0.115, h), (0.02, h + 0.07), (-0.02, h + 0.07)], 1, 1)
    box(B, -0.3, -w - 0.01, -0.012, 0.012, h + 0.03, h + 0.05, 1)  # the arm to the pillar
    box(B, -0.022, 0.022, -0.022, 0.022, -h - 0.05, -h, 0)
    frame = B.mesh('lamp_frame', [wood, blk])
    B = MB()
    box(B, -w + 0.002, w - 0.002, -w + 0.002, w - 0.002, -h + 0.012, h - 0.012, 0)
    return frame, B.mesh('lamp_paper', [paper])


def ribbon(name, a0, a1, na, s0, s1, ds, mat, uv_scale, zf=lambda s, a: 0.0):
    """A strip along the path from a0 to a1 across, UV in metres / uv_scale (texture runs along the path)."""
    B = MB()
    ns = int(round((s1 - s0) / ds))
    grid = []
    for i in range(ns + 1):
        s = s0 + (s1 - s0) * i / ns
        grid.append([B.v(PATH.pos(s, a0 + (a1 - a0) * j / na, zf(s, a0 + (a1 - a0) * j / na))) for j in range(na + 1)])
    for i in range(ns):
        sa, sb = s0 + (s1 - s0) * i / ns, s0 + (s1 - s0) * (i + 1) / ns
        for j in range(na):
            aa, ab = a0 + (a1 - a0) * j / na, a0 + (a1 - a0) * (j + 1) / na
            B.face([grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]],
                   [(aa / uv_scale, sa / uv_scale), (ab / uv_scale, sa / uv_scale), (ab / uv_scale, sb / uv_scale), (aa / uv_scale, sb / uv_scale)], 0, True)
    me = B.mesh(name, [mat])
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def trunk_mesh(mat):
    B = MB()
    seg = 18
    levels = [(z, 1.0 - 0.18 * z) for z in (0.0, 0.25, 0.5, 0.75, 1.0)]
    rings = [[B.v((r * math.cos(2 * math.pi * j / seg), r * math.sin(2 * math.pi * j / seg), z)) for j in range(seg)] for z, r in levels]
    for (z0, _), (z1, _), a, c in zip(levels, levels[1:], rings, rings[1:]):
        for j in range(seg):
            k = (j + 1) % seg
            B.face([a[j], a[k], c[k], c[j]], [(j / seg * 3, z0 * 9), ((j + 1) / seg * 3, z0 * 9), ((j + 1) / seg * 3, z1 * 9), (j / seg * 3, z1 * 9)], 0, True)
    return B.mesh('trunk', [mat])


# ------------------------------------------------------------------ the set
def clear_live():
    """Empty the open file without resetting preferences (the MCP add-on keeps running)."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.worlds,
                 bpy.data.node_groups, bpy.data.images, bpy.data.curves, bpy.data.actions, bpy.data.fonts):
        for idb in list(coll):
            try:
                coll.remove(idb)
            except (RuntimeError, ReferenceError):
                pass
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


def coll(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c


def put(ob, c):
    c.objects.link(ob)
    return ob


# the look's knobs (lookdev.py --set k=v overrides them): the moon by elevation / azimuth from the tunnel's right
# (positive = ahead), its strength; the haze; the lamps
LOOK = {'moon_elev': 18.0, 'moon_az': 25.0, 'moon': 12.0, 'haze': 0.02, 'fog': 3.0, 'fog_h': 0.6, 'aniso': 0.3,
        'lamp': 40.0, 'lamps_every': 14, 'paper': 5.0, 'trees': 0.0}  # (trees: on for the outside shots; inside they
# only show in the roof slits and cost 2-3x render time, the moon's shadow rays crossing their cut-out blossom)

# cherry trees along the tunnel (s, across, scale): alternating sides, the canopies overhanging the gates
GROVE = [(s, (-1 if k % 2 == 0 else 1) * (3.8 + (k * 0.37) % 1.6), 1.0 + (k * 0.23) % 0.3)
         for k, s in enumerate([-4, 1, 5, 9, 14, 19, 24, 29, 34, 40, 46, 52, 58, 64, 70, 77, 84])]


def moon_local():
    e, a = math.radians(LOOK['moon_elev']), math.radians(LOOK['moon_az'])
    return Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))


def terrain(s, a):
    """Ground height above the path's own level, s along, a across: the tunnel runs along a terrace, the mountain rising
    on the left, the valley (and the low moon) on the right."""
    slope = 0.16 * -a if a < 0 else -0.3 * a
    return -0.03 + slope * smoothstep(1.3, 5.0, abs(a)) + 0.05 * math.sin(s * 0.7 + a * 1.3)


def build(live=False, seed=1912, lamps=None, s_range=None, interior=True, moon_dir=None, moon_disc=0.55, stars=0.0,
          ground_extra=0.0):
    """Build the set along PATH between s_range (default S_FIRST..S_LAST). lamps: [(s, side ±1)] (each hung on the
    nearest gate), else one every LOOK['lamps_every'] gates, alternating sides. interior: the terrace ground, the cedar
    trunks and the tunnel's haze (the outside shots bring their own: mountain.py). Returns a dict of handles."""
    if live:
        clear_live()
    lamps_every = int(LOOK['lamps_every'])
    rnd = random.Random(seed)
    sc = bpy.context.scene
    M = {'ver': mat_vermilion(), 'blk': mat_black(), 'stone': mat_stone(), 'ground': mat_ground(),
         'paper': mat_paper(), 'wood': mat_wood_dark(), 'bark': mat_bark(), 'haze': mat_haze()}
    C = {k: coll(k) for k in ('gates', 'lamps', 'ground', 'forest', 'fx')}
    gm = gate_mesh([M['ver'], M['blk']])
    gates = []
    s_lo, s_hi = s_range or (S_FIRST, S_LAST)
    s = s_lo
    k = 0
    while s <= s_hi:
        ss = s + rnd.uniform(-0.012, 0.012)
        ob = put(bpy.data.objects.new(f'torii.{k:04d}', gm), C['gates'])
        sc_ = 1.0 + rnd.uniform(-0.012, 0.012)
        ob.matrix_world = PATH.matrix(ss, rnd.uniform(-0.01, 0.01), 0.0, math.radians(rnd.uniform(-0.35, 0.35))) @ Matrix.Scale(sc_, 4)
        ob['s'] = ss
        gates.append(ob)
        s += PITCH
        k += 1
    lm_frame, lm_paper = lamp_meshes([M['wood'], M['paper'], M['blk']])
    if lamps is None:
        hang = {i: (-1 if (i // lamps_every) % 2 == 0 else 1) for i in range(len(gates)) if lamps_every and i % lamps_every == 7}
    else:
        hang = {}
        for s_, side in lamps:
            i = min(range(len(gates)), key=lambda j: abs(gates[j]['s'] - s_))
            hang.setdefault(i, side)
    lamps = []
    for i in sorted(hang):
        g, sx = gates[i], hang[i]
        mw = PATH.matrix(g['s'], sx * (HX - 0.135 - 0.3 + 0.01), 1.92) @ Matrix.Rotation(0 if sx < 0 else math.pi, 4, 'Z')
        ob = put(bpy.data.objects.new(f'lamp.{i:04d}', lm_frame), C['lamps'])
        ob.matrix_world = mw
        pp = put(bpy.data.objects.new(f'lampP.{i:04d}', lm_paper), C['lamps'])
        pp.matrix_world = mw
        pp.visible_shadow = False
        pp['glow'] = 1.0
        L = bpy.data.lights.new(f'lampL.{i:04d}', 'POINT')
        L.energy = LOOK['lamp']
        L.color = hexlin('#FFAD60')
        L.shadow_soft_size = 0.035
        lo = put(bpy.data.objects.new(f'lampL.{i:04d}', L), C['lamps'])
        lo.matrix_world = mw
        lamps.append((ob, pp, lo))
    stone = put(ribbon('path', -1.32, 1.32, 12, s_lo - 2, s_hi + 2, 0.25, M['stone'], 1.8,
                       lambda s, a: 0.012 * (1 - (a / 1.32) ** 2)), C['ground'])
    sc.collection.objects.unlink(stone)
    out = {'path': PATH, 'gates': gates, 'lamps': lamps, 'mats': M, 'colls': C}
    if not interior:
        return out

    for nm, (a0, a1, na) in (('ground_L', (-30.0, -1.32, 40)), ('ground_R', (1.32, 30.0, 40))):
        g = ribbon(nm, a0, a1, na, S_FIRST - 6, S_LAST + 6 + ground_extra, 0.5, M['ground'], 2.0, terrain)
        sc.collection.objects.unlink(g)
        put(g, C['ground'])
    tm = trunk_mesh(M['bark'])
    for i in range(160):
        s_ = rnd.uniform(S_FIRST - 4, S_LAST + 4)
        a_ = -rnd.uniform(2.6, 26.0)  # cedars on the uphill side only: the moon comes in over the valley
        r_ = rnd.uniform(0.22, 0.42)
        ob = put(bpy.data.objects.new(f'cedar.{i:03d}', tm), C['forest'])
        ob.matrix_world = Matrix.Translation(PATH.pos(s_, a_, terrain(s_, a_) - 0.2)) @ Matrix.Rotation(rnd.uniform(0, 6.3), 4, 'Z') @ Matrix.Diagonal((r_, r_, rnd.uniform(16, 24), 1))
    if LOOK['trees']:
        import sakura
        sakura.grove(GROVE)
    # the moon
    if moon_dir is None:
        moon_dir = (Matrix.Rotation(PATH.theta(8.0), 3, 'Z') @ moon_local()).normalized()
    ld = bpy.data.lights.new('moon', 'SUN')
    ld.energy = LOOK['moon']
    ld.color = hexlin('#BCCFFF')
    ld.angle = math.radians(0.55)
    moon = put(bpy.data.objects.new('moon', ld), C['fx'])
    moon.rotation_mode = 'QUATERNION'
    moon.rotation_quaternion = (-moon_dir).to_track_quat('-Z', 'Y')
    night_world(moon_dir, moon_disc, stars=stars)
    # the haze: one box around the whole set
    B = MB()
    box(B, -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0)
    hz = put(bpy.data.objects.new('haze', B.mesh('haze', [M['haze']])), C['fx'])
    # around the tunnel only (40 m wide, up to ~9 m over the roof): the rays out through the slits march less haze
    mid = PATH.pos((S_FIRST + S_LAST) / 2)
    hz.location = (-5.0, mid.y, 5.0)
    hz.scale = (40.0, (S_LAST - S_FIRST) + 14.0, 14.0)
    out.update({'moon': moon, 'haze': hz, 'moon_dir': moon_dir})
    return out


def render_settings(samples=64, pct=50, view='Khronos PBR Neutral', exposure=0.0):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'CYCLES'
    except TypeError:
        pass
    cy = sc.cycles
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type in ('OPTIX',)
        cy.device = 'GPU'
    except Exception as e:
        print('device', e)
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.max_bounces = 8
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 4
    cy.volume_bounces = 0
    cy.sample_clamp_indirect = 6.0
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, pct
    sc.view_settings.view_transform = 'Khronos PBR Neutral' if view == 'Khronos PBR Neutral' else view
    sc.view_settings.exposure = exposure
