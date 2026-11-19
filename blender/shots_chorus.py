# Chorus 1 in the senbon torii tunnel, rendered in Cycles by the engine's tools/blender/render.py:
#   blender -b --factory-startup -P tools/blender/render.py -- --shots shots_chorus --shot tunnel_entry [--scale 50 --every 2]
# tunnel_entry: the chorus downbeat cuts in from the festival street; the camera brakes in the tunnel and the band
# drops out (the petals hang in the air); the title stands ahead and lights glyph by glyph as it is sung; the band comes
# back, the title flares and bursts into petals on the next beat, and the camera surges through them down the tunnel,
# a lamp passing on every second snare, to the downbeat three bars after the surge.
# Every time comes from the song data the way the engine's torii.ts derives it (lyrics: times only).
import math, os, sys
import bpy
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lib
import tunnel_set as TS
import tunnel_fx as FX

TITLE = '千本桜'  # the song's title, the chorus line's first phrase
S_TITLE = 5.4  # where it stands in the tunnel (m along the path)
FPS = 30


def clamp01(x):
    return min(max(x, 0.0), 1.0)


def ss(e0, e1, x):
    return lib.smoothstep(e0, e1, x)


def bar_index(P, t):
    return min(range(len(P.downbeats)), key=lambda k: abs(P.downbeats[k] - t))


def phrase_times(P, line, n):
    """The first n glyphs' sung times: each word split evenly, its later glyphs on the nearest vocal onset inside the
    word snapped to the 16th grid (the engine's phraseTimes)."""
    on = [x[0] for x in P.audio.get('onsets', {}).get('vocal', [])]
    g0, q16 = P.beats[0], 60.0 / P.bpm / 4
    snap = lambda t: g0 + round((t - g0) / q16) * q16
    times = []
    for w in line['words']:
        k = len(w['w'])
        inside = [t for t in on if w['start'] + 0.06 < t < w['end'] - 0.04]
        prev = w['start']
        for j in range(k):
            share = w['start'] + (w['end'] - w['start']) * j / k
            t = share
            if j > 0:
                c = sorted([x for x in inside if x > prev + 0.05], key=lambda x: abs(x - share))
                if c:
                    t = snap(c[0])
            t = max(t, prev)
            times.append(t)
            prev = t
        if len(times) >= n:
            break
    return times[:n]


class Timing:
    """A stop-bar chorus's moments (chorus 1 by default): the brake on its downbeat, the freeze when the bass drops out,
    the title's glyphs as sung (later choruses keep chorus 1's spacing from the first glyph, as torii.ts does), the
    band's return, the burst on the first beat 0.35 s after the last glyph; the camera's travel and the petals' clocks."""
    def __init__(self, P, section='chorus1'):
        self.c0, _ = P.section(section)
        k0 = bar_index(P, self.c0)
        self.full = P.bar(k0 + 1)  # the band is back
        self.freeze = max(P.events('bass_out', self.c0 + 0.2, self.full - 0.2))
        self.punches = sorted(P.events('kick', self.c0 + 0.1, self.freeze) + P.events('sub', self.c0 + 0.1, self.freeze))
        line = next(l for l in P.lines if self.c0 - 0.2 <= l['start'] < self.full - 0.1)
        self.glyphs = phrase_times(P, line, len(TITLE))
        if section != 'chorus1':
            ref = Timing(P).glyphs
            self.glyphs = [self.glyphs[0] + (g - ref[0]) for g in ref]
        beat = 60.0 / P.bpm
        tb = max(self.full, self.glyphs[-1] + 0.35)
        self.burst = min(b for b in P.beats if b >= tb - 1e-6)
        self.end = P.bar(k0 + 4)
        self.snares = [t for t in P.events('snare', self.burst - 0.01, self.end + 0.5)]
        self.beat = beat
        # camera travel: integrate the speed at 1 ms
        self.dt = 0.001
        self.t_lo = self.c0 - 0.2
        n = int((self.end + 0.5 - self.t_lo) / self.dt) + 2
        self.s_tab, self.clock_tab, self.wind_tab = [0.0] * n, [0.0] * n, [0.0] * n
        s = c = w = 0.0
        for i in range(n):
            t = self.t_lo + i * self.dt
            self.s_tab[i], self.clock_tab[i], self.wind_tab[i] = s, c, w
            s += self.speed(t) * self.dt
            c += self.petal_rate(t) * self.dt
            w += self.wind_speed(t) * self.dt
        i0 = int(round((self.c0 - self.t_lo) / self.dt))
        s_at_c0 = self.s_tab[i0]
        self.s_tab = [x - s_at_c0 for x in self.s_tab]  # s = 0 on the chorus downbeat

    def _at(self, tab, t):
        f = (t - self.t_lo) / self.dt
        i = min(max(int(f), 0), len(tab) - 2)
        u = min(max(f - i, 0.0), 1.0)
        return tab[i] * (1 - u) + tab[i + 1] * u

    def speed(self, t):
        v = lib.lerp(2.4, 0.22, ss(self.c0, self.c0 + 0.55, t))  # cut in moving, brake
        v = lib.lerp(v, 0.05, ss(self.freeze - 0.1, self.freeze + 0.25, t))  # the band drops out: hold
        v = lib.lerp(v, 1.1, ss(self.full, self.burst, t))  # it's back: creep toward the title
        fl = 1 - math.exp(-max(0.0, t - self.burst) / 0.3)  # the burst: surge
        return lib.lerp(v, 8.6, fl)

    def petal_rate(self, t):
        r = lib.lerp(1.0, 0.03, ss(self.freeze - 0.05, self.freeze + 0.12, t))
        return lib.lerp(r, 1.8, ss(self.full, self.burst, t))

    def wind_speed(self, t):
        w = lib.lerp(0.12, 0.0, ss(self.freeze - 0.05, self.freeze + 0.12, t))
        g = math.exp(-max(0.0, t - self.burst) / 2.5) if t >= self.burst else 0.0
        return w - 3.2 * g * ss(self.burst, self.burst + 0.08, t) - 1.2 * ss(self.burst, self.burst + 1.0, t)

    def glyph_frame(self, i):
        """The time of the first frame that shows glyph i (the frame nearest its sung time, or the one after)."""
        return math.ceil(self.glyphs[i] * FPS - 0.5) / FPS

    def s(self, t):
        return self._at(self.s_tab, t)

    def clock(self, t):
        return self._at(self.clock_tab, t)

    def wind(self, t):
        return self._at(self.wind_tab, t)


def kicks(t, hits, rel):
    """Sum of decaying hits (0 before each)."""
    return sum(math.exp(-(t - k) / rel) for k in hits if t >= k)


def shake(t, hits, amp, hz=13.0, rel=0.09, seed=0.0):
    return sum(amp * math.exp(-(t - k) / rel) * math.sin(2 * math.pi * hz * (t - k) + seed) for k in hits if t >= k)


def entry(P):
    T = Timing(P)
    # lamps: two by the start, a pair flanking the title, then one on every second snare of the flight, alternating
    lamps = [(-3.0, 1), (S_TITLE - 0.5, 1), (S_TITLE + 0.9, -1)]
    side = 1
    for k, t in enumerate(T.snares):
        if k % 2 == 1 and t > T.burst + 0.3:
            lamps.append((T.s(t) + 0.15, side))
            side = -side
    shot = {'id': 'tunnel_entry', 't0': T.c0, 't1': T.end - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 128, 'threshold': 0.012, 'min_samples': 24, 'view': 'AgX', 'exposure': 0.0}}

    def build(S):
        TS.LOOK['lamps_every'] = 0
        S.update(TS.build(lamps=lamps))
        FX.add_all(S, title_text=TITLE, title_s=S_TITLE, air=12000, air_span=(-3.0, 52.0))
        S['T'] = T
        f0, f1 = lib.frame_of(shot['t0'], FPS) - 2, lib.frame_of(shot['t1'], FPS) + 2
        fr = list(range(f0, f1 + 1))
        ts = [f / FPS for f in fr]
        air = S['petal_air']
        lib.bake(air, FX.input_path(S['petal_air_md'], 'Clock'), fr, [T.clock(t) for t in ts])
        lib.bake(air, FX.input_path(S['petal_air_md'], 'Wind'), fr, [T.wind(t) for t in ts])
        lib.bake(S['burst'], FX.input_path(S['burst_md'], 'Tau'), fr, [max(0.0, t - T.burst) for t in ts])
        for i, g in enumerate(S['title']):
            tg = T.glyph_frame(i)
            lib.bake(g, '["ignite"]', fr, [ignite(T, i, t) for t in ts])
            # unseen until its syllable is sung, struck like a seal (from 1.14 down to size), gone in the burst
            lib.bake(g, 'hide_render', fr, [1.0 if (t < tg - 1e-4 or t >= T.burst - 0.5 / FPS) else 0.0 for t in ts], interp='CONSTANT')
            lib.bake(g, 'scale', fr, [(k_, k_, k_) for k_ in (1.0 + 0.14 * math.exp(-max(0.0, t - tg) / 0.06) for t in ts)])
        S['cam'].data.clip_start = 0.03
        return S

    def at(S, t):
        T = S['T']
        s = T.s(t)
        stop = ss(T.c0, T.c0 + 0.5, t) * (1 - ss(T.burst, T.burst + 0.5, t))  # 1 while the title holds the frame
        fl = 1 - math.exp(-max(0.0, t - T.burst) / 0.35)
        bob = 0.025 * math.sin(2 * math.pi * (t - T.burst) / (2 * T.beat)) * fl
        h = lib.lerp(lib.lerp(1.3, 1.16, stop), 1.36, fl) + bob
        weave = 0.1 * math.sin((t - T.burst) * 1.1) * fl
        eye = TS.PATH.pos(s, weave + shake(t, T.punches + [T.burst], 0.006), h + shake(t, T.punches + [T.burst], 0.01, seed=1.3))
        tgt_stop = TS.PATH.pos(S_TITLE, 0.0, 1.34)
        look = max(s + 6.5, s + 0.1)
        tgt_fly = TS.PATH.pos(look, weave * 0.4, 1.42 + 0.05 * fl)
        k = ss(T.burst - 0.05, T.burst + 0.6, t)
        tgt = tgt_stop.lerp(tgt_fly, k) if t > T.c0 + 0.0 else tgt_fly
        # bank into the bend (the curvature a few metres ahead), and a small kick on the burst
        roll = -6.0 * TS.Path.kappa(s + 5.0) * fl + 0.012 * shake(t, [T.burst], 1.0, hz=6.0, rel=0.2)
        lens = lib.lerp(lib.lerp(26.0, 30.0, stop), 21.0, fl)
        focus = (tgt_stop - eye).length if k < 0.5 else lib.lerp(3.6, 3.6, fl)
        lights = {}
        dim = lib.lerp(1.0, 0.55, ss(T.freeze - 0.05, T.freeze + 0.2, t) * (1 - ss(T.full - 0.02, T.full + 0.05, t)))
        flare = 0.6 * kicks(t, T.punches, 0.1) + 0.8 * kicks(t, [T.full], 0.25) + 0.45 * kicks(t, T.snares, 0.11)
        for ob, _, L in S['lamps']:
            lights[L.name] = TS.LOOK['lamp'] * dim * (1 + flare)
        for i, L in enumerate(S['title_lights']):
            tg = T.glyph_frame(i)
            e = 0.0 if t < tg else 4.0 + 46.0 * math.exp(-(t - tg) / 0.2)
            e += 30.0 * kicks(t, [T.full], 0.3) if t >= tg else 0.0
            e = e if t < T.burst else 160.0 * math.exp(-(t - T.burst) / 0.12)
            lights[L.name] = e
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': lens, 'fstop': lib.lerp(2.4, 4.5, fl),
                        'focus': focus, 'roll': roll}, 'lights': lights}

    shot['build'], shot['at'] = build, at
    return shot


def ignite(T, i, t):
    """A glyph's inner light: struck when its syllable is sung (a flash, settling to a glow), flared by the band's
    return, at full just before the burst."""
    tg = T.glyph_frame(i)
    if t < tg - 1e-4:
        return 0.0
    g = 0.32 + 0.68 * math.exp(-(t - tg) / 0.22)
    g += 0.35 * math.exp(-(t - T.full) / 0.3) if t >= T.full else 0.0
    g += 0.6 * ss(T.burst - 0.2, T.burst, t)
    return min(g, 1.2)


def reveal(P):
    """tunnel_reveal, the two bars after the surge: outside at last. Beside the tunnel's glowing wall among the cherry
    trees lit from below, the camera dollies along the line and cranes up through the blossom, over the gates, until
    the line shows climbing the mountain through the cedar forest toward the moon."""
    T = Timing(P)
    k0 = bar_index(P, T.c0)
    t0, t1 = T.end, P.bar(k0 + 6)
    shot = {'id': 'tunnel_reveal', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 128, 'threshold': 0.012, 'min_samples': 24, 'view': 'AgX', 'exposure': 0.0}}
    S0 = 150.0

    def path_state(t):
        u = clamp01((t - t0) / (t1 - t0))
        e = u * u * (3 - 2 * u)
        rise = u * u * (3 - 2 * u) ** 1.0
        eye = (S0 + 26.0 * u, 4.6 - 13.0 * e, 2.2 + 46.0 * rise)
        tgt = (eye[0] + lib.lerp(14.0, 150.0, e), lib.lerp(1.0, -8.0, u), lib.lerp(1.8, 28.0, e))  # ends on the line climbing to the moon
        return u, eye, tgt

    def build(S):
        import mountain as MT
        import eevee
        S.update(MT.build())
        eevee.setup(samples=64, vol_end=600.0)  # (Cycles took 115-170 s a frame here; EEVEE: seconds)
        coll = TS.coll('fx')
        pob, pmat = FX.petal_source(coll)
        c = TS.PATH.pos(S0 + 12.0, 2.0, 5.0)
        ob, md = FX.box_petals(coll, pob, pmat, (c.x, c.y, c.z), (34.0, 40.0, 14.0), 12000)
        f0, f1 = lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2
        fr = list(range(f0, f1 + 1))
        ts = [f / FPS for f in fr]
        lib.bake(ob, FX.input_path(md, 'Clock'), fr, [t * 1.3 for t in ts])
        lib.bake(ob, FX.input_path(md, 'WindX'), fr, [-0.6 * t for t in ts])
        lib.bake(ob, FX.input_path(md, 'WindY'), fr, [-1.4 * t for t in ts])
        S['cam'].data.clip_start = 0.05
        S['cam'].data.clip_end = 6000.0
        return S

    def at(S, t):
        u, (es, ea, eh), (ts_, ta, th) = path_state(t)
        eye, tgt = TS.PATH.pos(es, ea, eh), TS.PATH.pos(ts_, ta, th)
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': lib.lerp(24.0, 30.0, u), 'fstop': 8.0,
                        'focus': lib.lerp(10.0, 120.0, u * u), 'roll': -0.05 * math.sin(math.pi * u)}}

    shot['build'], shot['at'] = build, at
    return shot


def _petal_keys(S, f0, f1, rate=1.0, wind=-0.6):
    """Key the air petals' clock and wind over frames f0..f1 (a steady drift toward the camera)."""
    fr = list(range(f0, f1 + 1))
    lib.bake(S['petal_air'], FX.input_path(S['petal_air_md'], 'Clock'), fr, [rate * f / FPS for f in fr])
    lib.bake(S['petal_air'], FX.input_path(S['petal_air_md'], 'Wind'), fr, [wind * f / FPS for f in fr])


def lampwave(P):
    """tunnel_lampwave (EEVEE), two bars after the first card: low over the petal-strewn flagstones of the dark tunnel,
    the lamps ahead light one by one down the line, one each 16th from the downbeat (a front racing away up the bend),
    and all flare again on the next bar's downbeat."""
    T = Timing(P)
    k0 = bar_index(P, T.c0)
    t0, t1, tb = P.bar(k0 + 7), P.bar(k0 + 9), P.bar(k0 + 8)
    q16 = 60.0 / P.bpm / 4
    S0 = 30.0
    lamp_s = [S0 + 4.0 + 1.14 * k for k in range(44)]  # every third gate from 4 m ahead
    lamps = [(x, 1 if k % 2 == 0 else -1) for k, x in enumerate(lamp_s)]
    shot = {'id': 'tunnel_lampwave', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 16, 'view': 'AgX', 'exposure': 0.0}}

    def build(S):
        import eevee
        TS.LOOK['lamps_every'] = 0
        S.update(TS.build(lamps=lamps))
        FX.add_all(S, title_text=None, air=9000, air_span=(S0 - 3.0, S0 + 60.0))
        eevee.setup(samples=48, vol_end=120.0)
        _petal_keys(S, lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2, rate=1.1, wind=-0.8)
        S['order'] = sorted(S['lamps'], key=lambda x: (x[2].matrix_world.translation - TS.PATH.pos(S0)).length)
        # each lamp's washi glows with its light (the light's energy is keyed by render.py from at())
        f0, f1 = lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2
        fr = list(range(f0, f1 + 1))
        for k, (_, paper, _) in enumerate(S['order']):
            lib.bake(paper, '["glow"]', fr, [lamp_level(k, f / FPS) for f in fr])
        S['cam'].data.clip_start = 0.03
        return S

    def lamp_level(k, t):
        on = t0 + k * q16  # the front: one lamp a 16th
        e = 0.0 if t < on else 1.0 + 1.2 * math.exp(-(t - on) / 0.14)
        e += 0.6 * math.exp(-(t - tb) / 0.22) if t >= tb and t >= on else 0.0  # the next downbeat: all flare
        return e

    def at(S, t):
        lt = t - t0
        s = S0 + 3.2 * lt + 0.25 * lt * lt
        eye = TS.PATH.pos(s, 0.25, 0.55 + 0.04 * math.sin(lt * 2.1))
        tgt = TS.PATH.pos(s + 9.0, 0.05, 1.2)
        lights = {}
        for k, (_, _, L) in enumerate(S['order']):
            lights[L.name] = TS.LOOK['lamp'] * lamp_level(k, t)
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': 22.0, 'fstop': 2.8, 'focus': 4.0,
                        'roll': 0.03 * math.sin(lt * 0.9)}, 'lights': lights}

    shot['build'], shot['at'] = build, at
    return shot


def exit_(P):
    """tunnel_exit (EEVEE), three bars: down the tunnel's last stretch at speed, through the bend, lamps passing, toward
    its mouth where the moon hangs low and huge and floods the haze with light; the frame blooms into it (the next card
    is the moon)."""
    T = Timing(P)
    k0 = bar_index(P, T.c0)
    t0, t1 = P.bar(k0 + 12), P.bar(k0 + 15)
    S0, S1 = 56.0, TS.S_LAST - 0.6
    lamp_s = [56.0 + 2.28 * k for k in range(16)]  # every sixth gate
    lamps = [(x, 1 if k % 2 == 0 else -1) for k, x in enumerate(lamp_s)]
    shot = {'id': 'tunnel_exit', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 16, 'view': 'AgX', 'exposure': 0.0}}

    def build(S):
        import eevee
        TS.LOOK['lamps_every'] = 0
        fwd = TS.PATH.fwd(TS.S_LAST)
        md = Vector((fwd.x, fwd.y, 0.0)).normalized() * math.cos(math.radians(5.5)) + Vector((0, 0, math.sin(math.radians(5.5))))
        TS.LOOK['moon'] = 4.5  # (9 bleached the vermilion cold-white long before the mouth)
        S.update(TS.build(lamps=lamps, moon_dir=md, moon_disc=2.6, ground_extra=60.0))
        FX.add_all(S, title_text=None, air=9000, air_span=(S0 - 3.0, TS.S_LAST + 8.0))
        eevee.setup(samples=48, vol_end=200.0)
        _petal_keys(S, lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2, rate=1.4, wind=-2.0)
        S['cam'].data.clip_start = 0.03
        S['cam'].data.clip_end = 4000.0
        return S

    def at(S, t):
        u = clamp01((t - t0) / (t1 - t0))
        e = u * (0.35 + 0.65 * u)  # accelerating toward the mouth
        s = lib.lerp(S0, S1, e)
        sway = 0.12 * math.sin((t - t0) * 1.3)
        eye = TS.PATH.pos(s, sway, 1.32 + 0.03 * math.sin((t - t0) * 3.0))
        tgt = TS.PATH.pos(min(s + 8.0, TS.S_LAST + 30.0), sway * 0.3, 1.5 + 0.6 * u)
        roll = -6.0 * TS.Path.kappa(s + 4.0)
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': lib.lerp(22.0, 20.0, u), 'fstop': 4.0, 'focus': 6.0,
                        'roll': roll}, 'exposure': 0.6 * ss(0.8, 1.0, u)}

    shot['build'], shot['at'] = build, at
    return shot


def fox_title(P):
    """chorus 2's opening (EEVEE): the stop bar in a tunnel lit only by foxfire (no lamps; the moon dim in the slits).
    The camera brakes; the flames swarm and gather into 千 本 桜, each glyph complete on its sung time (the gold title of
    chorus 1, now written in blue fire); the band's return flares them; on the burst beat they fly apart with the petals
    and the camera surges through, foxfires streaming past."""
    import foxfire as FF
    T = Timing(P, 'chorus2')
    shot = {'id': 'fox_title', 't0': T.c0, 't1': T.end - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 16, 'view': 'AgX', 'exposure': 0.0}}

    def build(S):
        import eevee
        TS.LOOK['moon'] = 5.0
        S.update(TS.build(lamps=[]))
        FX.add_all(S, title_text=TITLE, title_s=S_TITLE, air=5000, air_span=(-3.0, 52.0))
        coll = TS.coll('fx')
        fob, fmat = FF.source(coll)
        S['ff_field'], S['ff_md'] = FF.field(coll, bpy.data.objects['path_curve'], fob, fmat, count=240, s0=-3.0, s1=55.0)
        S['ff_glyphs'] = [FF.gather(coll, g, fob, fmat, -TS.PATH.fwd(S_TITLE), seed=61 + i) for i, g in enumerate(S['title'])]
        # the walls take the foxfire's colour: faint blue lights along the tunnel
        S['ff_lights'] = []
        for k in range(14):
            L = bpy.data.lights.new(f'ffL.{k:02d}', 'POINT')
            L.energy, L.color, L.shadow_soft_size = 7.0, (0.45, 0.72, 1.0), 0.3
            lo = bpy.data.objects.new(f'ffL.{k:02d}', L)
            coll.objects.link(lo)
            lo.location = TS.PATH.pos(-1.0 + k * 3.6, 0.35 * (1 if k % 2 else -1), 1.9)
            S['ff_lights'].append(lo)
        for L in S['title_lights']:
            L.data.color = (0.55, 0.8, 1.0)
        eevee.setup(samples=48, vol_end=120.0)
        f0, f1 = lib.frame_of(shot['t0'], FPS) - 2, lib.frame_of(shot['t1'], FPS) + 2
        fr = list(range(f0, f1 + 1))
        ts = [f / FPS for f in fr]
        lib.bake(S['petal_air'], FX.input_path(S['petal_air_md'], 'Clock'), fr, [T.clock(t) for t in ts])
        lib.bake(S['petal_air'], FX.input_path(S['petal_air_md'], 'Wind'), fr, [T.wind(t) for t in ts])
        lib.bake(S['ff_field'], FX.input_path(S['ff_md'], 'Clock'), fr, [T.clock(t) for t in ts])
        lib.bake(S['ff_field'], FX.input_path(S['ff_md'], 'Wind'), fr, [T.wind(t) * 0.8 for t in ts])
        lib.bake(S['burst'], FX.input_path(S['burst_md'], 'Tau'), fr, [max(0.0, t - T.burst) for t in ts])
        for i, (ob, md) in enumerate(S['ff_glyphs']):
            tg = T.glyphs[i]
            lib.bake(ob, FX.input_path(md, 'Gather'), fr, [clamp01((t - (tg - 0.6)) / 0.6) for t in ts])
            lib.bake(ob, FX.input_path(md, 'Tau'), fr, [max(0.0, t - T.burst) for t in ts])
            lib.bake(ob, FX.input_path(md, 'Clock'), fr, [t for t in ts])
        for g in S['title']:
            g.hide_render = True  # (the glyphs only shape the flames and the petals)
        S['T'] = T
        S['cam'].data.clip_start = 0.03
        return S

    def at(S, t):
        T = S['T']
        s = T.s(t)
        stop = ss(T.c0, T.c0 + 0.5, t) * (1 - ss(T.burst, T.burst + 0.5, t))
        fl = 1 - math.exp(-max(0.0, t - T.burst) / 0.35)
        h = lib.lerp(lib.lerp(1.3, 1.16, stop), 1.36, fl) + 0.025 * math.sin(2 * math.pi * (t - T.burst) / (2 * T.beat)) * fl
        weave = 0.1 * math.sin((t - T.burst) * 1.1) * fl
        eye = TS.PATH.pos(s, weave + shake(t, T.punches + [T.burst], 0.006), h + shake(t, T.punches + [T.burst], 0.01, seed=1.3))
        tgt_stop = TS.PATH.pos(S_TITLE, 0.0, 1.34)
        tgt_fly = TS.PATH.pos(s + 6.5, weave * 0.4, 1.42 + 0.05 * fl)
        k = ss(T.burst - 0.05, T.burst + 0.6, t)
        tgt = tgt_stop.lerp(tgt_fly, k)
        roll = -6.0 * TS.Path.kappa(s + 5.0) * fl
        lens = lib.lerp(lib.lerp(26.0, 30.0, stop), 21.0, fl)
        lights = {}
        for i, L in enumerate(S['title_lights']):
            tg = T.glyphs[i]
            e = 0.0 if t < tg - 0.3 else 3.0 + 30.0 * math.exp(-max(0.0, t - tg) / 0.25)
            e += 25.0 * kicks(t, [T.full], 0.3) if t >= tg else 0.0
            e = e if t < T.burst else 120.0 * math.exp(-(t - T.burst) / 0.15)
            lights[L.name] = e
        flare = 0.8 * kicks(t, T.punches, 0.12) + 0.6 * kicks(t, [T.full], 0.3) + 0.3 * kicks(t, T.snares, 0.12)
        for L in S['ff_lights']:
            lights[L.name] = 7.0 * (1 + flare)
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': lens, 'fstop': lib.lerp(2.4, 4.5, fl),
                        'focus': (tgt_stop - eye).length if k < 0.5 else 3.6, 'roll': roll}, 'lights': lights}

    shot['build'], shot['at'] = build, at
    return shot


def _fox_tunnel(S, s0, s1, flames=240, wall_lights=14, l0=None):
    """The foxfire tunnel's lighting for chorus 2's inside shots: no lamps, the dim moon, the flames, faint blue lights."""
    import foxfire as FF
    coll = TS.coll('fx')
    fob, fmat = FF.source(coll)
    S['ff_field'], S['ff_md'] = FF.field(coll, bpy.data.objects['path_curve'], fob, fmat, count=flames, s0=s0, s1=s1)
    S['ff_lights'] = []
    for k in range(wall_lights):
        L = bpy.data.lights.new(f'ffL.{k:02d}', 'POINT')
        L.energy, L.color, L.shadow_soft_size = 7.0, (0.45, 0.72, 1.0), 0.3
        lo = bpy.data.objects.new(f'ffL.{k:02d}', L)
        coll.objects.link(lo)
        lo.location = TS.PATH.pos((l0 if l0 is not None else s0) + 2.0 + k * 3.6, 0.35 * (1 if k % 2 else -1), 1.9)
        S['ff_lights'].append(lo)
    return S


def fox_procession(P):
    """chorus 2 (EEVEE), two bars: the fox wedding has reached the tunnel. Fox-masked walkers come toward us down the
    foxfire-lit tunnel two abreast, lanterns swinging; the camera backs away before them, low, a little slower than
    they walk."""
    import foxfire as FF
    c0, _ = P.section('chorus2')
    k0 = bar_index(P, c0)
    t0, t1 = P.bar(k0 + 7), P.bar(k0 + 9)
    S0 = 30.0
    shot = {'id': 'fox_procession', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 16, 'view': 'AgX', 'exposure': 0.0}}

    def build(S):
        import eevee
        TS.LOOK['moon'] = 5.0
        S.update(TS.build(lamps=[]))
        FX.add_all(S, title_text=None, air=4000, air_span=(S0 - 10.0, S0 + 30.0))
        _fox_tunnel(S, S0 - 12.0, S0 + 40.0, l0=S0 - 8.0)
        S['walkers'] = FF.procession(TS.coll('fx'), 8)
        eevee.setup(samples=48, vol_end=100.0)
        f0, f1 = lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2
        _petal_keys(S, f0, f1, rate=0.9, wind=0.3)
        fr = list(range(f0, f1 + 1))
        lib.bake(S['ff_field'], FX.input_path(S['ff_md'], 'Clock'), fr, [f / FPS for f in fr])
        S['cam'].data.clip_start = 0.03
        return S

    def at(S, t):
        lt = t - t0
        cam_s = S0 - 0.95 * lt
        objs = {}
        for i, (body, _, _) in enumerate(S['walkers']):
            row, side = i // 2, (1 if i % 2 else -1)
            ph = lt * 5.6 + i * 1.3
            si = S0 + 3.3 + 1.45 * row - 1.12 * lt  # they walk 1.12 m/s toward the camera (it backs away at 0.95)
            m = TS.PATH.matrix(si, side * 0.36, 0.025 * abs(math.sin(ph)), math.radians(4.0 * math.sin(ph * 0.5)))
            objs[body.name] = {'loc': tuple(m.translation), 'rot': tuple(m.to_euler())}
        eye = TS.PATH.pos(cam_s, 0.05, 1.08)
        tgt = TS.PATH.pos(cam_s + 6.0, 0.0, 1.5)
        lights = {L.name: 4.5 * (1 + 0.08 * math.sin(t * 9 + k)) for k, (_, _, L) in enumerate(S['walkers']) if L}
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': 28.0, 'fstop': 2.8, 'focus': 3.8,
                        'roll': 0.02 * math.sin(lt * 0.8)}, 'objs': objs, 'lights': lights}

    shot['build'], shot['at'] = build, at
    return shot


def fox_vortex(P):
    """chorus 2 (EEVEE), three bars: the foxfires whirl into a vortex round the centre line and the camera flies down
    it in one long barrel roll."""
    c0, _ = P.section('chorus2')
    k0 = bar_index(P, c0)
    t0, t1 = P.bar(k0 + 10), P.bar(k0 + 13)
    S0 = 20.0
    shot = {'id': 'fox_vortex', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 16, 'view': 'AgX', 'exposure': 0.0}}

    def build(S):
        import eevee
        TS.LOOK['moon'] = 4.0
        S.update(TS.build(lamps=[]))
        FX.add_all(S, title_text=None, air=6000, air_span=(S0 - 3.0, S0 + 55.0))
        _fox_tunnel(S, S0 - 3.0, S0 + 55.0, flames=520, wall_lights=12)
        eevee.setup(samples=48, vol_end=120.0)
        f0, f1 = lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2
        _petal_keys(S, f0, f1, rate=1.6, wind=-2.5)
        fr = list(range(f0, f1 + 1))
        md, ob = S['ff_md'], S['ff_field']
        lib.bake(ob, FX.input_path(md, 'Clock'), fr, [f / FPS for f in fr])
        lib.bake(ob, FX.input_path(md, 'Swirl'), fr, [ss(t0, t0 + 0.5, f / FPS) for f in fr])
        lib.bake(ob, FX.input_path(md, 'Spin'), fr, [0.9 * max(0.0, f / FPS - t0) ** 1.35 for f in fr])
        lib.bake(ob, FX.input_path(md, 'Wind'), fr, [-1.5 * max(0.0, f / FPS - t0) for f in fr])
        S['cam'].data.clip_start = 0.03
        return S

    def at(S, t):
        u = clamp01((t - t0) / (t1 - t0))
        s = S0 + 7.0 * (t - t0)
        eye = TS.PATH.pos(s, 0.0, 1.4)
        tgt = TS.PATH.pos(s + 7.0, 0.0, 1.4)
        roll = 2 * math.pi * (u * u * (3 - 2 * u))  # one full roll, easing in and out over the three bars
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': 20.0, 'fstop': 4.0, 'focus': 3.0, 'roll': roll}}

    shot['build'], shot['at'] = build, at
    return shot


def quiet(P):
    """chorus 3a (EEVEE), the quiet chorus in one take. The band has gone but the voice; the lamps are out and moonbeams
    fall through the slits between the gates across the haze and the stones; the camera drifts in at a walk. Petals
    drawn out of the air settle into 千 本 桜 in the beams as each is sung, hang glowing faintly, then lift and loosen
    into the air over the lens. With the kicks the lamps relight two at a time from the far end toward us, and the
    camera gathers speed through the riser into the peak."""
    T = Timing(P, 'chorus3a')
    k0 = bar_index(P, T.c0)
    t0, t1 = T.c0, P.section('chorus3a')[1]
    t_rel, t_lit, t_run = P.bar(k0 + 3), P.bar(k0 + 5), P.bar(k0 + 7)  # the title lifts; the lamps relight; the run
    hits = P.events('kick', t_lit - 0.05, t1 - 0.05)
    S0, ST = 12.0, 18.6
    lamp_s = [S0 - 1.0 + 2.28 * k for k in range(22)]  # every sixth gate
    lamps = [(x, 1 if k % 2 == 0 else -1) for k, x in enumerate(lamp_s)]
    shot = {'id': 'quiet', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 16, 'view': 'AgX', 'exposure': 0.4}}
    dt = 0.002
    speed = lambda t: lib.lerp(lib.lerp(0.32, 1.6, ss(t_lit, t_run, t)), 7.0, ss(t_run, t1, t) ** 1.6)
    s_tab = [S0]
    while len(s_tab) * dt < t1 - t0 + 0.5:
        s_tab.append(s_tab[-1] + speed(t0 + len(s_tab) * dt) * dt)
    cam_s = lambda t: s_tab[min(max(int((t - t0) / dt), 0), len(s_tab) - 1)]
    rise = lambda t: max(0.0, t - t_rel)

    def lit_at(k):  # far to near, two lamps a kick
        return hits[k // 2] if k // 2 < len(hits) else 1e9

    def lamp_level(k, t):
        on = lit_at(k)
        return 0.0 if t < on else 1.0 + 1.4 * math.exp(-(t - on) / 0.14)

    def build(S):
        import eevee
        TS.LOOK.update({'lamps_every': 0, 'moon': 22.0, 'haze': 0.016})
        S.update(TS.build(lamps=lamps))
        FX.add_all(S, title_text=TITLE, title_s=ST, air=7000, air_span=(S0 - 3.0, S0 + 40.0))
        coll = TS.coll('fx')
        pob, pmat = bpy.data.objects['petal_src'], bpy.data.materials['petal']
        S['ptitle'], S['ptitle_md'] = FX.petal_title(coll, S['title'], pob, pmat, -TS.PATH.fwd(ST))
        for g in S['title']:
            g.hide_render = True  # (the glyphs only shape the petals)
        eevee.setup(samples=48, vol_tile='2', vol_samples=128, vol_end=80.0)  # (fine froxels: the beams through the slits)
        f0, f1 = lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2
        fr = list(range(f0, f1 + 1))
        ts = [f / FPS for f in fr]
        _petal_keys(S, f0, f1, rate=0.35, wind=-0.15)
        ob, md = S['ptitle'], S['ptitle_md']
        for i in range(len(TITLE)):
            tg = T.glyph_frame(i)
            lib.bake(ob, FX.input_path(md, f'Gather{i}'), fr, [clamp01((t - (tg - 0.7)) / 0.7) for t in ts])
        lib.bake(ob, FX.input_path(md, 'Rise'), fr, [rise(t) for t in ts])
        lib.bake(ob, FX.input_path(md, 'Clock'), fr, ts)
        lib.bake(ob, FX.input_path(md, 'Glow'), fr, [ss(T.glyphs[0] - 0.5, T.glyphs[-1] + 0.3, t) * (1 - 0.5 * ss(t_rel, t_rel + 3.0, t)) for t in ts])
        S['order'] = sorted(S['lamps'], key=lambda x: -(x[2].matrix_world.translation - TS.PATH.pos(S0)).length)
        for k, (_, paper, _) in enumerate(S['order']):
            lib.bake(paper, '["glow"]', fr, [lamp_level(k, t) for t in ts])
        S['cam'].data.clip_start = 0.03
        return S

    def at(S, t):
        s = cam_s(t)
        title = TS.PATH.pos(ST, 0.0, 1.32 + 0.6 * rise(t))
        ahead = TS.PATH.pos(s + 8.0, 0.0, 1.3)
        k = ss(t_rel + 1.2, t_rel + 4.5, t)  # from watching the title lift to looking down the tunnel
        tgt = title.lerp(ahead, k)
        eye = TS.PATH.pos(s, 0.08 * math.sin((t - t0) * 0.45), 1.22 + 0.015 * math.sin((t - t0) * 1.1))
        lights = {L.name: TS.LOOK['lamp'] * lamp_level(j, t) for j, (_, _, L) in enumerate(S['order'])}
        for L in S['title_lights']:
            lights[L.name] = 0.0
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': lib.lerp(30.0, 24.0, ss(t_run, t1, t)), 'fstop': lib.lerp(2.0, 4.0, k),
                        'focus': lib.lerp((title - eye).length, 6.0, k), 'roll': 0.01 * math.sin((t - t0) * 0.6)}, 'lights': lights}

    shot['build'], shot['at'] = build, at
    return shot


def _strike_title(S, T, fr, ts):
    """Key the gold title as in chorus 1: each glyph unseen until sung, struck like a seal, gone in the burst; its inner
    light; the burst's clock."""
    lib.bake(S['burst'], FX.input_path(S['burst_md'], 'Tau'), fr, [max(0.0, t - T.burst) for t in ts])
    for i, g in enumerate(S['title']):
        tg = T.glyph_frame(i)
        lib.bake(g, '["ignite"]', fr, [ignite(T, i, t) for t in ts])
        lib.bake(g, 'hide_render', fr, [1.0 if (t < tg - 1e-4 or t >= T.burst - 0.5 / FPS) else 0.0 for t in ts], interp='CONSTANT')
        lib.bake(g, 'scale', fr, [(k_, k_, k_) for k_ in (1.0 + 0.14 * math.exp(-max(0.0, t - tg) / 0.06) for t in ts)])


def _title_lights(S, T, t):
    out = {}
    for i, L in enumerate(S['title_lights']):
        tg = T.glyph_frame(i)
        e = 0.0 if t < tg else 4.0 + 46.0 * math.exp(-(t - tg) / 0.2)
        out[L.name] = e if t < T.burst else 160.0 * math.exp(-(t - T.burst) / 0.12)
    return out


def peak(P):
    """chorus 3, the peak (EEVEE), three bars: the camera tears up the tunnel low and fast; on the downbeat a front of
    light races away up the line flaring every lamp ahead (they stay bright, and flare with the snares); 千 本 桜 is
    struck in gold ahead as each is sung and bursts into petals just as the camera flies through it; a storm of petals."""
    T = Timing(P, 'chorus3')
    k0 = bar_index(P, T.c0)
    t0, t1 = T.c0, P.bar(k0 + 3)
    q16 = 60.0 / P.bpm / 4
    S0, V = 4.0, 6.4
    s_of = lambda t: S0 + V * (t - t0) + 1.4 * max(0.0, t - T.burst) ** 1.2  # (a surge through the burst)
    ST = s_of(T.burst + 0.12)  # the camera meets the title just after it bursts
    lamp_s = [S0 + 2.0 + 1.52 * k for k in range(40)]  # every fourth gate
    lamps = [(x, 1 if k % 2 == 0 else -1) for k, x in enumerate(lamp_s)]
    snares = P.events('snare', t0 - 0.05, t1)
    shot = {'id': 'peak', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 16, 'view': 'AgX', 'exposure': 0.0}}

    def lamp_level(k, t):
        on = t0 + k * q16 * 0.5  # the front: a lamp every 32nd up the line
        e = 1.0 if t < on else 1.8 + 1.6 * math.exp(-(t - on) / 0.12)
        return e + 0.5 * kicks(t, snares, 0.11)

    def build(S):
        import eevee
        TS.LOOK['lamps_every'] = 0
        S.update(TS.build(lamps=lamps))
        FX.add_all(S, title_text=TITLE, title_s=ST, air=12000, air_span=(S0 - 3.0, S0 + 45.0))
        eevee.setup(samples=32, vol_end=100.0)
        f0, f1 = lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2
        fr = list(range(f0, f1 + 1))
        ts = [f / FPS for f in fr]
        _petal_keys(S, f0, f1, rate=1.8, wind=-2.4)
        _strike_title(S, T, fr, ts)
        S['order'] = sorted(S['lamps'], key=lambda x: (x[2].matrix_world.translation - TS.PATH.pos(S0)).length)
        for k, (_, paper, _) in enumerate(S['order']):
            lib.bake(paper, '["glow"]', fr, [lamp_level(k, t) for t in ts])
        S['cam'].data.clip_start = 0.03
        return S

    def at(S, t):
        s = s_of(t)
        lt = t - t0
        weave = 0.14 * math.sin(lt * 1.7)
        eye = TS.PATH.pos(s, weave + shake(t, [T.burst], 0.01), 0.86 + 0.03 * math.sin(lt * 4.6))
        tgt = TS.PATH.pos(s + 7.5, weave * 0.3, 1.25)
        lights = {L.name: TS.LOOK['lamp'] * lamp_level(k, t) for k, (_, _, L) in enumerate(S['order'])}
        lights.update(_title_lights(S, T, t))
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': 20.0, 'fstop': 4.0, 'focus': 4.0,
                        'roll': -7.0 * TS.Path.kappa(s + 5.0) + 0.012 * shake(t, [T.burst], 1.0, hz=6.0, rel=0.2)}, 'lights': lights}

    shot['build'], shot['at'] = build, at
    return shot


def spirits(P):
    """chorus 3 (EEVEE), four bars: the whole tunnel at once, the lamps at full, the foxfire of chorus 2 back and
    streaming, the petals in a storm; the camera low and fast, weaving from side to side; on every downbeat a front of
    light racing away up the line."""
    c0, _ = P.section('chorus3')
    k0 = bar_index(P, c0)
    t0, t1 = P.bar(k0 + 4), P.bar(k0 + 8)
    q16 = 60.0 / P.bpm / 4
    downs = [P.bar(k0 + 4 + k) for k in range(4)]
    snares = P.events('snare', t0 - 0.05, t1)
    S0, V = 14.0, 6.0
    lamp_s = [S0 + 1.0 + 2.28 * k for k in range(26)]  # every sixth gate (a lamp's shadow maps are the cost here)
    lamps = [(x, 1 if k % 2 == 0 else -1) for k, x in enumerate(lamp_s)]
    shot = {'id': 'spirits', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 16, 'view': 'AgX', 'exposure': 0.0}}

    def lamp_level(k, s_lamp, t):
        e = 1.6
        for d in downs:  # each downbeat's front, a lamp every 16th ahead of the camera
            on = d + max(0.0, s_lamp - (S0 + V * (d - t0))) / 2.28 * q16
            if t >= on:
                e += 1.3 * math.exp(-(t - on) / 0.13)
        return e + 0.4 * kicks(t, snares, 0.11)

    def build(S):
        import eevee
        TS.LOOK['lamps_every'] = 0
        TS.LOOK['moon'] = 6.0
        S.update(TS.build(lamps=lamps))
        FX.add_all(S, title_text=None, air=14000, air_span=(S0 - 3.0, S0 + 50.0))
        _fox_tunnel(S, S0 - 3.0, S0 + 50.0, flames=380, wall_lights=6)
        eevee.setup(samples=32, vol_end=100.0)
        f0, f1 = lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2
        fr = list(range(f0, f1 + 1))
        ts = [f / FPS for f in fr]
        _petal_keys(S, f0, f1, rate=1.8, wind=-2.6)
        lib.bake(S['ff_field'], FX.input_path(S['ff_md'], 'Clock'), fr, ts)
        lib.bake(S['ff_field'], FX.input_path(S['ff_md'], 'Wind'), fr, [-1.6 * (t - t0) for t in ts])
        S['order'] = [(paper, L, (L.matrix_world.translation - TS.PATH.pos(S0)).length + S0) for _, paper, L in S['lamps']]
        for paper, _, sl in S['order']:
            lib.bake(paper, '["glow"]', fr, [lamp_level(0, sl, t) for t in ts])
        S['cam'].data.clip_start = 0.03
        return S

    def at(S, t):
        lt = t - t0
        s = S0 + V * lt
        weave = 0.42 * math.sin(2 * math.pi * lt / (4 * 60.0 / P.bpm * 2))  # side to side over two bars
        eye = TS.PATH.pos(s, weave, 0.72 + 0.05 * math.sin(lt * 3.3))
        tgt = TS.PATH.pos(s + 7.0, weave * 0.2, 1.2)
        lights = {L.name: TS.LOOK['lamp'] * lamp_level(0, sl, t) for _, L, sl in S['order']}
        for L in S['ff_lights']:
            lights[L.name] = 7.0 * (1 + 0.5 * kicks(t, downs, 0.3))
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': 19.0, 'fstop': 4.0, 'focus': 4.0,
                        'roll': -0.09 * math.cos(2 * math.pi * lt / (4 * 60.0 / P.bpm * 2)) - 6.0 * TS.Path.kappa(s + 5.0)}, 'lights': lights}

    shot['build'], shot['at'] = build, at
    return shot


def ascent(P):
    """chorus 3's last two bars (EEVEE): the last stretch of the tunnel to the top. In the last gate the summit's light:
    the hall lit from within, its lanterns, the moon high over it, growing as the camera slows and rises; out through
    the last gate on the outro's downbeat (the summit matte takes over just past it)."""
    import summit as SU
    c0, c1 = P.section('chorus3')
    k0 = bar_index(P, c0)
    t0, t1 = P.bar(k0 + 8), c1
    S1 = TS.S_LAST + 0.9  # just through the last gate at the cut
    S0 = S1 - 17.0
    lamp_s = [S0 - 2.0 + 2.28 * k for k in range(10)]
    lamps = [(x, 1 if k % 2 == 0 else -1) for k, x in enumerate(lamp_s)]
    shot = {'id': 'ascent', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 24, 'view': 'AgX', 'exposure': 0.0}}

    def build(S):
        import eevee
        TS.LOOK['lamps_every'] = 0
        fwd = TS.PATH.fwd(TS.S_LAST)
        md = (Vector((fwd.x, fwd.y, 0.0)).normalized() * math.cos(math.radians(27.0)) + Vector((0, 0, math.sin(math.radians(27.0))))).normalized()
        TS.LOOK['moon'] = 3.5
        S.update(TS.build(lamps=lamps, moon_dir=md, moon_disc=2.1, ground_extra=-5.0))  # (the terrace stops at the last gate: the precinct has its own gravel)
        FX.add_all(S, title_text=None, air=7000, air_span=(S0 - 3.0, TS.S_LAST + 1.0))
        S['summit'] = SU.precinct(TS.S_LAST, S['mats'])
        eevee.setup(samples=32, vol_end=140.0)
        _petal_keys(S, lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2, rate=1.2, wind=-1.2)
        S['cam'].data.clip_start = 0.03
        S['cam'].data.clip_end = 3000.0
        return S

    def at(S, t):
        u = clamp01((t - t0) / (t1 - t0))
        s = lib.lerp(S0, S1, 1 - (1 - u) ** 1.6)  # slowing toward the top
        eye = TS.PATH.pos(s, 0.0, lib.lerp(1.05, 1.5, u * u))
        hall = SU_local(S, 0.0, 19.0, 4.6)
        tgt = TS.PATH.pos(s + 8.0, 0.0, 1.4).lerp(hall, ss(0.0, 0.7, u))
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': lib.lerp(22.0, 24.0, u), 'fstop': 5.6, 'focus': 12.0, 'roll': 0.0}}

    def SU_local(S, x, y, z):
        return S['summit']['frame'] @ Vector((x, y, z))

    shot['build'], shot['at'] = build, at
    return shot


def credits_walk(P):
    """the outro's credits (EEVEE), six bars: a slow climb through a stretch of the line where the pillars carry,
    brushed like the donors' names, the names of the people and the tools that made this film (make_credits.py); a
    warm lamp carried a step ahead lights each pair as it comes up; petals drifting."""
    import json
    c0, _ = P.section('outro')
    k0 = bar_index(P, c0)
    t0, t1 = P.bar(k0 + 8), P.bar(k0 + 14)
    with open(os.path.join(TS.TEX, 'credits.json'), encoding='utf-8') as fh:
        n = json.load(fh)['cols']
    SC0, GAP = 44.0, 1.9  # every fifth gate
    cred_s = [SC0 + GAP * k for k in range(n)]
    S0, S1 = SC0 - 4.5, cred_s[-1] + 2.2
    lamps = [(S1 + 2.0 + 2.28 * k, 1 if k % 2 == 0 else -1) for k in range(8)]  # only beyond the credits (a lamp would hide a name)
    shot = {'id': 'credits', 't0': t0, 't1': t1 - 1.0 / FPS, 'fps': FPS, 'res': (1920, 1080),
            'render': {'samples': 16, 'view': 'AgX', 'exposure': 0.2}}

    def build(S):
        import eevee
        TS.LOOK['lamps_every'] = 0
        S.update(TS.build(lamps=lamps))
        FX.add_all(S, title_text=None, air=6000, air_span=(S0 - 3.0, S1 + 10.0))
        cm = TS.mat_vermilion(credits=True)
        for k, s in enumerate(cred_s):
            g = min(S['gates'], key=lambda gg: abs(gg['s'] - s))
            g['credit'] = float(k)
            g.material_slots[0].link = 'OBJECT'
            g.material_slots[0].material = cm
        L = bpy.data.lights.new('carry', 'POINT')
        L.energy, L.color, L.shadow_soft_size = 24.0, TS.hexlin('#FFC488'), 0.3
        TS.coll('fx').objects.link(bpy.data.objects.new('carry', L))
        eevee.setup(samples=32, vol_end=60.0)
        _petal_keys(S, lib.frame_of(t0, FPS) - 2, lib.frame_of(t1, FPS) + 2, rate=0.6, wind=-0.3)
        S['cam'].data.clip_start = 0.03
        return S

    def at(S, t):
        u = clamp01((t - t0) / (t1 - t0))
        s = lib.lerp(S0, S1, u)
        eye = TS.PATH.pos(s, 0.05 * math.sin((t - t0) * 0.7), 1.45)
        tgt = TS.PATH.pos(s + 6.0, 0.45, 1.5)  # (turned a little to the right pillars: the names)
        return {'cam': {'eye': tuple(eye), 'target': tuple(tgt), 'lens': 26.0, 'fstop': 5.6, 'focus': 3.0, 'roll': -4.0 * TS.Path.kappa(s + 3.0)},
                'objs': {'carry': {'loc': tuple(TS.PATH.pos(s + 2.2, 0.0, 1.7)), 'rot': (0.0, 0.0, 0.0)}}}

    shot['build'], shot['at'] = build, at
    return shot


SHOTS = {'tunnel_entry': entry, 'tunnel_reveal': reveal, 'tunnel_lampwave': lampwave, 'tunnel_exit': exit_,
         'fox_title': fox_title, 'fox_procession': fox_procession, 'fox_vortex': fox_vortex, 'quiet': quiet,
         'peak': peak, 'spirits': spirits, 'ascent': ascent, 'credits': credits_walk}


# ---- 2.5D matte plates (blender/matte.py renders the still and its depth; the engine's matte.ts moves through them)
def _mountain():
    import mountain as MT
    MT.build()


def _mountain_fox():
    import mountain as MT
    MT.build(foxfire=True)


def _summit_local(x, y, z):
    """A point in the summit precinct's frame (summit.py: origin at the line's end, +Y on along it)."""
    import mountain as MT
    return TS.PATH.matrix(MT.S_HI + 0.3) @ Vector((x, y, z))


def _summit():
    """The precinct at the top of the line, the moon high over the hall (straight on, a little left)."""
    import mountain as MT
    MT.MLOOK.update({'moon_elev': 27.0, 'light_elev': 30.0, 'moon_az': math.degrees(MT.MountainPath().theta(MT.S_HI)) + 7.0})
    MT.build(summit=True)


def _finale():
    """The whole line from high behind its foot, zigzagging up the spur to the shrine; the moon just over the summit
    (the far ridges behind it, as they are meant to be seen)."""
    import mountain as MT
    MT.MLOOK.update({'moon_elev': 5.5, 'light_elev': 22.0, 'moon_az': 12.5, 'mist': 0.003, 'air': 0.0003})  # (seen from this far, the near shots' mist buries the slopes)
    S = MT.build(summit=True, land_y0=-300, bench=28.0)  # (from this far a 7 m bench reads as an embankment wall)
    S['haze'].location, S['haze'].scale = (0.0, 300.0, 60.0), (2600.0, 2600.0, 300.0)  # (its box's edges out of sight)


MATTES = {
    # the line climbing the mountain through the cedars among the lit cherry trees, the moon over the ridge: the
    # engine pushes in and rises from here
    'reveal': {'build': _mountain, 'lens': 26.0, 'overscan': 1.12,
               'eye': lambda: TS.PATH.pos(168.0, -6.0, 40.0), 'target': lambda: TS.PATH.pos(326.0, -8.0, 26.0)},
    # chorus 2: high over the mountain, the line winding up through the lit cherry trees as a trail of blue foxfire
    'foxline': {'build': _mountain_fox, 'lens': 26.0, 'overscan': 1.12,
                'eye': lambda: TS.PATH.pos(40.0, -55.0, 95.0), 'target': lambda: TS.PATH.pos(210.0, -25.0, 0.0)},
    # low beside the tunnel's glowing wall: a stone lantern, a cherry tree lit from below, the moon over the cedars
    'wall': {'build': _mountain, 'lens': 24.0, 'overscan': 1.12,
             'eye': lambda: TS.PATH.pos(181.0, 4.3, 2.1), 'target': lambda: TS.PATH.pos(194.0, 1.2, 2.3)},
    # the outro: just past the last gate, the approach between the stone lanterns and the fox guardians to the lit
    # hall, the moon high over its roof
    'summit': {'build': _summit, 'lens': 24.0, 'overscan': 1.12,
               'eye': lambda: _summit_local(0.0, 1.0, 1.5), 'target': lambda: _summit_local(0.0, 19.0, 5.2),
               # the paper lanterns under the eave and the stone lanterns' fire boxes: the engine flares them on the beats
               'points': lambda: [tuple(_summit_local(x, 15.3, 3.55)) for x in (-2.6, -0.9, 0.9, 2.6)] + [tuple(_summit_local(x, y, 1.18)) for x in (-2.1, 2.1) for y in (3.2, 8.2)]},
    # the whole lit line zigzagging up the mountain to the shrine, from high behind its foot
    'finale': {'build': _finale, 'lens': 30.0, 'overscan': 1.12,
               'eye': lambda: Vector((10.0, -170.0, 120.0)), 'target': lambda: Vector((-55.0, 230.0, 18.0)),
               # the line's lamps every 2 m, bottom to top, then the shrine: the engine runs a front of light up them
               'points': lambda: [tuple(TS.PATH.pos(s, 0.0, 3.3)) for s in [-6.0 + 2.0 * k for k in range(204)]] + [tuple(_summit_local(0.0, 18.0, 4.0))]},  # (over the roofs: the relief would hide them)
}
