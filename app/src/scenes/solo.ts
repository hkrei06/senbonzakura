// The guitar solo (docs/TREATMENT.md): the theatre street of Asakusa Rokku at night in the rain, the intro's city hours
// later with its gas light given way to electricity.
//   neon     a long truck down the street. Theatres and cafés (taisho-arch elevations, their line art sunk into the dark)
//            hung with neon (tategaki boards, Latin words, pictograms) that strike on in a wave over the riser, then one
//            by one as they come into view, breathing with the guitar's eighths and flaring on the snares; painted
//            billboards over the theatres, nobori at the kerb, passers-by under oiled-paper umbrellas, telegraph poles
//            whipping past the lens; the wet road mirrors it all in ripples and streaks; searchlights sweep the clouds
//            behind the twelve-storey tower, which lights floor by floor. The truck settles onto the street's electric
//            palace, a cinema outlined in bulbs, which switches on from the pavement up over the last bar
//   marquee  the cinema closer: its bulbs chase on the eighths, 千本桜 in bulb letters on the canopy (a glyph a beat),
//            the posters (主演 初音ミク; the fox wedding, coming soon), a queue under umbrellas, drips off the canopy,
//            the pavement mirroring the bulbs. A cut on the next-to-last bar's kick to the canopy close, a tilt up the
//            fanlight; on the last downbeat every bulb flares and the camera rises into the clock over the door, landing on
//            its face as the build's clock takes over (clockFace, soloClock: a match cut)
// Neon and bulbs are sprites drawn once (lit ones added on), the reflection one copy of the frame drawn so far; the
// cinema and its clock are drawn as paths every frame (sharp at the end's 5× push).
import type { AudioData, AudioSample } from '../engine/audio';
import { W, H, SCALE } from '../engine/gl';
import { TAU, clamp, ease, hash, lerp, mulberry32, noise1, noise2, smoothstep } from '../engine/util';
import type { Build } from './poster';
import { PAL, SERIF900, decoFrame, crest, layer, mikuStanding, moonDisc, sakuraTree } from './taisho';
import { elevation, dotScreen, type Kind as Arch, type Palette } from './taisho-arch';
import { walker } from './intro';
import { foxMask, wisp } from './cards';

type C = CanvasRenderingContext2D;

// the night street: near-black masses, the line art a cool violet sunk into the dark, the shop windows warm
const NIGHT: Palette = { ink: '#0b0912', ink2: '#110d18', line: 'rgba(160,146,222,0.42)', dim: 'rgba(160,146,222,0.2)', win: '#100d1d', lit: ['#d7a256', '#c98f4c', '#e2b067', '#cf9852'] };
const NEON = { pink: '#ff4fa8', cyan: '#3fe6ff', green: '#5dff95', gold: '#ffc44f', red: '#ff5040', violet: '#b48cff' };
const BASE = 780, PF = 0.6, KERB = 28; // the street line (the fronts stand on it), the fronts' depth, the pavement
const GH = 120, FH = 92; // a front's ground floor and upper floors (elevation's fh 92; its ground floor is round(92 × 1.3))
const topOf = (floors: number) => BASE - GH - FH * (floors - 1);
const SC = 0.44, CW = 700 * SC; // the cinema in the street: its scale, its half-width
const RIM = 'rgba(190,172,255,0.55)'; // passers-by traced in the neon's violet

const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const; };
/** hex mixed toward white by k. */
const tint = (hex: string, k: number) => { const [r, g, b] = rgb(hex); return `rgb(${Math.round(r + (255 - r) * k)},${Math.round(g + (255 - g) * k)},${Math.round(b + (255 - b) * k)})`; };

/** An offscreen canvas of w × h logical px at res × SCALE backing px each. draw(c, k): k is backing px per px, for
 *  shadowBlur (a plain context leaves it in backing px). */
function sprite(w: number, h: number, draw: (c: C, k: number) => void, res = 1) {
  const cv = document.createElement('canvas'), k = SCALE * res;
  cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
  const c = cv.getContext('2d')!; c.scale(k, k); draw(c, k);
  return cv;
}
let mctx: C | null = null;
const measure = (font: string, s: string) => { mctx ??= document.createElement('canvas').getContext('2d')!; mctx.font = font; return mctx.measureText(s).width; };

/** Light printed as halftone (the film's print language): dots on one 45° screen inside an ellipse, shrinking outward.
 *  The screen is aligned to the street ((ox, oy): where c's origin is in it), so overlapping lights share it. */
function halftone(c: C, cx: number, cy: number, rx: number, ry: number, col: string, ox = 0, oy = 0, sp = 7, dot = 2.8) {
  const a = sp * Math.SQRT1_2, X0 = ox + cx - rx, X1 = ox + cx + rx, Y0 = oy + cy - ry, Y1 = oy + cy + ry;
  c.fillStyle = col; c.beginPath();
  for (let i = Math.floor((X0 + Y0) / (2 * a)); i <= Math.ceil((X1 + Y1) / (2 * a)); i++)
    for (let j = Math.floor((Y0 - X1) / (2 * a)); j <= Math.ceil((Y1 - X0) / (2 * a)); j++) {
      const x = (i - j) * a - ox, y = (i + j) * a - oy, d = Math.hypot((x - cx) / rx, (y - cy) / ry), r = dot * Math.pow(Math.max(0, 1 - d), 1.2);
      if (r < 0.3) continue;
      c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
    }
  c.fill();
}

// ---- neon

/** A neon tube: a path (stroked), or text in a light face (filled and edged: each stroke of a glyph one tube). */
type Tube = { col: string; path?: Path2D; lw?: number; text?: string; font?: string; x?: number; y?: number; pitch?: number };
/** The tubes in one pass: 0 the unlit glass, 1 the glow, 2 the tube, 3 its white-hot core (k: backing px per px). */
function tubes(c: C, list: Tube[], pass: 0 | 1 | 2 | 3, k = SCALE) {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const tb of list) {
    const col = pass === 0 ? 'rgba(150,134,176,0.3)' : pass === 3 ? tint(tb.col, 0.6) : tb.col;
    c.strokeStyle = col; c.fillStyle = col; c.shadowColor = tb.col; c.shadowBlur = [0, 16, 4, 0][pass]! * k; c.globalAlpha = pass === 1 ? 0.9 : 1;
    if (tb.path) { c.lineWidth = (tb.lw ?? 3) * [1, 1.8, 1, 0.4][pass]!; c.stroke(tb.path); }
    if (tb.text) {
      c.font = tb.font!;
      (tb.pitch ? [...tb.text] : [tb.text]).forEach((ch, j) => {
        const y = tb.y! + j * (tb.pitch ?? 0);
        if (pass < 3) { c.lineWidth = [1, 3, 1.2][pass]!; c.strokeText(ch, tb.x!, y); }
        c.fillText(ch, tb.x!, y);
      });
    }
  }
  c.restore();
}

type Sign = { x: number; y: number; w: number; h: number; off: HTMLCanvasElement; on: HTMLCanvasElement; ign: number; buzz: boolean; seed: number };
const GM = 60; // the margin round a sign's sprites: its glow, and the light it prints round it
/** A neon sign over the box (x, y, w, h): two sprites, unlit (its board, the dark glass) and lit (the light it prints on
 *  the front, the glow, the tubes, their cores), the lit one added over the other. */
function sign(x: number, y: number, w: number, h: number, col: string, list: Tube[], board?: (c: C) => void, res = 1): Sign {
  const w2 = w + 2 * GM, h2 = h + 2 * GM;
  const off = sprite(w2, h2, (c) => { c.translate(GM, GM); board?.(c); tubes(c, list, 0); }, res);
  const on = sprite(w2, h2, (c, k) => {
    c.globalAlpha = 0.5; halftone(c, w2 / 2, h2 / 2, w2 / 2, h2 / 2, col, x - GM, y - GM); c.globalAlpha = 1;
    c.translate(GM, GM); for (const pass of [1, 2, 3] as const) tubes(c, list, pass, k);
  }, res);
  return { x, y, w, h, off, on, ign: Infinity, buzz: false, seed: Math.round(x * 7 + y * 3) };
}
const SANS = (px: number, wt = 400) => `${px}px "NotoSansSC-${wt}"`;
/** A tategaki board, centred on cx, its foot at foot: the name down a dark board, a tube round its edge. */
function vBoard(cx: number, foot: number, text: string, size: number, col: string, edge = col, res = 1): Sign {
  const n = [...text].length, w = Math.round(size * 1.42), h = Math.round(n * size * 1.08 + size * 0.72);
  const rim = new Path2D(); rim.roundRect(6, 6, w - 12, h - 12, 5);
  const font = /^[ -~]+$/.test(text) ? `${size}px "Archivo-1000-500"` : SANS(size); // (Latin from a Latin face: the Chinese ones are subset to CJK)
  return sign(cx - w / 2, foot - h, w, h, col, [{ col: edge, path: rim, lw: 2.4 }, { col, text, font, x: w / 2, y: size * 0.9, pitch: size * 1.08 }], (c) => {
    c.fillStyle = '#0d0a12'; c.beginPath(); c.roundRect(0, 0, w, h, 7); c.fill(); c.strokeStyle = NIGHT.line; c.lineWidth = 1.2; c.stroke();
  }, res);
}
/** A word in neon across a front, centred on (cx, cy), a tube under it. */
function hWord(cx: number, cy: number, text: string, size: number, col: string, font: string, under?: string, res = 1): Sign {
  const w = Math.round(measure(font, text) + size * 0.7), h = Math.round(size * 1.4), list: Tube[] = [{ col, text, font, x: w / 2, y: h * 0.44 }];
  if (under) { const p = new Path2D(); p.moveTo(size * 0.35, h - 7); p.lineTo(w - size * 0.35, h - 7); list.push({ col: under, path: p, lw: 2.4 }); }
  return sign(cx - w / 2, cy - h / 2, w, h, col, list, undefined, res);
}
/** Pictograms as tube paths, centred on (cx, cy), s across. */
const ICON = {
  cup(cx: number, cy: number, s: number) {
    const p = new Path2D(), u = s / 100, y0 = cy - 4 * u;
    p.moveTo(cx - 34 * u, y0); p.quadraticCurveTo(cx - 32 * u, y0 + 38 * u, cx, y0 + 40 * u); p.quadraticCurveTo(cx + 32 * u, y0 + 38 * u, cx + 34 * u, y0); p.closePath();
    p.moveTo(cx + 31 * u, y0 + 8 * u); p.bezierCurveTo(cx + 50 * u, y0 + 4 * u, cx + 50 * u, y0 + 26 * u, cx + 24 * u, y0 + 26 * u); // the handle
    p.moveTo(cx - 46 * u, y0 + 48 * u); p.quadraticCurveTo(cx, y0 + 60 * u, cx + 46 * u, y0 + 48 * u); // the saucer
    for (const k of [-14, 2, 18]) { p.moveTo(cx + k * u, y0 - 8 * u); p.bezierCurveTo(cx + (k - 9) * u, y0 - 20 * u, cx + (k + 9) * u, y0 - 30 * u, cx + k * u, y0 - 44 * u); } // the steam
    return p;
  },
  note(cx: number, cy: number, s: number) {
    const p = new Path2D(), u = s / 100;
    for (const [hx, hy] of [[-22, 30], [22, 22]] as const) { p.moveTo(cx + hx * u + 12 * u * Math.cos(-0.35), cy + hy * u + 12 * u * Math.sin(-0.35)); p.ellipse(cx + hx * u, cy + hy * u, 12 * u, 8.5 * u, -0.35, 0, TAU); }
    p.moveTo(cx - 11 * u, cy + 27 * u); p.lineTo(cx - 11 * u, cy - 32 * u); p.lineTo(cx + 33 * u, cy - 40 * u); p.lineTo(cx + 33 * u, cy + 19 * u); // the stems and the beam
    return p;
  },
  sakura(cx: number, cy: number, s: number) {
    const p = new Path2D(), R = 0.46 * s;
    for (let k = 0; k < 5; k++) { // five petals, each notched at its tip
      const a = (k / 5) * TAU - Math.PI / 2, P = (da: number, rr: number) => [cx + Math.cos(a + da) * rr, cy + Math.sin(a + da) * rr] as const;
      p.moveTo(...P(-0.5, R * 0.22)); p.quadraticCurveTo(...P(-0.55, R * 0.95), ...P(-0.16, R)); p.lineTo(...P(0, R * 0.8)); p.lineTo(...P(0.16, R)); p.quadraticCurveTo(...P(0.55, R * 0.95), ...P(0.5, R * 0.22));
    }
    p.moveTo(cx + R * 0.12, cy); p.arc(cx, cy, R * 0.12, 0, TAU);
    return p;
  },
  fox(cx: number, cy: number, s: number) { // the fox mask's outline (make_foxmask.py), its eyes and mouth
    const p = new Path2D(), u = s / 112, F = [[-30, -18], [-40, -62], [-14, -34], [0, -37], [14, -34], [40, -62], [30, -18], [36, 2], [26, 18], [16, 27], [8, 40], [0, 46], [-8, 40], [-16, 27], [-26, 18], [-36, 2]] as const;
    F.forEach(([x, y], i) => (i ? p.lineTo(cx + x * u, cy + (y + 8) * u) : p.moveTo(cx + x * u, cy + (y + 8) * u))); p.closePath();
    for (const sx of [-1, 1]) { p.moveTo(cx + sx * 9 * u, cy - 1 * u); p.lineTo(cx + sx * 25 * u, cy - 6 * u); }
    p.moveTo(cx - 8 * u, cy + 42 * u); p.lineTo(cx, cy + 46 * u); p.lineTo(cx + 8 * u, cy + 42 * u);
    return p;
  },
  horn(cx: number, cy: number, s: number) { // a gramophone: the box, the disc, the arm, the horn opening up and out
    const p = new Path2D(), u = s / 100;
    p.rect(cx - 40 * u, cy + 22 * u, 52 * u, 24 * u);
    p.moveTo(cx - 46 * u, cy + 20 * u); p.lineTo(cx + 18 * u, cy + 20 * u);
    p.moveTo(cx - 6 * u, cy + 18 * u); p.quadraticCurveTo(cx - 4 * u, cy - 6 * u, cx + 10 * u, cy - 12 * u);
    p.moveTo(cx + 8 * u, cy - 8 * u); p.quadraticCurveTo(cx + 30 * u, cy - 22 * u, cx + 44 * u, cy - 50 * u); p.lineTo(cx + 54 * u, cy + 2 * u); p.quadraticCurveTo(cx + 26 * u, cy - 6 * u, cx + 12 * u, cy - 4 * u);
    return p;
  },
  mug(cx: number, cy: number, s: number) { // a beer mug, its foam
    const p = new Path2D(), u = s / 100;
    p.moveTo(cx - 26 * u, cy - 30 * u); p.lineTo(cx - 22 * u, cy + 40 * u); p.lineTo(cx + 22 * u, cy + 40 * u); p.lineTo(cx + 26 * u, cy - 30 * u);
    p.moveTo(cx + 24 * u, cy - 16 * u); p.bezierCurveTo(cx + 48 * u, cy - 16 * u, cx + 48 * u, cy + 22 * u, cx + 23 * u, cy + 22 * u);
    p.moveTo(cx - 30 * u, cy - 30 * u); p.bezierCurveTo(cx - 34 * u, cy - 50 * u, cx - 10 * u, cy - 52 * u, cx - 4 * u, cy - 42 * u); p.bezierCurveTo(cx + 4 * u, cy - 56 * u, cx + 32 * u, cy - 50 * u, cx + 30 * u, cy - 30 * u);
    return p;
  },
};
/** A pictogram in tubes over a word, centred on cx, its foot at foot. */
function picto(cx: number, foot: number, icon: keyof typeof ICON, s: number, col: string, word?: string, wcol = col, res = 1): Sign {
  const wf = SANS(Math.round(s * 0.34), 500), w = Math.round(Math.max(s * 1.2, word ? measure(wf, word) + s * 0.3 : 0)), h = Math.round(s * 1.12 + (word ? s * 0.46 : 0));
  const list: Tube[] = [{ col, path: ICON[icon](w / 2, s * 0.56, s), lw: 2.8 }];
  if (word) list.push({ col: wcol, text: word, font: wf, x: w / 2, y: s * 1.24 });
  return sign(cx - w / 2, foot - h, w, h, col, list, undefined, res);
}

const STRIKE = [1, 0.15, 0, 0.75, 0.3, 1, 0.85]; // a tube striking, frame by frame (30 fps)
/** A sign's light at t: struck at s.ign, breathing with the guitar's eighths, flaring on the snare; a bad tube buzzes. */
function neonLevel(s: Sign, t: number, a: AudioSample) {
  if (t < s.ign) return 0;
  const f = Math.floor((t - s.ign) * 30), strike = f < STRIKE.length ? STRIKE[f]! : 1;
  const buzz = s.buzz && hash(Math.floor(t * 30), s.seed) < 0.09 ? 0.3 : 1;
  return strike * buzz * (0.84 + 0.16 * clamp((a.other - 0.66) / 0.34)) * (1 + 0.22 * a.snare);
}
/** The signs with any part in [u0, u1]: the unlit sprites, then the lit ones added on. */
function drawSigns(c: C, list: Sign[], t: number, a: AudioSample, u0 = -1e9, u1 = 1e9) {
  const vis = list.filter((s) => s.x + s.w + GM > u0 && s.x - GM < u1);
  for (const s of vis) c.drawImage(s.off, s.x - GM, s.y - GM, s.w + 2 * GM, s.h + 2 * GM);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const s of vis) {
    const L = neonLevel(s, t, a);
    if (L <= 0.01) continue;
    c.globalAlpha = Math.min(1, L); c.drawImage(s.on, s.x - GM, s.y - GM, s.w + 2 * GM, s.h + 2 * GM);
    if (L > 1) { c.globalAlpha = L - 1; c.drawImage(s.on, s.x - GM, s.y - GM, s.w + 2 * GM, s.h + 2 * GM); }
  }
  c.restore();
}

// ---- bulbs

type Bulb = { x: number; y: number; r: number; g: number; i: number };
let BULB: HTMLCanvasElement | null = null;
/** A lit bulb, drawn additively 10 × its radius across: the white-hot filament, the warm glass, a halo. (Made large:
 *  the clock's bulbs are seen five times closer at the end.) */
const bulbSprite = () => BULB ??= sprite(64, 64, (c) => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,250,232,1)'); g.addColorStop(0.1, 'rgba(255,232,176,0.95)'); g.addColorStop(0.2, 'rgba(255,196,110,0.42)'); g.addColorStop(0.5, 'rgba(255,170,80,0.1)'); g.addColorStop(1, 'rgba(255,160,70,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
}, 2);
/** Bulbs: dark glass when off, the lit ones added on as halos (lit(b): 0..1.8). */
function drawBulbs(c: C, list: Bulb[], lit: (b: Bulb) => number) {
  c.save(); c.fillStyle = '#2a2026'; c.beginPath();
  for (const b of list) { c.moveTo(b.x + b.r, b.y); c.arc(b.x, b.y, b.r, 0, TAU); }
  c.fill();
  c.globalCompositeOperation = 'lighter';
  const sp = bulbSprite();
  for (const b of list) {
    const L = lit(b);
    if (L <= 0.02) continue;
    c.globalAlpha = Math.min(1, L); c.drawImage(sp, b.x - 5 * b.r, b.y - 5 * b.r, 10 * b.r, 10 * b.r);
    if (L > 1) { c.globalAlpha = L - 1; c.drawImage(sp, b.x - 5 * b.r, b.y - 5 * b.r, 10 * b.r, 10 * b.r); }
  }
  c.restore();
}

// ---- the cinema (in its own units: 1400 wide, its foot at y = 0, up negative)

const CLOCK = { y: -1125, R: 104 };
let CB: Bulb[] | null = null;
/** The cinema's bulbs. Groups: 0 the pylons' edges (counted bottom up), 1 the parapet, 2 the arch, 3 the clock's
 *  aedicule, 4 the canopy's edges, 5 千本桜 on the canopy (i: the glyph), 6 the posters' frames. */
function cinemaBulbs(): Bulb[] {
  if (CB) return CB;
  const out: Bulb[] = [];
  const run = (g: number, pts: [number, number][], step: number, r = 5) => { // a bulb every step along a polyline
    let i = 0, next = 0, acc = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [x0, y0] = pts[k]!, [x1, y1] = pts[k + 1]!, L = Math.hypot(x1 - x0, y1 - y0);
      for (; next <= acc + L; next += step) { const u = (next - acc) / L; out.push({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, r, g, i: i++ }); }
      acc += L;
    }
  };
  for (const x of [-692, -548, 548, 692]) run(0, [[x, -14], [x, -1142]], 22);
  run(1, [[-540, -1012], [-190, -1012]], 22); run(1, [[190, -1012], [540, -1012]], 22);
  const arc: [number, number][] = [[-322, -478], [-322, -610]];
  for (let k = 1; k < 40; k++) { const a = Math.PI + (k / 40) * Math.PI; arc.push([Math.cos(a) * 322, -610 + Math.sin(a) * 322]); }
  arc.push([322, -610], [322, -478]); run(2, arc, 22);
  run(3, [[-188, -1000], [-188, -1188], [-148, -1188], [-148, -1240], [-98, -1240], [-98, -1280], [98, -1280], [98, -1240], [148, -1240], [148, -1188], [188, -1188], [188, -1000]], 20);
  run(4, [[-462, -462], [462, -462]], 20); run(4, [[462, -338], [-462, -338]], 20);
  for (const px of [-456, 244]) run(6, [[px, -316], [px + 212, -316], [px + 212, -24], [px, -24], [px, -316]], 24, 4);
  // 千本桜 in bulb letters: each glyph drawn, its pixels sampled on a grid
  const S = 104, step = 8.5, g = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  g.canvas.width = g.canvas.height = 150;
  [...'千本桜'].forEach((ch, j) => {
    g.clearRect(0, 0, 150, 150); g.fillStyle = '#fff'; g.font = SANS(S, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 75, 77);
    const d = g.getImageData(0, 0, 150, 150).data;
    for (let y = step / 2; y < 150; y += step) for (let x = step / 2; x < 150; x += step)
      if (d[(Math.floor(y) * 150 + Math.floor(x)) * 4 + 3]! > 150) out.push({ x: (j - 1) * 150 + x - 75, y: -400 + y - 75, r: 3.6, g: 5, i: j });
  });
  return (CB = out);
}

let POSTERS: [HTMLCanvasElement, HTMLCanvasElement] | null = null;
/** The film's poster (Miku under the moon, 主演 初音ミク) and the next one's (the fox wedding, coming soon). */
const posters = () => POSTERS ??= [
  sprite(200, 280, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 280); g.addColorStop(0, '#1b0f2e'); g.addColorStop(0.6, '#5a1d3a'); g.addColorStop(1, '#c8321e');
    c.fillStyle = g; c.fillRect(0, 0, 200, 280);
    c.fillStyle = '#f2d58a'; c.beginPath(); c.arc(124, 112, 56, 0, TAU); c.fill();
    const r = mulberry32(1481);
    for (let i = 0; i < 26; i++) { c.fillStyle = i % 2 ? PAL.sakura : PAL.sakura2; c.beginPath(); c.ellipse(r() * 200, 40 + r() * 200, 4, 2.6, r() * 3, 0, TAU); c.fill(); }
    mikuStanding(c, 96, 252, 186, 0.8, 2.1, 'rgba(255,214,150,0.9)');
    c.fillStyle = PAL.cream; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `38px ${SERIF900}`; c.fillText('千本桜', 100, 32);
    c.font = `13px ${SERIF900}`; c.fillText('主演　初音ミク', 100, 266);
    c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(5, 5, 190, 270);
  }, 2),
  sprite(200, 280, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 280); g.addColorStop(0, '#0d1430'); g.addColorStop(1, '#22406a');
    c.fillStyle = g; c.fillRect(0, 0, 200, 280);
    c.fillStyle = PAL.ver; c.fillRect(22, 206, 7, 52); c.fillRect(64, 206, 7, 52); c.fillRect(14, 200, 66, 7); c.fillStyle = PAL.ink; c.fillRect(8, 191, 78, 9); // a torii
    for (let i = 0; i < 6; i++) wisp(c, 104 + i * 15, 236 - 14 * Math.sin(i * 1.1), 3.2, i * 0.7, i);
    foxMask(c, 92, 112, 120, 0.6);
    c.fillStyle = PAL.cream; c.font = `24px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    [...'狐の嫁入り'].forEach((ch, j) => c.fillText(ch, 172, 36 + j * 28));
    c.font = `13px ${SERIF900}`; c.fillText('近日上映', 100, 266);
    c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(5, 5, 190, 270);
  }, 2),
];

/** The cinema front in the street's line art: the pylons, the block with its name, the clock's aedicule (the clock
 *  itself: clockFace), the great fanlight, the canopy, the doors lit from the lobby, the posters. */
function cinemaFront(c: C) {
  const L = NIGHT.line, D = NIGHT.dim;
  const box = (x: number, y: number, w: number, h: number, fill: string, lw = 1.8) => { c.fillStyle = fill; c.fillRect(x, y, w, h); c.strokeStyle = L; c.lineWidth = lw; c.strokeRect(x, y, w, h); };
  const ln = (x0: number, y0: number, x1: number, y1: number, lw = 1.3, col = L) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  c.save(); c.lineJoin = 'miter'; c.textAlign = 'center'; c.textBaseline = 'middle';
  // the aedicule over the parapet, stepped, rays round the clock
  const aed = new Path2D(); aed.moveTo(-180, -990);
  for (const [x, y] of [[-180, -1180], [-140, -1180], [-140, -1232], [-90, -1232], [-90, -1272], [90, -1272], [90, -1232], [140, -1232], [140, -1180], [180, -1180], [180, -990]] as const) aed.lineTo(x, y);
  aed.closePath(); c.fillStyle = '#0e0a14'; c.fill(aed); c.strokeStyle = L; c.lineWidth = 2; c.stroke(aed);
  for (let k = 0; k < 32; k++) { const a = (k / 32) * TAU, r1 = k % 2 ? 138 : 152; ln(Math.cos(a) * 124, CLOCK.y + Math.sin(a) * 124, Math.cos(a) * r1, CLOCK.y + Math.sin(a) * r1, 1.4, D); }
  // the pylons: stepped caps, ball finials, fluting
  for (const x0 of [-700, 540]) {
    box(x0 + 14, -1192, 132, 42, '#0e0a14'); box(x0 + 34, -1226, 92, 34, '#0e0a14');
    c.fillStyle = '#0e0a14'; c.beginPath(); c.arc(x0 + 80, -1246, 20, 0, TAU); c.fill(); c.strokeStyle = L; c.lineWidth = 1.6; c.stroke();
    ln(x0 + 80, -1266, x0 + 80, -1300, 2.2);
    box(x0, -1150, 160, 1150, '#0d0a13');
    for (const dx of [16, 144]) ln(x0 + dx, -1136, x0 + dx, -12, 1, D);
  }
  // the block: its cornice, the name in gold (right to left, as the period's signs read), the tall windows
  box(-540, -1000, 1080, 1000, '#100c17');
  box(-556, -1006, 1112, 16, '#0d0a13');
  c.fillStyle = '#d8bf88'; c.font = `34px ${SERIF900}`; c.fillText('館　畫　映　都　櫻', 0, -966);
  ln(-540, -942, 540, -942, 1.4); ln(-540, -936, 540, -936, 0.9, D);
  for (const sx of [-1, 1]) for (const dx of [392, 474]) {
    const x = sx * dx - 20, p = new Path2D(); p.moveTo(x, -560); p.lineTo(x, -856); p.arc(x + 20, -856, 20, Math.PI, TAU); p.lineTo(x + 40, -560); p.closePath();
    c.fillStyle = '#3a2430'; c.fill(p); c.strokeStyle = L; c.lineWidth = 1.4; c.stroke(p); ln(x + 20, -876, x + 20, -560, 1.2, 'rgba(20,12,14,0.8)');
  }
  // the great arch: a fanlight of radiating glazing bars over a row of tall lights, lit amber from the lobby
  const AY = -610, AR = 300, arch = new Path2D();
  arch.moveTo(-AR, -470); arch.lineTo(-AR, AY); arch.arc(0, AY, AR, Math.PI, TAU); arch.lineTo(AR, -470); arch.closePath();
  const g = c.createRadialGradient(0, -540, 20, 0, -580, 420); g.addColorStop(0, '#f6cf86'); g.addColorStop(0.45, '#c7843f'); g.addColorStop(1, '#4a2418');
  c.fillStyle = g; c.fill(arch);
  c.save(); c.clip(arch); c.strokeStyle = 'rgba(30,17,14,0.9)'; c.lineWidth = 7;
  for (let k = 1; k < 12; k++) { const a = Math.PI + (k / 12) * Math.PI; c.beginPath(); c.moveTo(0, AY); c.lineTo(Math.cos(a) * AR * 1.1, AY + Math.sin(a) * AR * 1.1); c.stroke(); }
  for (const r of [92, 196]) { c.beginPath(); c.arc(0, AY, r, Math.PI, TAU); c.stroke(); }
  c.beginPath(); c.moveTo(-AR, AY); c.lineTo(AR, AY); c.stroke();
  for (let x = -AR + 60; x < AR; x += 60) { c.beginPath(); c.moveTo(x, AY); c.lineTo(x, -470); c.stroke(); }
  c.restore();
  c.strokeStyle = L; c.lineWidth = 3; c.stroke(arch);
  c.lineWidth = 1.6; c.beginPath(); c.arc(0, AY, AR + 16, Math.PI, TAU); c.stroke();
  box(-15, AY - AR - 24, 30, 34, '#0e0a14'); // the keystone
  // the canopy over the doors: a deep fascia (its bulb letters: cinemaBulbs), its underside lit
  box(-470, -470, 940, 140, '#0c0910', 2); ln(-478, -473, 478, -473, 3);
  const ug = c.createLinearGradient(0, -330, 0, -290); ug.addColorStop(0, 'rgba(255,214,150,0.7)'); ug.addColorStop(1, 'rgba(255,214,150,0)');
  c.fillStyle = ug; c.fillRect(-470, -330, 940, 40);
  // the doors: three, glazed, lit from the lobby, people inside; the transom over them
  box(-190, -322, 380, 22, '#0d0a12', 1.4);
  c.fillStyle = '#d8bf88'; c.font = `15px ${SERIF900}`; c.fillText('口　入', 0, -311);
  const r = mulberry32(1490);
  for (let k = -1; k <= 1; k++) {
    const x = k * 122 - 56, w = 112, dg = c.createLinearGradient(0, -300, 0, 0); dg.addColorStop(0, '#f2c47c'); dg.addColorStop(1, '#a3602c');
    c.fillStyle = dg; c.fillRect(x, -300, w, 300);
    for (let q = 0; q < 2; q++) if (r() < 0.75) { const hx = x + 22 + r() * (w - 44), hy = -150 + r() * 30; c.fillStyle = 'rgba(46,26,18,0.85)'; c.beginPath(); c.arc(hx, hy, 13, 0, TAU); c.fill(); c.beginPath(); c.roundRect(hx - 24, hy + 15, 48, 150, [16, 16, 0, 0]); c.fill(); }
    c.strokeStyle = '#d8bf88'; c.lineWidth = 2.6; c.strokeRect(x, -300, w, 300);
    ln(x + w / 2, -300, x + w / 2, 0, 2, '#d8bf88'); ln(x, -206, x + w, -206, 1.8, 'rgba(40,24,16,0.85)');
  }
  const [film, fox] = posters();
  for (const [px, sp] of [[-450, film], [250, fox]] as const) { c.drawImage(sp, px, -310, 200, 280); c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(px - 6, -316, 212, 292); }
  for (let k = 0; k < 2; k++) box(-226 + k * 14, -16 + k * 8, 452 - k * 28, 8, '#0e0a12', 1.1); // the steps
  c.restore();
}
/** The cinema's own neon (its units): its name down the left pylon, KINEMA down the right. */
const cinemaSigns = (res = 1) => [vBoard(-620, -470, '櫻都キネマ', 90, NEON.pink, NEON.gold, res), vBoard(620, -470, 'KINEMA', 80, NEON.cyan, NEON.pink, res)];

/** The clock over the cinema's door, and the build's at the match cut (clockworks.ts): a gold bezel, a lit cream face,
 *  Roman numerals, the city's crest, ink hands and a vermilion seconds hand (unless secs is false), at h:m:s. */
export function clockFace(c: C, x: number, y: number, R: number, h: number, m: number, s: number, secs = true) {
  c.save(); c.translate(x, y);
  c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(0, 0, R * 1.13, 0, TAU); c.fill();
  c.fillStyle = '#8a6a26'; c.beginPath(); c.arc(0, 0, R * 1.04, 0, TAU); c.fill();
  c.strokeStyle = '#e8c77a'; c.lineWidth = R * 0.012; c.beginPath(); c.arc(0, 0, R * 1.1, 0, TAU); c.stroke();
  const g = c.createRadialGradient(0, 0, R * 0.05, 0, 0, R); g.addColorStop(0, '#fff7dc'); g.addColorStop(0.75, '#f0e3c0'); g.addColorStop(1, '#ddc99c');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  c.fillStyle = PAL.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `${(R * 0.19).toFixed(2)}px "Cormorant-600"`; // (Latin: the Chinese faces are subset to CJK)
  ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => {
    const a = (i / 12) * TAU - Math.PI / 2; c.save(); c.translate(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78); c.rotate(a + Math.PI / 2); c.fillText(n, 0, 0); c.restore();
  });
  for (let k = 0; k < 60; k++) { const w = R * (k % 5 ? 0.01 : 0.018); c.save(); c.rotate((k / 60) * TAU); c.fillRect(-w / 2, -R * 0.95, w, R * (k % 5 ? 0.03 : 0.065)); c.restore(); }
  crest(c, 0, R * 0.36, R * 0.1, PAL.ver);
  const hand = (a: number, L: number, w: number, col: string, tail = 0.16) => { c.save(); c.rotate(a); c.fillStyle = col; c.beginPath(); c.moveTo(-w, R * tail); c.lineTo(0, -L); c.lineTo(w, R * tail); c.closePath(); c.fill(); c.restore(); };
  hand((((h % 12) + m / 60) / 12) * TAU, R * 0.55, R * 0.04, PAL.ink); hand(((m + s / 60) / 60) * TAU, R * 0.84, R * 0.026, PAL.ink);
  if (secs) hand((s / 60) * TAU, R * 0.9, R * 0.009, PAL.ver, 0.22);
  c.fillStyle = PAL.ink; c.beginPath(); c.arc(0, 0, R * 0.045, 0, TAU); c.fill(); c.fillStyle = PAL.ver; c.beginPath(); c.arc(0, 0, R * 0.02, 0, TAU); c.fill();
  c.restore();
}
/** The clock's time through the solo: three minutes to midnight, its seconds hand ticking a second a beat. */
export function soloClock(A: AudioData, t: number): [number, number, number] {
  const t0 = A.sections.find((x) => x.name === 'solo')?.start ?? 0, s = Math.max(0, Math.floor(A.beatAt(t) - A.beatAt(t0) + 1e-6));
  return [23, 57 + Math.floor(s / 60), s % 60];
}

// ---- the street's furniture and people

/** An oiled-paper umbrella seen from the side (its canopy's centre at x, y, radius R), tilted; ring: the janome's band. */
function umbrella(c: C, x: number, y: number, R: number, col: string, tilt: number, ring?: string) {
  c.save(); c.translate(x, y); c.rotate(tilt);
  const n = 8, top = -R * 0.5, p = new Path2D();
  p.moveTo(-R, 0); p.quadraticCurveTo(-R * 0.62, top * 1.02, 0, top); p.quadraticCurveTo(R * 0.62, top * 1.02, R, 0);
  for (let k = n - 1; k >= 0; k--) { const xa = -R + (2 * R * k) / n; p.quadraticCurveTo(xa + R / n, R * 0.06, xa, 0); } // the rim, scalloped between the ribs
  p.closePath();
  c.fillStyle = col; c.fill(p);
  if (ring) { c.save(); c.clip(p); c.strokeStyle = ring; c.lineWidth = R * 0.11; c.beginPath(); c.ellipse(0, 0, R * 0.7, -top * 0.72, 0, Math.PI, TAU); c.stroke(); c.restore(); }
  c.strokeStyle = 'rgba(8,6,12,0.55)'; c.lineWidth = Math.max(0.8, R * 0.018);
  for (let k = 1; k < n; k++) { const xr = -R + (2 * R * k) / n; c.beginPath(); c.moveTo(0, top); c.quadraticCurveTo(xr * 0.55, top * (1 - (xr / R) ** 2) * 0.9, xr, 0); c.stroke(); } // the ribs
  c.fillStyle = '#0a0810'; c.fillRect(-R * 0.035, top - R * 0.12, R * 0.07, R * 0.13);
  c.strokeStyle = '#0a0810'; c.lineWidth = Math.max(1.2, R * 0.035); c.beginPath(); c.moveTo(0, top * 0.2); c.lineTo(0, R * 0.95); c.stroke(); // the shaft
  c.restore();
}
/** A passer-by (walker(), traced in violet), under an umbrella unless furled (under the canopy) or a rickshaw. */
function passerby(c: C, kind: string, x: number, foot: number, h: number, ph: number, dir: number, um?: string, ring?: string, furled = false, px = 1.2) {
  const u = h / 100;
  walker(c, kind, x, foot, h, ph, dir, { line: RIM, px });
  if (!um || kind === 'rickshaw') return;
  if (furled) { c.fillStyle = um; c.beginPath(); c.moveTo(x + dir * 12 * u, foot - 50 * u); c.lineTo(x + dir * 16 * u, foot - 4 * u); c.lineTo(x + dir * 8 * u, foot - 50 * u); c.closePath(); c.fill(); return; } // furled, hanging from the hand
  umbrella(c, x + dir * 6 * u, foot - 112 * u + Math.abs(Math.sin(ph)) * 1.4 * u, 46 * u, um, -dir * 0.12, ring);
}
type Nobori = { x: number; text: string; col: string; ink: string };
/** A nobori: a tall banner on a bamboo pole at the kerb, laced to it, hung from a crossbar; heavy with the rain, its
 *  free edge swings a little. s: its scale. */
function nobori(c: C, n: Nobori, foot: number, t: number, s = 1) {
  const top = foot - 248 * s, x = n.x, w = 34 * s, y0 = top + 8 * s, y1 = foot - 52 * s;
  c.strokeStyle = '#1a1410'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(x, foot); c.lineTo(x, top); c.lineTo(x + w + 4 * s, top); c.stroke();
  const sw = (y: number) => 2.5 * s * Math.sin(t * 2.2 + y * 0.02 / s + n.x * 0.01) * ((y - y0) / (y1 - y0));
  c.fillStyle = n.col; c.beginPath(); c.moveTo(x + 2 * s, y0); c.lineTo(x + w, y0);
  for (let y = y0; y <= y1; y += 10 * s) c.lineTo(x + w + sw(y), y);
  c.lineTo(x + 2 * s, y1); c.closePath(); c.fill();
  const sh = c.createLinearGradient(x, 0, x + w, 0); sh.addColorStop(0, 'rgba(8,6,12,0.45)'); sh.addColorStop(1, 'rgba(8,6,12,0.1)'); c.fillStyle = sh; c.fill(); // the street's dark on the wet cloth
  c.fillStyle = n.ink; c.font = `${(22 * s).toFixed(1)}px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  [...n.text].forEach((ch, j) => { const y = y0 + 22 * s + j * 26 * s; c.fillText(ch, x + w / 2 + s + sw(y) / 2, y); });
}
/** A theatre's painted signboard (e-kanban) over its upper floors: flat poster colours, the title brushed in, lit from
 *  below by gooseneck lamps. */
function billboard(c: C, x: number, y: number, w: number, h: number, kind: 'fox' | 'yozakura', r: () => number) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (kind === 'fox') {
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#101a3a'); g.addColorStop(1, '#27466c'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = PAL.ver; c.fillRect(x + w * 0.74, y + h * 0.42, 6, h); c.fillRect(x + w * 0.9, y + h * 0.42, 6, h); c.fillRect(x + w * 0.7, y + h * 0.4, w * 0.26, 6); // a torii
    for (let i = 0; i < 7; i++) wisp(c, x + 16 + (i * (w - 32)) / 6, y + h * 0.8 - 10 * Math.sin(i * 1.3), 4, i * 0.6, i);
    foxMask(c, x + w * 0.4, y + h * 0.46, h * 0.74, 0.8);
    c.fillStyle = PAL.cream; c.font = `${Math.round(h * 0.13)}px ${SERIF900}`; [...'狐の嫁入り'].forEach((ch, j) => c.fillText(ch, x + w - h * 0.1, y + h * 0.13 + j * h * 0.15));
  } else {
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#0b1230'); g.addColorStop(1, '#2a2458'); c.fillStyle = g; c.fillRect(x, y, w, h);
    moonDisc(c, x + w * 0.66, y + h * 0.36, h * 0.24, r, false);
    sakuraTree(c, x + w * 0.42, y + h + 8, h * 0.44, -Math.PI / 2 + 0.22, r, { ink: '#1a0e18', bloom: 1.3, depth: 5 });
    c.fillStyle = PAL.cream; c.font = `${Math.round(h * 0.17)}px ${SERIF900}`; [...'夜桜'].forEach((ch, j) => c.fillText(ch, x + h * 0.14, y + h * 0.2 + j * h * 0.2));
  }
  const lg = c.createLinearGradient(0, y + h, 0, y); lg.addColorStop(0, 'rgba(255,220,160,0.3)'); lg.addColorStop(0.55, 'rgba(255,220,160,0)'); c.fillStyle = lg; c.fillRect(x, y, w, h);
  c.restore();
  c.strokeStyle = '#d8bf88'; c.lineWidth = 2.4; c.strokeRect(x, y, w, h);
  for (let k = 0; k < 4; k++) { // the gooseneck lamps along its foot
    const lx = x + w * (0.125 + k * 0.25);
    c.strokeStyle = '#0a0810'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(lx, y + h + 14); c.quadraticCurveTo(lx, y + h + 2, lx + 10, y + h - 2); c.stroke();
    c.fillStyle = '#fff0c8'; c.beginPath(); c.arc(lx + 11, y + h - 3, 2.6, 0, TAU); c.fill();
  }
}
/** The cinema's neighbours as in the street (ox, oy: the cinema's foot), drawn in the truck and again closer in the
 *  marquee: a bookshop with 活動写真 down its front, a dance hall, a restaurant (and, for the marquee's edge, a shop
 *  beyond the bookshop). Pushes their signs. */
function neighbours(c: C, ox: number, oy: number, signs: Sign[], res: number, edge = false) {
  const foot = oy - GH - 8, xl = ox - CW - 10 - 250, xr = ox + CW + 10, xr2 = xr + 282;
  if (edge) elevation(c, xl - 252, oy, { kind: 'shop', w: 240, floors: 3, fh: FH, sign: '甘味', awning: true, lit: 0.22, pal: NIGHT }, mulberry32(1470));
  elevation(c, xl, oy, { kind: 'shop', w: 250, floors: 4, fh: FH, sign: '書林', awning: true, lit: 0.22, pal: NIGHT }, mulberry32(1471));
  elevation(c, xr, oy, { kind: 'gable', w: 270, floors: 3, fh: FH, lit: 0.22, pal: NIGHT }, mulberry32(1472));
  elevation(c, xr2, oy, { kind: 'mansard', w: 320, floors: 3, fh: FH, sign: '洋食', lit: 0.22, pal: NIGHT }, mulberry32(1473));
  signs.push(vBoard(xl + 250 - 46, foot, '活動写真', 54, NEON.cyan, NEON.pink, res), vBoard(xr + 46, foot, '舞踏場', 56, NEON.violet, NEON.green, res),
    hWord(xr + 166, oy - GH - FH * 2 + 34, 'DANCE', 36, NEON.green, '36px "Archivo-1000-300"', undefined, res), vBoard(xr2 + 244, foot, 'キネマ', 56, NEON.gold, NEON.gold, res));
}
/** The twelve-storey tower (Ryōunkaku) far off: an octagonal brick shaft (three faces seen), the wooden top with its
 *  gallery, the spire. Returns its bulbs: the corners and string courses, i = the storey they light with. */
function tower(c: C, cx: number, base: number): Bulb[] {
  const fh = 40, n = 10, y10 = base - n * fh, out: Bulb[] = [], L = 'rgba(160,146,222,0.3)', r = mulberry32(1500);
  for (const [x0, x1, col] of [[-50, -21, '#160b10'], [-21, 21, '#1c0f14'], [21, 50, '#130a0e']] as const) { c.fillStyle = col; c.fillRect(cx + x0, y10, x1 - x0, n * fh + 60); }
  c.strokeStyle = L; c.lineWidth = 1; c.strokeRect(cx - 50, y10, 100, n * fh + 60);
  for (const x of [-21, 21]) { c.beginPath(); c.moveTo(cx + x, y10); c.lineTo(cx + x, base + 60); c.stroke(); }
  for (let f = 0; f < n; f++) {
    const y = base - (f + 1) * fh;
    c.beginPath(); c.moveTo(cx - 52, y); c.lineTo(cx + 52, y); c.stroke();
    for (const [wx, ww] of [[-40, 12], [-12, 9], [3, 9], [28, 12]] as const) {
      c.fillStyle = r() < 0.25 ? '#c98f4c' : '#0e0910'; c.beginPath(); c.moveTo(cx + wx, y + fh - 8); c.lineTo(cx + wx, y + 14); c.arc(cx + wx + ww / 2, y + 14, ww / 2, Math.PI, TAU); c.lineTo(cx + wx + ww, y + fh - 8); c.closePath(); c.fill();
    }
    for (const x of [-48, -21, 21, 48]) for (let k = 0; k < 3; k++) out.push({ x: cx + x, y: y + fh - (k + 0.5) * (fh / 3), r: 2.1, g: 0, i: f });
    for (let x = -42; x <= 42; x += 12) out.push({ x: cx + x, y, r: 1.8, g: 0, i: f });
  }
  c.fillStyle = '#120c12'; c.fillRect(cx - 60, y10 - 34, 120, 34); c.fillRect(cx - 50, y10 - 68, 100, 34);
  c.strokeStyle = L; c.strokeRect(cx - 60, y10 - 34, 120, 34); c.strokeRect(cx - 50, y10 - 68, 100, 34);
  for (let x = -56; x <= 56; x += 8) { c.beginPath(); c.moveTo(cx + x, y10 - 34); c.lineTo(cx + x, y10 - 22); c.stroke(); } // the gallery's rail
  c.fillStyle = '#0e0910'; c.beginPath(); c.moveTo(cx - 62, y10 - 68); c.lineTo(cx, y10 - 150); c.lineTo(cx + 62, y10 - 68); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(cx, y10 - 150); c.lineTo(cx, y10 - 178); c.stroke();
  for (let x = -56; x <= 56; x += 10) out.push({ x: cx + x, y: y10 - 34, r: 1.9, g: 0, i: 10 });
  for (let k = 0; k <= 6; k++) { const u = k / 6; out.push({ x: cx - 62 + 62 * u, y: y10 - 68 - 82 * u, r: 1.9, g: 0, i: 11 }, { x: cx + 62 - 62 * u, y: y10 - 68 - 82 * u, r: 1.9, g: 0, i: 11 }); }
  return out;
}
/** The rain-cloud sky, lit from below by the city, printed (a fine dot screen). */
function rainSky(c: C) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05040b'); g.addColorStop(0.45, '#110b20'); g.addColorStop(0.72, '#26132f'); g.addColorStop(1, '#3a1a3e');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const cw = 240, ch = 100, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const x2 = cv.getContext('2d')!, im = x2.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { // the cloud deck's billows, brighter toward the city
    const n = 0.55 * noise2(x * 0.045, y * 0.09, 3) + 0.3 * noise2(x * 0.11, y * 0.2, 4) + 0.15 * noise2(x * 0.25, y * 0.45, 5), i = (y * cw + x) * 4;
    im.data[i] = 120; im.data[i + 1] = 70; im.data[i + 2] = 140; im.data[i + 3] = Math.round(clamp((n + 0.15) * 1.4) * (0.25 + 0.75 * (y / ch)) * 70);
  }
  x2.putImageData(im, 0, 0);
  c.imageSmoothingQuality = 'high'; c.drawImage(cv, 0, 0, W, H * 0.62);
  dotScreen(c, 0, 0, W, H, 0.05, 6);
}
/** Searchlights sweeping the clouds from behind the roofs (bases at y0): each beam three nested wedges, so its edges
 *  fall off softly. */
function searchlights(c: C, t: number, xs: number[], y0: number) {
  c.save(); c.globalCompositeOperation = 'lighter';
  xs.forEach((x, k) => {
    const a = -Math.PI / 2 + 0.62 * Math.sin(t * (0.27 + 0.07 * k) + k * 2.3), Lb = 1500;
    for (const [w, al] of [[0.022, 0.1], [0.045, 0.065], [0.08, 0.035]] as const) {
      const g = c.createLinearGradient(x, y0, x + Math.cos(a) * Lb, y0 + Math.sin(a) * Lb);
      g.addColorStop(0, `rgba(205,215,255,${al})`); g.addColorStop(0.5, `rgba(205,215,255,${al * 0.35})`); g.addColorStop(1, 'rgba(205,215,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 4, y0); c.lineTo(x + Math.cos(a - w) * Lb, y0 + Math.sin(a - w) * Lb); c.lineTo(x + Math.cos(a + w) * Lb, y0 + Math.sin(a + w) * Lb); c.lineTo(x + 4, y0); c.closePath(); c.fill();
    }
  });
  c.restore();
}

// ---- the rain and the wet road (screen space)

let RB: HTMLCanvasElement | null = null, SB: HTMLCanvasElement | null = null, PUD: HTMLCanvasElement | null = null;
const PTW = 1024, PTH = 48; // the puddle mask's tile (px; its rows spread over the road's depth)
/** The dry patches between the puddles: a tile (seamless across) of dark blobs, flattened by the road's perspective. */
function puddles() {
  if (PUD) return PUD;
  const cv = document.createElement('canvas'); cv.width = PTW; cv.height = PTH;
  const g = cv.getContext('2d')!, im = g.createImageData(PTW, PTH), n = (x: number, y: number) => 0.65 * noise2(x * 0.011, y * 0.16, 7) + 0.35 * noise2(x * 0.037, y * 0.45, 8);
  for (let y = 0; y < PTH; y++) for (let x = 0; x < PTW; x++) {
    const u = x / PTW, v = n(x, y) * (1 - u) + n(x - PTW, y) * u, i = (y * PTW + x) * 4; // (blended with itself a tile over: seamless)
    im.data[i] = 7; im.data[i + 1] = 6; im.data[i + 2] = 12; im.data[i + 3] = Math.round(smoothstep(-0.08, 0.28, v) * 190);
  }
  g.putImageData(im, 0, 0);
  return (PUD = cv);
}
/** The wet road: the frame drawn so far above the mirror line my, flipped into the road from y0 down, squashed, broken
 *  by ripples (strips slid sideways, irregularly) and fading toward the lens, its lights smeared down it in streaks;
 *  then the dry patches between the puddles darkening it, sliding with the road as the camera trucks (cx). */
function wetRoad(c: C, t: number, my: number, y0: number, cx = 0, alpha = 0.5, streak = 0.34) {
  const sq = 0.62, k = SCALE, hs = Math.min(my, (H - my) / sq + 6);
  if (y0 >= H - 2 || hs <= 4) return;
  if (!RB || RB.width !== W * k || RB.height < Math.ceil(hs * k)) { RB = document.createElement('canvas'); RB.width = W * k; RB.height = Math.ceil(hs * k); }
  const r = RB.getContext('2d')!;
  r.setTransform(1, 0, 0, 1, 0, 0); r.clearRect(0, 0, RB.width, RB.height);
  r.setTransform(1, 0, 0, -1, 0, hs * k); r.drawImage(c.canvas, 0, (my - hs) * k, W * k, hs * k, 0, 0, W * k, hs * k); // flipped: row 0 is the mirror line
  c.save();
  for (let y = y0; y < H; y += 3) {
    const d = (y - y0) / (H - y0), src = ((y - my) / sq) * k;
    if (src + (3 / sq) * k > hs * k) break;
    const dx = (0.8 + 4.5 * d) * noise1(y * 0.06 + t * 1.7, 31) + (0.4 + 1.6 * d) * noise1(y * 0.33 - t * 5.3, 37);
    c.globalAlpha = alpha * (1 - 0.5 * d);
    c.drawImage(RB, 0, src, W * k, (3 / sq) * k, dx - 6, y, W + 12, 3);
  }
  if (!SB) { SB = document.createElement('canvas'); SB.width = W / 2; SB.height = 10; } // the streaks: shrunk to a few rows, stretched back (a vertical blur)
  const s = SB.getContext('2d')!; s.imageSmoothingQuality = 'high'; s.globalCompositeOperation = 'copy';
  s.drawImage(RB, 0, 0, W * k, Math.min(hs, (H - my) / sq) * k, 0, 0, SB.width, SB.height);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = streak; c.imageSmoothingQuality = 'high';
  c.drawImage(SB, 0, 0, SB.width, SB.height, 0, my, W, H - my);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const pm = puddles();
  for (let y = y0; y < H; y += 4) {
    const d = (y - y0) / (H - y0), row = Math.min(PTH - 1, d * PTH), sc = 1 + 1.6 * d, ws = W / sc, off = (((lerp(PF, 1.5, d) * cx) / sc) % PTW + PTW) % PTW;
    if (off + ws <= PTW) c.drawImage(pm, off, row, ws, 1, 0, y, W, 4);
    else { const w1 = PTW - off; c.drawImage(pm, off, row, w1, 1, 0, y, w1 * sc, 4); c.drawImage(pm, 0, row, ws - w1, 1, w1 * sc, y, W - w1 * sc, 4); }
  }
  c.restore();
}
/** Rain in three depths (fine and far, mid, heavy and near), each sliding sideways with its depth as the camera trucks
 *  (cx, cv: the camera's x and speed), streaked along its motion over a short shutter. */
function rain(c: C, t: number, cx: number, cv: number) {
  c.save(); c.lineCap = 'round';
  ([[0.4, 520, 900, 0.9, 0.12], [0.9, 260, 1500, 1.3, 0.18], [1.8, 70, 2500, 2.2, 0.24]] as const).forEach(([p, n, vy, lw, al], li) => {
    const vx = -50 - p * cv, WW = W + 400, HH = H + 200, path = new Path2D();
    for (let i = 0; i < n; i++) {
      const x = ((hash(i, 61 + li) * WW - 50 * t - p * cx) % WW + WW) % WW - 200, y = ((hash(i, 64 + li) * HH + vy * t * (0.85 + 0.3 * hash(i, 67 + li))) % HH) - 100;
      path.moveTo(x, y); path.lineTo(x - vx * 0.024, y - vy * 0.024);
    }
    c.strokeStyle = `rgba(196,206,255,${al})`; c.lineWidth = lw; c.stroke(path);
  });
  c.restore();
}
/** Drops landing on the road (from y0 down; nearer ones bigger): a ring and, at first, a crown. */
function splashes(c: C, t: number, y0: number, cx: number, n = 60) {
  c.save(); c.strokeStyle = 'rgba(210,218,255,0.4)'; c.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const T = 0.3 + 0.35 * hash(i, 71), ph = t / T + hash(i, 72), k = Math.floor(ph), f = ph - k;
    if (f > 0.3) continue;
    const d = Math.pow(hash(i, k, 73), 0.7), y = y0 + 6 + (H - y0 - 6) * d, p = lerp(PF, 1.4, d), WW = W + 200;
    const x = ((hash(i, k, 74) * WW - p * cx) % WW + WW) % WW - 100, r = (1.5 + 6 * d) * (0.35 + f / 0.3);
    c.globalAlpha = 1 - f / 0.3; c.beginPath(); c.ellipse(x, y, r, r * 0.28, 0, 0, TAU); c.stroke();
    if (f < 0.12) { c.beginPath(); c.moveTo(x - r * 0.4, y); c.lineTo(x - r * 0.7, y - r * 1.2); c.moveTo(x + r * 0.4, y); c.lineTo(x + r * 0.7, y - r * 1.2); c.stroke(); }
  }
  c.restore();
}
/** The truck down the street (camera x at depth 1): easing up over the riser to the solo's pace, settling over the last
 *  bar. */
function truck(T0: number, T1: number, riser: number, T5: number, T6: number, V = 420) {
  const dt = 1 / 240, X = [0];
  const vel = (t: number) => (t < T5 ? V * (0.68 + 0.32 * smoothstep(riser - 0.2, T1 + 0.2, t)) : V * (1 - clamp((t - T5) / (T6 - T5))) ** 2);
  for (let t = T0; t < T6 + 0.5; t += dt) X.push(X[X.length - 1]! + vel(t + dt / 2) * dt);
  const camX = (t: number) => { const f = (t - T0) / dt, i = clamp(Math.floor(f), 0, X.length - 2); return lerp(X[i]!, X[i + 1]!, clamp(f - i)); };
  return { camX, vel };
}

type Plan = { kind: Arch; w: number; floors: number; shop?: string; awning?: boolean; bill?: 'fox' | 'yozakura'; nobori?: [string, string, string][]; neon?: (x: number, w: number, top: number) => Sign[] };
const WHITE = '#efe4cc', RED = '#b8241c', INDIGO = '#1e2c52', YELLOW = '#d7b04a', BLACK = '#120a10';
/** The cinema's nobori (offsets from its middle, street px). */
const CINEMA_NOBORI = [['千本桜', -300], ['主演初音', -250], ['大入', 250], ['満員御礼', 300]] as const;
const cinemaNobori = (x0: number, s: number): Nobori[] => CINEMA_NOBORI.map(([text, dx]) => ({ x: x0 + dx * s, text, col: text === '大入' ? RED : WHITE, ink: text === '大入' ? WHITE : RED }));

export const SOLO: Record<string, (b: Build) => void> = {
  neon(b) {
    const A = b.audio, T0 = b.start, T6 = b.end, bar0 = Math.round(A.barAt(T0)), T1 = A.timeOfBar(bar0 + 1), T5 = A.timeOfBar(bar0 + 5), P = A.periodAt(T0);
    const riser = A.ev.in(T0, T1 + 0.05, 'riser')[0]?.t ?? T1 - 2 * P;
    const { camX, vel } = truck(T0, T1, riser, T5, T6);
    const XE = camX(T6), XC = W / 2 + PF * XE, ROW = Math.ceil(PF * XE + W + 300), foot = BASE - GH - 8;
    // the street, left to right up to the cinema's neighbour (squeezed to fit), each front with its neon
    const PLAN: Plan[] = [
      { kind: 'shop', w: 230, floors: 3, shop: '洋品', awning: true, neon: (x, w) => [vBoard(x + w - 44, foot, 'カフェー', 50, NEON.pink, NEON.gold)] },
      { kind: 'mansard', w: 270, floors: 3, shop: '珈琲', neon: (x, w, top) => [hWord(x + w / 2, top + 46, 'Café', 64, NEON.pink, '64px "CormorantItalic-600"', NEON.gold)] },
      { kind: 'bank', w: 320, floors: 3, bill: 'fox', nobori: [['大入', WHITE, RED], ['狐の嫁入り', INDIGO, WHITE], ['新作', RED, WHITE]], neon: (x) => [vBoard(x + 44, foot, '電光館', 56, NEON.cyan, NEON.pink)] },
      { kind: 'machiya', w: 210, floors: 2, neon: (x, w, top) => [picto(x + w / 2, top - 58, 'cup', 74, NEON.green, '喫茶')] },
      { kind: 'gable', w: 220, floors: 4, shop: '寫眞', neon: (x) => [vBoard(x + 42, foot, '寫眞館', 52, NEON.violet)] },
      { kind: 'dome', w: 300, floors: 3, nobori: [['浅草オペラ', YELLOW, BLACK], ['大入', WHITE, RED], ['初日', INDIGO, WHITE]], neon: (x, w, top) => [hWord(x + w / 2 - 20, top + 44, 'OPERA', 48, NEON.gold, '48px "Cormorant-600"', NEON.pink), vBoard(x + w - 40, foot, '浅草オペラ', 44, NEON.gold, NEON.pink), picto(x + 70, foot - 4, 'note', 64, NEON.cyan)] },
      { kind: 'tower', w: 250, floors: 3, shop: '時計', neon: (x, w, top) => [hWord(x + w / 2 + 24, top + 48, 'BAR', 54, NEON.green, '54px "Archivo-1000-500"'), picto(x + w / 2 + 30, foot - 4, 'mug', 66, NEON.gold, 'ビヤホール')] },
      { kind: 'shop', w: 220, floors: 3, shop: '蓄音', neon: (x, w) => [picto(x + w / 2, foot - 4, 'horn', 82, NEON.violet, '蓄音器')] },
      { kind: 'bank', w: 310, floors: 3, bill: 'yozakura', nobori: [['夜桜座', RED, WHITE], ['千本桜', WHITE, BLACK], ['満員御礼', INDIGO, WHITE]], neon: (x, w) => [picto(x + 54, foot - 6, 'sakura', 70, NEON.pink), vBoard(x + w - 40, foot, '夜桜座', 58, NEON.pink, NEON.cyan)] },
      { kind: 'machiya', w: 220, floors: 2, neon: (x, w, top) => [picto(x + w / 2, top - 56, 'fox', 78, NEON.red, '稲荷寿司', NEON.gold)] },
    ];
    const end = XC - CW - 10 - 250 - 12, fit = (end + 40) / PLAN.reduce((s, p) => s + p.w + 12, 0);
    const signs: Sign[] = [], banners: Nobori[] = cinemaNobori(XC, 1);
    b.add(layer(W, H, (c) => rainSky(c), 1450));
    b.dyn((c, t) => searchlights(c, t, [360, 1240, 1890], 640), { p: 0.06 });
    // the far roofs and the tower (it lights storey by storey through the solo, its beacon on the beats)
    let towerBulbs: Bulb[] = [];
    b.add(layer(Math.ceil(W + 0.15 * XE + 200), H, (c) => {
      towerBulbs = tower(c, 930, 700);
      const r = mulberry32(1452);
      for (let x = -20; x < W + 0.15 * XE + 220;) {
        const w = 50 + r() * 130, h = 40 + r() * 120;
        c.fillStyle = '#0a0812'; c.fillRect(x, 640 - h, w, h + 200);
        if (r() < 0.4) { c.fillStyle = '#c98f4c'; c.fillRect(x + w * r(), 650 - h + 14, 4, 6); }
        x += w;
      }
    }, 1452), { p: 0.15 });
    const bb0 = Math.round(A.beatAt(T0)), tipY = 700 - 400 - 178;
    b.dyn((c, t) => {
      drawBulbs(c, towerBulbs, (bl) => 0.9 * clamp((t - A.timeOfBeat(bb0 + 1 + 2 * bl.i)) / 0.06));
      const bt = A.beatAt(t), k = Math.exp(-(bt - Math.floor(bt)) / 0.25); // the beacon
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.4 + 0.6 * k; c.drawImage(bulbSprite(), 930 - 14, tipY - 14, 28, 28); c.restore();
      c.fillStyle = `rgba(255,70,50,${0.5 + 0.5 * k})`; c.beginPath(); c.arc(930, tipY, 2.6, 0, TAU); c.fill();
    }, { p: 0.15 });
    // the street front (drawn once): the buildings, the billboards, the cinema and its neighbours, the pavement, the road
    b.add(layer(ROW, H, (c, r) => {
      let x = -40;
      for (const pl of PLAN) {
        const w = Math.round(pl.w * fit), top = topOf(pl.floors);
        elevation(c, x, BASE, { kind: pl.kind, w, floors: pl.floors, fh: FH, sign: pl.shop, awning: pl.awning, lit: 0.22, pal: NIGHT }, r);
        if (pl.bill) billboard(c, x + w * 0.3, top + 16, w * 0.62, foot - top - 30, pl.bill, r);
        signs.push(...(pl.neon?.(x, w, top) ?? []));
        pl.nobori?.forEach(([text, col, ink], j) => banners.push({ x: x + w * (0.18 + 0.24 * j), text, col, ink }));
        x += w + 12;
      }
      neighbours(c, XC, BASE, signs, 1);
      c.save(); c.translate(XC, BASE); c.scale(SC, SC); cinemaFront(c); c.restore();
      for (x = XC + CW + 10 + 282 + 332; x < ROW;) { const w = 240 + Math.round(r() * 60); elevation(c, x, BASE, { kind: r() < 0.5 ? 'shop' : 'bank', w, floors: 3, fh: FH, lit: 0.22, pal: NIGHT }, r); x += w + 12; }
      c.fillStyle = '#0d0a12'; c.fillRect(0, BASE, ROW, KERB);
      c.strokeStyle = 'rgba(160,146,222,0.12)'; c.lineWidth = 1;
      for (let yy = BASE + 7, k = 0; yy < BASE + KERB; yy += 7, k++) { c.beginPath(); c.moveTo(0, yy); c.lineTo(ROW, yy); c.stroke(); for (let xx = (k % 2) * 14; xx < ROW; xx += 28) { c.beginPath(); c.moveTo(xx, yy - 7); c.lineTo(xx, yy); c.stroke(); } }
      c.fillStyle = 'rgba(200,184,255,0.45)'; c.fillRect(0, BASE + KERB - 1.5, ROW, 1.5); // the kerb's wet edge
      c.fillStyle = '#07060c'; c.fillRect(0, BASE + KERB, ROW, H - BASE - KERB);
    }, 1451), { p: PF });
    // when each sign strikes: those in the frame from the start one per 16th over the riser, left to right (two burn
    // already); the rest on the eighth after they come into view
    const inView = (s: Sign, t: number) => s.x + s.w / 2 - PF * camX(t) < W * 0.93;
    const first = signs.filter((s) => inView(s, T0)).sort((p, q) => p.x - q.x);
    first.forEach((s, j) => { s.ign = j === 1 || j === 4 ? T0 - 1 : riser + j * (P / 4); });
    for (const s of signs) if (!first.includes(s)) {
      let te = T0;
      while (te < T6 && !inView(s, te)) te += 1 / 60;
      s.ign = A.timeOfBeat(Math.ceil(A.beatAt(te) * 2) / 2) + 0.001;
    }
    signs[4]!.buzz = signs[signs.length - 7]!.buzz = true;
    const view = (t: number, m = 200): [number, number] => [PF * camX(t) - m, PF * camX(t) + W + m];
    b.dyn((c, t, _lt, a) => drawSigns(c, signs, t, a, ...view(t)), { p: PF });
    // the cinema: its bulbs switch on from the pavement up over the last bar, its name strikes, the clock ticks
    const cin = cinemaSigns();
    for (const s of cin) s.ign = T6 - 0.42;
    const cbOn = (bl: Bulb) => (bl.g === 5 ? T5 + 0.55 + ((bl.x + 225) / 450) * 0.35 : T5 + 0.08 + clamp(-bl.y / 1300) * (T6 - T5 - 0.5));
    b.dyn((c, t, _lt, a) => {
      if (XC - CW - 60 > PF * camX(t) + W) return;
      c.save(); c.translate(XC, BASE); c.scale(SC, SC);
      drawBulbs(c, cinemaBulbs(), (bl) => 0.92 * clamp((t - cbOn(bl)) / 0.07));
      drawSigns(c, cin, t, a);
      clockFace(c, 0, CLOCK.y, CLOCK.R, ...soloClock(A, t));
      c.restore();
    }, { p: PF });
    b.dyn((c, t) => { const [u0, u1] = view(t, 100); for (const n of banners) if (n.x > u0 && n.x < u1) nobori(c, n, BASE + 20, t); }, { p: PF });
    // the evening crowd under umbrellas; a rickshaw with its hood up
    const KINDS = ['hakama', 'gent', 'student', 'hakama', 'gent', 'child', 'hakama', 'student', 'gent'];
    const UMB: [string, string?][] = [['#b8322a', WHITE], ['#18131d'], ['#243a63', WHITE], ['#c48a3a'], ['#18131d'], ['#7a2a52', WHITE]];
    const people: { kind: string; x0: number; v: number; h: number; um?: string; ring?: string }[] = Array.from({ length: 16 }, (_, i) => {
      const kind = KINDS[i % KINDS.length]!, [um, ring] = UMB[i % UMB.length]!;
      return { kind, x0: 80 + i * 265 + 90 * hash(i, 81), v: (hash(i, 82) < 0.5 ? -1 : 1) * (26 + 22 * hash(i, 83)), h: kind === 'child' ? 54 : 82 + 10 * hash(i, 84), um, ring };
    });
    people.push({ kind: 'rickshaw', x0: 2400, v: -90, h: 90 });
    b.dyn((c, t) => {
      const [u0, u1] = view(t, 150);
      for (const q of people) {
        const d = (t - T0) * q.v, x = q.x0 + d;
        if (x > u0 && x < u1) passerby(c, q.kind, x, BASE + 20, q.h, (Math.abs(d) / (0.42 * q.h)) * Math.PI + q.x0, Math.sign(q.v), q.um, q.ring);
      }
    }, { p: PF });
    // the wet road mirrors everything drawn so far; drops land on it
    const cam = (t: number) => ({ x: camX(t), zoom: 1 + 0.008 * A.hit('kick', t, 0.12) });
    const sy = (v: number, z: number) => H / 2 + z * (v - H / 2);
    b.dyn((c, t) => { const z = cam(t).zoom; wetRoad(c, t, sy(BASE, z), sy(BASE + KERB, z), camX(t)); splashes(c, t, sy(BASE + KERB, z), camX(t)); }, { p: -1 });
    // telegraph poles and their wires whipping past near the lens, soft (out of focus), rimmed by the neon either side;
    // spaced to stand either side of the cinema when the truck settles
    const POLE = 1520, NP = 1.4, P0 = (((200 + NP * XE) % POLE) + POLE) % POLE;
    b.dyn((c, t) => {
      const u0 = NP * camX(t) - 300, k0 = Math.floor((u0 - P0) / POLE), k1 = Math.ceil((u0 + W + 600 - P0) / POLE);
      for (let k = k0; k <= k1; k++) {
        const xa = k * POLE + P0, xb = xa + POLE;
        for (const [y, L] of [[70, 128], [114, 100]] as const) for (let q = -L + 16; q <= L - 16; q += 36) {
          c.beginPath(); c.moveTo(xa + q, y - 7); c.quadraticCurveTo((xa + xb) / 2 + q, y + 80, xb + q, y - 7);
          c.strokeStyle = 'rgba(6,5,10,0.95)'; c.lineWidth = 1.8; c.stroke(); c.strokeStyle = 'rgba(255,140,210,0.12)'; c.lineWidth = 0.8; c.stroke();
        }
      }
      c.save(); c.shadowColor = 'rgba(4,3,8,0.9)'; c.shadowBlur = 7;
      for (let k = k0; k <= k1; k++) {
        const x = k * POLE + P0, g = c.createLinearGradient(x - 21, 0, x + 21, 0); // round: lit cyan from one side, pink from the other
        g.addColorStop(0, '#1b3440'); g.addColorStop(0.22, '#0a0910'); g.addColorStop(0.7, '#08070c'); g.addColorStop(1, '#3d1834');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - 21, H + 30); c.lineTo(x - 15, -30); c.lineTo(x + 15, -30); c.lineTo(x + 21, H + 30); c.closePath(); c.fill();
        c.fillStyle = '#060509';
        for (const [y, L] of [[70, 128], [114, 100]] as const) {
          c.fillRect(x - L, y, 2 * L, 11);
          for (let q = -L + 16; q <= L - 16; q += 36) { c.fillStyle = '#231c2c'; c.beginPath(); c.ellipse(x + q, y - 5, 5.5, 7.5, 0, 0, TAU); c.fill(); c.fillStyle = '#060509'; }
        }
      }
      c.restore();
      for (let k = k0; k <= k1; k++) {
        const x = k * POLE + P0;
        c.lineWidth = 1.6;
        c.strokeStyle = 'rgba(255,100,190,0.3)'; c.beginPath(); c.moveTo(x + 19.5, H + 30); c.lineTo(x + 14, -30); c.stroke(); // the neon down its sides
        c.strokeStyle = 'rgba(80,220,255,0.18)'; c.beginPath(); c.moveTo(x - 19.5, H + 30); c.lineTo(x - 14, -30); c.stroke();
      }
    }, { p: NP });
    // two passers-by close to the lens, against the truck: a red janome, a black bat umbrella
    const close = [{ t: T0 + 2.4, kind: 'hakama', um: '#b8322a', ring: WHITE, v: -240 }, { t: T0 + 6.2, kind: 'gent', um: '#141018', ring: undefined, v: -180 }];
    b.dyn((c, t) => {
      for (const q of close) {
        const x = W + 380 + 1.7 * camX(q.t) + q.v * (t - q.t), sx = x - 1.7 * camX(t);
        if (sx < -420 || sx > W + 420) continue;
        passerby(c, q.kind, x, H + 100, 520, (Math.abs(q.v * (t - q.t)) / (0.42 * 520)) * Math.PI, -1, q.um, q.ring, false, 2.6);
      }
    }, { p: 1.7 });
    b.dyn((c, t) => rain(c, t, camX(t), vel(t)), { p: -1 });
    b.camera((t) => cam(t));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(18, { p: 1.3 });
    b.post(() => ({ bloom: 0.75, halation: 0.3, vignette: 0.42 }));
  },

  marquee(b) {
    const A = b.audio, T7 = b.start, T12 = b.end, T11 = A.timeOfBar(Math.round(A.barAt(T12)) - 1), b7 = A.beatAt(T7);
    const M = 1.55, SM = SC * M, CX = W / 2, FOOT = 905; // the street M× nearer than at the truck's end; the cinema's foot
    b.add(layer(W, H, (c) => rainSky(c), 1460));
    b.dyn((c, t) => searchlights(c, t, [300, 1620], 420), { p: 0.05 });
    // the neighbours and the pavement (drawn once); their signs live
    const signs: Sign[] = [];
    b.add(layer(W, H, (c) => {
      c.save(); c.translate(CX, FOOT); c.scale(M, M); neighbours(c, 0, 0, signs, M, true); c.restore();
      c.fillStyle = '#0d0a12'; c.fillRect(0, FOOT, W, KERB * M);
      c.strokeStyle = 'rgba(160,146,222,0.12)'; c.lineWidth = 1;
      for (let yy = FOOT + 10, k = 0; yy < FOOT + KERB * M; yy += 10, k++) { c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); for (let xx = (k % 2) * 20; xx < W; xx += 40) { c.beginPath(); c.moveTo(xx, yy - 10); c.lineTo(xx, yy); c.stroke(); } }
      c.save(); c.globalAlpha = 0.5; c.globalCompositeOperation = 'lighter'; halftone(c, CX, FOOT + 22, 470 * SM, 34, '#e8c878'); c.restore(); // the light under the canopy
      c.fillStyle = 'rgba(200,184,255,0.45)'; c.fillRect(0, FOOT + KERB * M - 2, W, 2);
      c.fillStyle = '#07060c'; c.fillRect(0, FOOT + KERB * M, W, H - FOOT - KERB * M);
    }, 1461));
    for (const s of signs) s.ign = T7 - 1;
    b.dyn((c, t, _lt, a) => { c.save(); c.translate(CX, FOOT); c.scale(M, M); drawSigns(c, signs, t, a); c.restore(); });
    // the cinema: bulbs chasing on the eighths, running up the pylons on the sixteenths, 千本桜 lighting glyph by glyph
    // on the first three beats; every bulb flaring on the last downbeat
    const cin = cinemaSigns(SM * 2);
    for (const s of cin) s.ign = T7 - 1;
    const e8 = (t: number) => Math.floor((A.beatAt(t) - b7) * 2 + 1e-6), e16 = (t: number) => Math.floor((A.beatAt(t) - b7) * 4 + 1e-6);
    const level = (bl: Bulb, t: number) => {
      const flare = t >= T11 ? 0.75 * Math.exp(-(t - T11) / 0.5) : 0;
      if (bl.g === 0) return ((((bl.i - e16(t)) % 4) + 4) % 4 === 0 ? 1 : 0.2) + flare;
      if (bl.g === 5) return t < A.timeOfBeat(b7 + bl.i) ? 0 : 0.82 + 0.18 * hash(Math.floor(t * 15), bl.x, bl.y) + flare;
      if (bl.g === 3 || bl.g === 6) return 0.9 + flare;
      return ((bl.i + e8(t)) % 3 === 0 ? 1 : 0.24) + flare;
    };
    b.dyn((c, t, _lt, a) => {
      c.save(); c.translate(CX, FOOT); c.scale(SM, SM);
      cinemaFront(c);
      drawBulbs(c, cinemaBulbs(), (bl) => level(bl, t));
      drawSigns(c, cin, t, a);
      clockFace(c, 0, CLOCK.y, CLOCK.R, ...soloClock(A, t));
      c.restore();
    });
    // in front: the nobori, the doorman and the queue (furled under the canopy, open beyond it), drips off the canopy
    const banners = cinemaNobori(0, M);
    const queue = [['student', 210, undefined], ['hakama', 292, '#b8322a'], ['gent', 372, '#18131d'], ['hakama', 446, '#243a63'], ['student', 528, '#18131d'], ['hakama', 612, '#7a2a52'], ['gent', 700, '#18131d']] as const;
    b.dyn((c, t) => {
      c.save(); c.translate(CX, FOOT);
      for (const n of banners) nobori(c, n, 20 * M, t, M);
      c.scale(SM, SM);
      queue.forEach(([kind, x, um], i) => passerby(c, kind, x, 44, (i === 0 ? 96 : 86) / SC, 0.05 * Math.sin(t * 1.3 + i * 1.7), -1, um, um === '#b8322a' ? WHITE : undefined, x < 470, 2.2));
      const drips = new Path2D(); // off the canopy's edge, lit by its bulbs
      for (let i = 0; i < 44; i++) { const x = -462 + 924 * hash(i, 91), y = -330 + ((t * 1900 + hash(i, 92) * 1650) % 330); drips.moveTo(x, y); drips.lineTo(x, y + 30); }
      c.strokeStyle = 'rgba(255,226,180,0.5)'; c.lineWidth = 2.2; c.lineCap = 'round'; c.stroke(drips);
      c.restore();
    });
    // the camera: the front with a slow push; a cut on the next-to-last bar's kick to the canopy close (its bulb
    // letters, the posters), a tilt up the fanlight; from the last downbeat the rise into the clock, landing on its face
    // as the build's clock (R 360, centred)
    const T10 = A.timeOfBar(Math.round(A.barAt(T12)) - 2), ZE = 360 / (CLOCK.R * SM), cy = FOOT + CLOCK.y * SM, vC = FOOT - 400 * SM, Z2 = 2;
    const cam = (t: number) => {
      if (t < T10) { const k = ease.inOutQuad(clamp((t - T7) / (T10 - T7))); return { x: 0, y: -24 * k, zoom: 1 + 0.06 * k }; }
      const u1 = ease.inOutQuad(clamp((t - T10) / (T11 - T10)));
      if (t < T11) return { x: 0, y: lerp(vC + 20, vC - 120, u1) - 540, zoom: lerp(1.85, Z2, u1) };
      const u = clamp((t - T11) / (T12 - T11)), z = Z2 * Math.pow(ZE / Z2, ease.inOutCubic(u)), ys = lerp(540 + Z2 * (cy - vC + 120), 540, ease.inOutQuad(u)); // ys: the clock's height on the screen
      return { x: 0, y: cy - (ys - 540) / z - 540, zoom: z };
    };
    b.camera((t) => cam(t));
    b.dyn((c, t) => {
      const { y, zoom: z } = cam(t), my = H / 2 + z * (FOOT - y - H / 2);
      wetRoad(c, t, my, my + KERB * M * z, 0, 0.55, 0.36); splashes(c, t, my + KERB * M * z, 0, 40);
    }, { p: -1 });
    b.dyn((c, t) => rain(c, t, 0, 0), { p: -1 });
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(14, { p: 1.2 });
    b.post(() => ({ bloom: 0.75, halation: 0.3, vignette: 0.42 }));
  },
};
