// The build (docs/TREATMENT.md): inside the clock. A match cut from the cinema's clock (solo.ts): its face, lit from
// behind, shows the shadows of the works turning; time starts to race and the camera falls through the dial into the
// clockwork: brass wheels at every depth, meshing, the escapement ticking on the snares, the balance swinging, petals
// and dust adrift in the warm light, spiralling deeper as everything spins faster bar by bar. On the last bar the camera
// is pulled back out through the works and the dial while the hands sweep round to midnight, landing on XII on the
// downbeat (the cut into pre-chorus 3).
// One screen-space drawing with its own camera: every part has a depth z (the dial at 1), drawn 1 / (z - zc) times its
// size as the camera's zc moves in and out (true parallax: the near wheels pass the lens), the whole frame rolling.
import type { Build } from './poster';
import type { AudioData } from '../engine/audio';
import { W, H, SCALE } from '../engine/gl';
import { TAU, clamp, ease, hash, lerp } from '../engine/util';
import { PAL, decoFrame } from './taisho';
import { clockFace, soloClock } from './solo';

type C = CanvasRenderingContext2D;
type Wheel = { x: number; y: number; z: number; r: number; n: number; spin: number; phase: number; kind: 'wheel' | 'escape' | 'pinion' | 'plate'; tone: number; spr?: HTMLCanvasElement; sh?: HTMLCanvasElement };

function sprite(w: number, h: number, draw: (c: C) => void, res = 1) {
  const cv = document.createElement('canvas'), k = SCALE * res;
  cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
  const c = cv.getContext('2d')!; c.scale(k, k); draw(c);
  return cv;
}
const mix = (a: [number, number, number], b: [number, number, number], k: number) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
const DARK: [number, number, number] = [34, 24, 14];

/** A wheel's outline (teeth round the rim, the windows between its spokes) as one even-odd path, centred at 0. */
function wheelPath(w: Wheel, h: number) {
  const p = new Path2D(), R = w.r, n = w.n, aw = TAU / n, ro = R + h / 2, rr = R - h / 2;
  const at = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
  for (let i = 0; i < n; i++) {
    const ac = (i + 0.5) * aw;
    const pts: [number, number][] = w.kind === 'escape' // club teeth, raked forward
      ? [at(rr, ac - 0.5 * aw), at(ro, ac + 0.12 * aw), at(ro - h * 0.35, ac + 0.3 * aw), at(rr, ac + 0.22 * aw)]
      : [at(rr, ac - 0.5 * aw), at(rr, ac - 0.3 * aw), at(ro, ac - 0.16 * aw), at(ro, ac + 0.16 * aw), at(rr, ac + 0.3 * aw)];
    pts.forEach(([x, y], j) => (i === 0 && j === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  }
  p.closePath();
  if (w.kind === 'wheel' || w.kind === 'escape') { // the windows between the spokes
    const ns = w.kind === 'escape' ? 4 : 5, inner = rr - R * 0.15, hub = R * 0.26, dh = (R * 0.085) / hub, dr = (R * 0.065) / inner;
    for (let k = 0; k < ns; k++) {
      const a0 = (k / ns) * TAU, a1 = ((k + 1) / ns) * TAU;
      p.moveTo(...at(inner, a0 + dr)); p.arc(0, 0, inner, a0 + dr, a1 - dr); p.lineTo(...at(hub, a1 - dh)); p.arc(0, 0, hub, a1 - dh, a0 + dh, true); p.closePath();
    }
  }
  return p;
}
/** A brass wheel drawn once: brushed in circles (so it reads the same at any turn), gilt line on every edge, the hub
 *  with its ruby; tone 0..1 from dark bronze far back to bright brass near. */
function drawWheel(c: C, w: Wheel, h: number) {
  const R = w.r, p = wheelPath(w, h), lw = Math.max(1, R * 0.008);
  if (w.kind === 'plate') { // the back plate: dark gilt brass finished in perlage (overlapping spots of circular graining)
    const g = c.createRadialGradient(0, 0, R * 0.05, 0, 0, R); g.addColorStop(0, mix([84, 58, 28], DARK, 0.4)); g.addColorStop(1, mix([40, 28, 14], DARK, 0.5));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    const sp = R * 0.032;
    for (let y = -R; y < R; y += sp * 0.8) for (let x = -R + ((Math.round(y / (sp * 0.8)) % 2) * sp) / 2; x < R; x += sp) {
      if (x * x + y * y > R * R * 0.96) continue;
      for (let k = 1; k <= 3; k++) { c.strokeStyle = k % 2 ? 'rgba(240,206,130,0.035)' : 'rgba(20,12,6,0.06)'; c.lineWidth = sp * 0.09; c.beginPath(); c.arc(x, y, sp * 0.18 * k, 0, TAU); c.stroke(); }
    }
    return;
  }
  const g = c.createRadialGradient(0, 0, R * 0.05, 0, 0, R * 1.05);
  g.addColorStop(0, mix([246, 214, 140], DARK, 1 - w.tone)); g.addColorStop(0.55, mix([214, 163, 72], DARK, 1 - w.tone)); g.addColorStop(1, mix([140, 96, 38], DARK, 1 - w.tone));
  c.fillStyle = g; c.fill(p, 'evenodd');
  c.save(); c.clip(p, 'evenodd'); // brushed in circles
  for (let r = R * 0.06, k = 0; r < R * 1.06; r += Math.max(1.6, R * 0.012), k++) { c.strokeStyle = k % 2 ? 'rgba(255,240,200,0.07)' : 'rgba(40,24,10,0.08)'; c.lineWidth = Math.max(0.8, R * 0.006); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
  c.restore();
  c.strokeStyle = mix([250, 224, 150], [120, 90, 50], 1 - w.tone); c.lineWidth = lw; c.stroke(p);
  if (w.kind !== 'pinion') {
    c.beginPath(); c.arc(0, 0, R - h / 2 - R * 0.12, 0, TAU); c.stroke(); // the rim's inner edge
    c.fillStyle = mix([170, 120, 50], DARK, 1 - w.tone); c.beginPath(); c.arc(0, 0, R * 0.17, 0, TAU); c.fill(); c.stroke();
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.5; c.fillStyle = mix([120, 90, 60], DARK, 1 - w.tone); c.beginPath(); c.arc(Math.cos(a) * R * 0.11, Math.sin(a) * R * 0.11, R * 0.022, 0, TAU); c.fill(); } // its screws
  }
  c.fillStyle = mix([196, 20, 40], DARK, (1 - w.tone) * 0.7); c.beginPath(); c.arc(0, 0, Math.max(2, R * 0.055), 0, TAU); c.fill(); // the ruby
  c.fillStyle = `rgba(255,230,230,${0.8 * w.tone})`; c.beginPath(); c.arc(-R * 0.018, -R * 0.018, Math.max(0.8, R * 0.016), 0, TAU); c.fill();
}
function prepare(w: Wheel) {
  const h = w.kind === 'plate' ? 0 : ((TAU * w.r) / w.n) * 0.42, S = w.r + h + 4, res = Math.min(1.6, 1300 / (2 * S));
  w.spr = sprite(2 * S, 2 * S, (c) => { c.translate(S, S); drawWheel(c, w, h); }, res);
  if (w.kind !== 'plate') w.sh = sprite(2 * S, 2 * S, (c) => { c.translate(S, S); c.fillStyle = '#000'; c.fill(wheelPath(w, h), 'evenodd'); }, Math.min(0.6, res));
  return S;
}

/** The time of night on the dial through the build (seconds of the day): ticking on from the solo's clock, racing (out
 *  of sight in the works), then sweeping round to land on midnight at the end. */
function dialTime(A: AudioData, t: number, T0: number, T8: number, T1: number) {
  const [h0, m0, s0] = soloClock(A, T0), c0 = h0 * 3600 + m0 * 60 + s0;
  if (t < T8) { const b = A.beatAt(t) - A.beatAt(T0); return c0 + Math.floor(b * (1 + Math.max(0, b - 4) * 0.5)); } // a second a beat, then faster
  const w = clamp((t - T8) / (T1 - T8)), D = 5600; // the minute hand ~2 turns a second at first, slowing onto XII
  return 86400 - D * (1 - w) * (1 - w);
}

export const CLOCKWORKS: Record<string, (b: Build) => void> = {
  clockworks(b) {
    const A = b.audio, T0 = b.start, T1 = b.end, bar0 = Math.round(A.barAt(T0)), B = (k: number) => A.timeOfBar(bar0 + k);
    const T2 = B(2), T8 = Math.min(B(8), T1 - 0.6), BAR = B(1) - B(0);
    const snares = A.ev.in(T0, T1, 'snare').map((e) => e.t);
    // the camera: creeping in at the dial, falling through it, drifting deeper through the works; pulled back out
    const zc = (t: number) => {
      if (t < B(1)) return 0.08 * ease.inQuad(clamp((t - T0) / BAR));
      if (t < T2) return lerp(0.08, 1.18, ease.inCubic(clamp((t - B(1)) / BAR)));
      if (t < T8) return 1.18 + (3.3 - 1.18) * ease.outQuad(clamp((t - T2) / (T8 - T2))) + 0.04 * Math.sin((t - T2) * 1.3);
      return lerp(3.3 + 0.04 * Math.sin((T8 - T2) * 1.3), 0, ease.inOutCubic(clamp((t - T8) / (T1 - T8))));
    };
    const roll = (t: number) => (t < T2 ? 0 : t < T8 ? 1.05 * ease.inOutQuad(clamp((t - T2) / (T8 - T2))) : 1.05 * (1 - ease.inOutCubic(clamp((t - T8) / (T1 - T8)))));
    const sway = (t: number): [number, number] => { const k = t < T2 ? 0 : t < T8 ? 1 : 1 - clamp((t - T8) / (T1 - T8)); return [k * 120 * Math.sin((t - T2) * 0.55), k * 80 * Math.sin((t - T2) * 0.41 + 1.2)]; };
    // how far the works have turned: their speed doubling every two bars (closed form of the integral)
    const tau = 2 * BAR, w0 = 0.22, turned = (t: number) => (w0 * tau) / Math.LN2 * (Math.pow(2, (t - T0) / tau) - 1);
    const speed = (t: number) => w0 * Math.pow(2, (t - T0) / tau);
    // the works: the centre wheel behind the dial's arbor with its train, wheels at every depth, the back plate
    const wheels: Wheel[] = [];
    const add = (x: number, y: number, z: number, n: number, spin: number, kind: Wheel['kind'] = 'wheel', phase = 0) => {
      const w: Wheel = { x, y, z, r: 3.6 * n, n, spin, phase, kind, tone: clamp(1.25 - (z - 1) * 0.16, 0.25, 1) };
      wheels.push(w); return w;
    };
    /** A wheel meshing with `a` at the angle `ang` (the line between their centres), its teeth set in a's gaps. */
    const mesh = (a: Wheel, n: number, ang: number, kind: Wheel['kind'] = 'wheel') => {
      const d = a.r + 3.6 * n, w = add(a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, a.z, n, -a.spin * (a.n / n), kind);
      w.phase = ang + Math.PI - Math.PI / n + (a.n / n) * (ang - a.phase);
      return w;
    };
    const centre = add(0, 0, 1.6, 96, 1);
    const third = mesh(centre, 40, -0.55); const fourth = mesh(third, 30, -1.6); mesh(fourth, 14, 0.2, 'pinion');
    const big = add(-760, 420, 2.4, 140, -0.5); mesh(big, 36, -0.35); mesh(big, 24, 2.2, 'pinion');
    const side = add(820, 360, 2.0, 64, 0.8); mesh(side, 20, 2.6, 'pinion');
    const deep = add(260, -620, 3.6, 120, -0.35); mesh(deep, 44, 2.4);
    add(-420, -420, 1.35, 52, 1.6); // a near one the camera passes close by
    add(560, -180, 2.9, 34, -2.2); add(-260, 260, 3.1, 28, 2.6, 'wheel', 0.4);
    add(900, -560, 4.6, 160, 0.25); add(-1100, -300, 5.2, 180, -0.2); add(120, 980, 5.6, 150, 0.3);
    const low = add(-80, 720, 3.4, 90, -0.6); mesh(low, 30, -2.4); add(-640, -40, 2.7, 60, 0.9); add(700, 160, 3.9, 70, -0.7); add(380, 560, 1.95, 46, 1.3);
    add(0, 0, 9.0, 300, 0.05, 'plate').r = 7000; // (the back plate fills the frame from any depth)
    const esc = add(-210, 140, 2.15, 15, 1, 'escape'); // the escapement: stepped by the snares, not by the train
    for (const w of wheels) prepare(w);
    wheels.sort((p, q) => q.z - p.z);
    const steps = (t: number) => { let k = 0, f = 0; for (const s of snares) { if (s > t) break; const u = clamp((t - s) / 0.07); k += u < 1 ? 0 : 1; f = u < 1 ? ease.outCubic(u) : 0; } return k + f; };
    // petals and dust adrift in the works, at depth
    const motes = Array.from({ length: 260 }, (_, i) => ({ x: (hash(i, 1) - 0.5) * 2600, y: (hash(i, 2) - 0.5) * 1600, z: 1.1 + hash(i, 3) * 6.5, petal: i % 3 === 0, ph: hash(i, 4) * TAU }));
    b.add((() => { const cv = document.createElement('canvas'); cv.width = W * SCALE; cv.height = H * SCALE; const c = cv.getContext('2d')!; c.scale(SCALE, SCALE); const g = c.createRadialGradient(W * 0.32, H * 0.3, 40, W / 2, H / 2, W * 0.75); g.addColorStop(0, '#2a1a1c'); g.addColorStop(1, '#0a070b'); c.fillStyle = g; c.fillRect(0, 0, W, H); return cv; })());
    b.dyn((c, t) => {
      const z0 = zc(t), rl = roll(t), [cx, cy] = sway(t), turn = turned(t), sp = speed(t);
      const proj = (x: number, y: number, z: number): [number, number, number] => {
        const k = 1 / (z - z0), px = (x - cx) * k, py = (y - cy) * k, cr = Math.cos(rl), sr = Math.sin(rl);
        return [W / 2 + px * cr - py * sr, H / 2 + px * sr + py * cr, k];
      };
      // the warm light from the upper left, its rays through the works
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const a = 0.55 + k * 0.13 + 0.03 * Math.sin(t * 0.4 + k), x0 = -200 + k * 180, y0 = -260;
        const g = c.createLinearGradient(x0, y0, x0 + Math.cos(a) * 2200, y0 + Math.sin(a) * 2200); g.addColorStop(0, 'rgba(255,200,120,0.15)'); g.addColorStop(1, 'rgba(255,200,120,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(a - 0.04) * 2400, y0 + Math.sin(a - 0.04) * 2400); c.lineTo(x0 + Math.cos(a + 0.04) * 2400, y0 + Math.sin(a + 0.04) * 2400); c.closePath(); c.fill();
      }
      c.restore();
      const dialZ = 1, behindDial = z0 < dialZ;
      const drawParts = (minZ: number) => {
        for (const w of wheels) {
          if (w.z - z0 < 0.07 || w.z < minZ) continue;
          const [sx, sy, k] = proj(w.x, w.y, w.z), size = (w.kind === 'plate' ? w.r + 4 : w.r + ((TAU * w.r) / w.n) * 0.42 + 4) * k; // the sprite's half size on screen
          if (sx + size < 0 || sx - size > W || sy + size < 0 || sy - size > H) continue;
          const a = w.kind === 'escape' ? (steps(t) * TAU) / w.n / 2 + w.phase : w.phase + w.spin * turn;
          const near = w.z - z0 < 0.55, blurPx = near ? (0.55 - (w.z - z0)) * 40 : 0;
          const smear = Math.abs(w.spin * sp) / 30 / 0.06; // turns per frame past 0.06 rad: smeared over the shutter
          const n = Math.min(5, Math.max(1, Math.ceil(smear)));
          c.save(); c.translate(sx, sy); c.rotate(rl);
          if (blurPx > 1) c.filter = `blur(${blurPx.toFixed(1)}px)`;
          // its shadow on what lies behind (soft, offset down-right from the light)
          for (let q = 0; q < n; q++) {
            c.save(); c.rotate(a - (q / n) * (w.spin * sp) / 30); c.globalAlpha = (near ? 0.85 : 1) / n * (n > 1 ? 1.6 : 1);
            c.drawImage(w.spr!, -size, -size, 2 * size, 2 * size); c.restore();
          }
          c.restore();
        }
      };
      if (behindDial) {
        drawParts(dialZ);
        // the dial, lit from behind: the shadows of the works turning across it as the light grows
        const [dx, dy, k] = proj(0, 0, dialZ), R = 360 * k, [hh, mm, ss] = ((s: number) => [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60])(dialTime(A, t, T0, T8, T1));
        if (R < 9000) {
          c.save(); c.translate(dx, dy); c.rotate(rl); c.translate(-dx, -dy);
          clockFace(c, dx, dy, R, hh, mm, t > T8 ? 0 : ss, t <= T8 || t >= T1 - 1.5 / 30); // (its seconds hand hidden while it races)
          const shadow = clamp((t - T0) / BAR) * (t > T8 ? clamp((t - T8) / (T1 - T8 - 0.3)) * -1 + 1 : 1);
          if (shadow > 0.01) {
            c.save(); c.beginPath(); c.arc(dx, dy, R, 0, TAU); c.clip(); c.globalCompositeOperation = 'multiply';
            for (const w of wheels) {
              if (w.kind === 'plate' || w.z > 3.2) continue;
              const [sx, sy, kk] = proj(w.x * 0.92, w.y * 0.92, dialZ + (w.z - dialZ) * 0.35), size = (w.r + ((TAU * w.r) / w.n) * 0.42 + 4) * kk * 1.15;
              const a = w.kind === 'escape' ? (steps(t) * TAU) / w.n / 2 + w.phase : w.phase + w.spin * turn;
              c.save(); c.translate(sx, sy); c.rotate(a + rl); c.globalAlpha = 0.3 * shadow; c.filter = 'blur(3px)'; c.drawImage(w.sh!, -size, -size, 2 * size, 2 * size); c.restore();
            }
            c.restore();
          }
          c.restore();
        }
      } else drawParts(0);
      // the anchor and the balance by the escape wheel: rocking a pallet into its teeth on every snare
      const [ex, ey, ek] = proj(esc.x, esc.y, esc.z);
      if (esc.z - z0 > 0.07 && !behindDial) {
        const st = steps(t), rock = (Math.floor(st) % 2 ? 1 : -1) * 0.13 * (1 - 0.6 * (st - Math.floor(st))), R = esc.r * ek;
        c.save(); c.translate(ex, ey); c.rotate(rl); c.translate(0, -R * 1.42); c.rotate(rock);
        c.fillStyle = '#c7963f'; c.strokeStyle = '#f6dc8c'; c.lineWidth = Math.max(1, R * 0.02);
        const p = new Path2D(); p.moveTo(-R * 0.95, R * 0.55); p.lineTo(-R * 0.12, -R * 0.08); p.lineTo(-R * 0.06, -R * 0.9); p.lineTo(R * 0.06, -R * 0.9); p.lineTo(R * 0.12, -R * 0.08); p.lineTo(R * 0.95, R * 0.55); p.lineTo(R * 0.82, R * 0.66); p.lineTo(0, R * 0.12); p.lineTo(-R * 0.82, R * 0.66); p.closePath();
        c.fill(p); c.stroke(p);
        c.fillStyle = '#b0102a'; for (const sx of [-1, 1]) { c.beginPath(); c.rect(sx * R * 0.88 - R * 0.05, R * 0.5, R * 0.1, R * 0.22); c.fill(); } // the ruby pallets
        c.beginPath(); c.arc(0, 0, R * 0.1, 0, TAU); c.fillStyle = '#e8c77a'; c.fill();
        c.restore();
        // the balance: a ring on its spokes, its hairspring, swinging twice a beat
        const [bx, by, bk] = proj(esc.x - 300, esc.y - 330, esc.z + 0.2), BR = 120 * bk, sw = 1.25 * Math.sin(A.beatAt(t) * Math.PI);
        if (bx > -BR && bx < W + BR) {
          c.save(); c.translate(bx, by); c.rotate(rl + sw); c.strokeStyle = '#e8c77a'; c.lineWidth = Math.max(1.5, BR * 0.09);
          c.beginPath(); c.arc(0, 0, BR, 0, TAU); c.stroke(); c.lineWidth = Math.max(1, BR * 0.04);
          for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * BR, Math.sin(a) * BR); c.stroke(); }
          c.strokeStyle = 'rgba(246,220,140,0.7)'; c.lineWidth = Math.max(0.7, BR * 0.012); c.beginPath();
          for (let a = 0; a < TAU * 4; a += 0.15) { const r = BR * (0.08 + 0.13 * (a / TAU)); a === 0 ? c.moveTo(r, 0) : c.lineTo(Math.cos(a - sw) * r, Math.sin(a - sw) * r); } c.stroke();
          for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; c.fillStyle = '#f2d58a'; c.beginPath(); c.arc(Math.cos(a) * BR, Math.sin(a) * BR, Math.max(1, BR * 0.05), 0, TAU); c.fill(); } // its timing screws
          c.restore();
        }
      }
      // petals and motes adrift in the warm light
      for (const m of motes) {
        const z = m.z, zz = z - z0;
        if (zz < 0.12 || (behindDial && z > 1)) continue;
        const fall = (((m.y + t * (m.petal ? 26 : 8) + 800) % 1600) + 1600) % 1600 - 800, [mx, my, k] = proj(m.x + 40 * Math.sin(t * 0.6 + m.ph), fall, z);
        if (mx < -40 || mx > W + 40 || my < -40 || my > H + 40) continue;
        if (m.petal) {
          c.save(); c.translate(mx, my); c.rotate(t * 1.4 + m.ph); c.globalAlpha = clamp(1.6 - zz * 0.22) * 0.9;
          c.fillStyle = m.ph > 3 ? PAL.sakura : PAL.sakura2; c.beginPath(); c.ellipse(0, 0, 14 * k, 8.5 * k, 0, 0, TAU); c.fill(); c.restore();
        } else {
          const tw = 0.5 + 0.5 * Math.sin(t * 6 + m.ph * 3);
          c.fillStyle = `rgba(255,226,170,${(0.25 + 0.5 * tw) * clamp(1.4 - zz * 0.15)})`; c.beginPath(); c.arc(mx, my, Math.max(0.8, 2.2 * k), 0, TAU); c.fill();
        }
      }
      // midnight: a ring of gold off the bezel as the hands land on XII
      const land = T1 - 0.2;
      if (t > land) { const u = clamp((t - land) / 0.2), R = 407 * (1 + 0.5 * u); c.save(); c.strokeStyle = `rgba(255,220,150,${0.8 * (1 - u)})`; c.lineWidth = 10 * (1 - u) + 2; c.beginPath(); c.arc(W / 2, H / 2, R, 0, TAU); c.stroke(); c.restore(); }
    }, { p: -1 });
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(0);
    b.post(() => ({ bloom: 0.6, halation: 0.24, vignette: 0.48 }));
  },
};
