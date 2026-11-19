// The graphic worlds (docs/TREATMENT.md, Direction v3): flat Taisho-romance poster compositions, each built from
// pre-drawn layers (taisho.ts) composited every frame through a 2.5D camera, plus moving drawings, petals and screen
// overlays. `params.world` picks one: the intro's animated worlds (intro.ts), batch 2's (worlds.ts), or here:
//   fireworks fireworks over the river, an iron bridge with lanterns, the reflections
//   ink       the world redrawn in ink on washi (the quiet chorus): the skyline as line art, the title in brush
// The camera: a truck (x, y in px at depth 1), a zoom about (fx, fy) for every layer alike (a lens), and a dolly that
// scales nearer layers more; each layer and drawing has a depth p (0 = as far as the sky, 1 = the main plane, > 1 nearer).
// Overlays (the gold frame, wipes) are in screen space. A smear echoes the frame along a fast move (no motion blur at
// one sample per frame).
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import type { AudioData, AudioSample } from '../engine/audio';
import { Layer2D, W, H, SCALE, clearRT } from '../engine/gl';
import { hash } from '../engine/util';
import { PAL, SERIF900, layer, washi, decoFrame, skyline, mikuStanding, sealStamp, sakuraFlower, sakuraTree } from './taisho';
import { drawColumn, phraseTimes } from './torii';
import { WORLDS } from './worlds';
import { INTRO } from './intro';
import { VERSE1 } from './verse1';
import { CARDS } from './cards';
import { VERSE2 } from './verse2';
import { PRE2 } from './pre2';
import { SOLO } from './solo';
import { CLOCKWORKS } from './clockworks';
import { PRE3 } from './pre3';

type C = CanvasRenderingContext2D;
export type Draw = (c: C, t: number, lt: number, a: AudioSample) => void;
/** sx, sy: a shift of the whole frame in screen px (a pan or tilt: every depth alike, unlike the truck x, y). */
export type Cam = { x: number; y: number; zoom: number; fx: number; fy: number; dolly: number; rot: number; sx: number; sy: number };
/** An echo of the frame along a move: the last copy offset by (dx, dy) and scaled by 1 + dz about (fx, fy). */
export type Smear = { dx: number; dy: number; dz: number; fx: number; fy: number; n?: number; a?: number };
type Layer = { cv: HTMLCanvasElement; w: number; h: number; px: number; py: number; p: number; alpha?: (t: number) => number };
type Item = { L: Layer } | { f: Draw; p: number };
export type Build = {
  add: (cv: HTMLCanvasElement, o?: { px?: number; py?: number; drift?: number; p?: number; alpha?: (t: number) => number }) => void;
  /** p < 0: in screen space, outside the camera. */
  dyn: (f: Draw, o?: { p?: number }) => void;
  overlay: (f: Draw) => void;
  camera: (f: (t: number, lt: number) => Partial<Cam>) => void;
  smear: (f: (t: number) => Smear | null) => void;
  /** The petals' clock (s of drift) at t: gusts run it faster. */
  wind: (f: (t: number) => number) => void;
  post: (f: (t: number) => Record<string, unknown>) => void;
  phrases: ReturnType<typeof phraseTimes>; audio: AudioData; start: number; end: number;
  petals: (n: number, o?: { p?: number; size?: number; alpha?: (t: number) => number }) => void;
};

export default class Poster extends Scene {
  text = new Layer2D();
  snap = new Layer2D();
  items: Item[] = [];
  overlays: Draw[] = [];
  camFn: ((t: number, lt: number) => Partial<Cam>) | null = null;
  smearFn: ((t: number) => Smear | null) | null = null;
  windFn: ((t: number) => number) | null = null;
  postFn: ((t: number) => Record<string, unknown>) | null = null;
  world = 'title';
  petals = 120;
  petalP = 1.2;
  petalSize = 1;
  petalAlpha: ((t: number) => number) | null = null;
  title = '';
  warnings: string[] = [];

  override init() {
    this.world = (this.ctx.params.world as string) ?? 'title';
    // the chorus title phrase (the first phrase of the first line sung in a chorus's stop bar), for the ink world
    const ch = this.ctx.audio.sections.find((s) => s.name === 'chorus3a') ?? this.ctx.audio.sections.find((s) => s.name.startsWith('chorus'));
    const l = this.ctx.lyrics.lines.find((x) => ch && x.start >= ch.start - 0.3);
    this.title = l ? l.text.split(/\s+/)[0]! : '';
    const add: Build['add'] = (cv, o = {}) => {
      this.items.push({ L: { cv, w: cv.width / SCALE, h: cv.height / SCALE, px: o.px ?? 0, py: o.py ?? 0, p: o.p ?? o.drift ?? 0, alpha: o.alpha } });
    };
    const build = INTRO[this.world] ?? VERSE1[this.world] ?? VERSE2[this.world] ?? PRE2[this.world] ?? SOLO[this.world] ?? CLOCKWORKS[this.world] ?? PRE3[this.world] ?? CARDS[this.world] ?? WORLDS[this.world]; // the animated worlds replace the board's stills of the same name
    if (build) {
      const { audio, lyrics } = this.ctx, P = audio.periodAt(60), vOn = audio.events('vocal', 0, audio.duration + 1).map(([t]) => t);
      const g0 = audio.beats[0]!, q16 = P / 4, snap16 = (t: number) => g0 + Math.round((t - g0) / q16) * q16;
      // params.carry: also the line still being sung when this world cuts in (a card between two shots of one line)
      const carry = !!this.ctx.params.carry;
      const phrases = lyrics.lines.filter((l) => (carry ? l.end > this.ctx.start : l.start >= this.ctx.start - 0.3) && l.start < this.ctx.end - 0.3).flatMap((l) => phraseTimes(l, vOn, snap16));
      this.afterBuild = true;
      build({
        add, dyn: (f, o) => { this.items.push({ f, p: o?.p ?? 1 }); }, overlay: (f) => { this.overlays.push(f); },
        camera: (f) => { this.camFn = f; }, smear: (f) => { this.smearFn = f; }, wind: (f) => { this.windFn = f; }, post: (f) => { this.postFn = f; },
        phrases, audio, start: this.ctx.start, end: this.ctx.end,
        petals: (n, o) => { this.petals = n; this.petalP = o?.p ?? 1.2; this.petalSize = o?.size ?? 1; this.petalAlpha = o?.alpha ?? null; },
      });
      this.checkEdges();
      return;
    }
    if (this.world === 'fireworks') {
      const top = (c: C, r: () => number) => {
        const g = c.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#0e0a1c'); g.addColorStop(1, '#2a1636');
        c.fillStyle = g; c.fillRect(0, 0, W, 640);
        const burst = (x: number, y: number, R: number, col: string, n: number) => { // a chrysanthemum: rays of dots, brighter at the tips
          const halo = c.createRadialGradient(x, y, 0, x, y, R * 1.3); halo.addColorStop(0, col.replace('1)', '0.28)')); halo.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = halo; c.fillRect(x - R * 1.4, y - R * 1.4, R * 2.8, R * 2.8);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + r() * 0.05;
            for (let k = 0; k < 14; k++) { const d = (k / 13) * R * (0.92 + r() * 0.1); c.fillStyle = col.replace('1)', `${0.25 + 0.75 * (k / 13) ** 2})`); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d + (k / 13) ** 2 * 18, 1 + (k / 13) * 2.4, 0, Math.PI * 2); c.fill(); }
          }
        };
        burst(560, 230, 190, 'rgba(255,214,140,1)', 64); burst(1300, 170, 230, 'rgba(247,182,204,1)', 72); burst(1640, 330, 120, 'rgba(220,240,255,1)', 44); burst(930, 380, 90, 'rgba(255,120,90,1)', 36);
        skyline(c, W, 600, r, { fill: '#1a0e20', win: 0.12, rim: 'rgba(201,162,74,0.4)', scale: 0.55 });
        // the iron bridge: an arch truss with lanterns along it
        c.strokeStyle = PAL.ink; c.fillStyle = PAL.ink; c.lineWidth = 9;
        c.fillRect(0, 586, W, 16);
        for (let s = 0; s < 3; s++) {
          const x0 = 120 + s * 600, x1 = x0 + 560;
          c.lineWidth = 7; c.beginPath(); c.moveTo(x0, 600); c.quadraticCurveTo((x0 + x1) / 2, 420, x1, 600); c.stroke();
          c.lineWidth = 2; for (let k = 1; k < 12; k++) { const x = x0 + ((x1 - x0) * k) / 12, yy = 600 - 180 * (1 - ((2 * k) / 12 - 1) ** 2) * 0.5; c.beginPath(); c.moveTo(x, 590); c.lineTo(x, yy); c.stroke(); }
        }
        for (let x = 40; x < W; x += 64) { c.fillStyle = x % 128 ? PAL.ver : PAL.cream; c.beginPath(); c.ellipse(x, 574, 7, 10, 0, 0, Math.PI * 2); c.fill(); }
      };
      const up = layer(W, 640, top, 13); // drawn once: the sky and the bridge, and (flipped) their reflection
      add(layer(W, H, (c) => {
        c.drawImage(up, 0, 0, W, 640);
        // the river: the scene above mirrored about the waterline (600), broken into ripples, darker further down
        c.fillStyle = '#0b0712'; c.fillRect(0, 600, W, 480);
        const k = up.width / W;
        for (let y = 0; y < 480; y += 3) {
          const off = Math.sin(y * 0.13) * (2 + y * 0.035), src = Math.max(0, 598 - y);
          c.globalAlpha = 0.55 * (1 - y / 520);
          c.drawImage(up, 0, src * k, up.width, 3 * k, off, 600 + y, W, 3);
        }
        c.globalAlpha = 1;
        // boats with lanterns
        for (const [bx, by, bw] of [[420, 760, 260], [1260, 820, 320]] as const) {
          c.fillStyle = PAL.ink; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + bw, by); c.lineTo(bx + bw - 30, by + 26); c.lineTo(bx + 20, by + 26); c.closePath(); c.fill();
          c.fillRect(bx + 30, by - 50, bw - 60, 8); c.fillRect(bx + 36, by - 44, 6, 44); c.fillRect(bx + bw - 42, by - 44, 6, 44);
          for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? PAL.ver : PAL.warm; c.beginPath(); c.ellipse(bx + 50 + k * ((bw - 100) / 5), by - 30, 9, 12, 0, 0, Math.PI * 2); c.fill(); }
        }
      }, 14));
      this.overlays.push((c) => decoFrame(c, W, H));
      this.petals = 60;
    } else if (this.world === 'ink') {
      add(layer(W, H, (c, r) => {
        washi(c, W, H, r, PAL.cream, 'rgba(120,90,60,0.07)', 0.022);
        // the moon as a brush ring (ensō), open at the top right, the ink thinning as the brush lifts
        c.strokeStyle = PAL.ink; c.lineCap = 'round';
        for (let i = 0; i < 120; i++) { const t = i / 120, a0 = -0.9 + t * 5.6; c.lineWidth = 30 * Math.sin(t * Math.PI) ** 0.6 + 3; c.globalAlpha = 0.92 - 0.25 * t; c.beginPath(); c.arc(1180, 330, 205, a0, a0 + 0.06); c.stroke(); }
        c.globalAlpha = 1;
        skyline(c, W, 760, r, { fill: 'rgba(0,0,0,0)', line: 'rgba(18,10,16,0.32)', scale: 0.62, inkWin: 'rgba(18,10,16,0.22)' });
        c.fillStyle = 'rgba(255,250,240,0.55)'; c.fillRect(0, 760, W, 120); // the mist between the ranges
        skyline(c, W, 880, r, { fill: 'rgba(239,228,204,0.9)', line: PAL.ink, scale: 1.05, tower: 1480, win: 0.12, inkWin: 'rgba(18,10,16,0.6)' });
        c.fillStyle = 'rgba(18,10,16,0.05)'; c.fillRect(0, 880, W, 200);
        c.strokeStyle = PAL.ink; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, 880); c.lineTo(W, 880); c.stroke();
        sakuraTree(c, 300, 1090, 260, -Math.PI / 2 + 0.28, r, { ink: PAL.ink, spread: 1.2, bloom: 0.9, depth: 6, cols: ['#c8321e', '#e88aa8', '#f2b8c6'] });
        mikuStanding(c, 760, 880, 300, 0.6, 1.2, '');
        c.font = `150px ${SERIF900}`; c.fillStyle = PAL.ink;
        drawColumn(c, this.title, 1700, 120, 150, () => 1);
        sealStamp(c, '桜', 1590, 690, 64);
      }, 15));
      this.petals = 70;
    }
  }

  afterBuild = false;
  /** Content at a canvas edge (alpha > 3 % anywhere along that side) that the camera brings into the frame: a cut. */
  private checkEdges() {
    const { start, end } = this.ctx, n = 48;
    this.items.forEach((it, idx) => {
      if (!('L' in it) || it.L.p < 0) return;
      const L = it.L, cv = L.cv;
      const side = (x: number, y: number, w: number, h: number) => { // one row or column of the canvas, read through a scratch canvas
        const s = document.createElement('canvas'); s.width = w; s.height = h;
        const g = s.getContext('2d', { willReadFrequently: true })!; g.drawImage(cv, x, y, w, h, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 4) if (d[i]! > 8) return true; return false;
      };
      const solid = { left: side(0, 0, 1, cv.height), right: side(cv.width - 1, 0, 1, cv.height), top: side(0, 0, cv.width, 1), bottom: side(0, cv.height - 1, cv.width, 1) };
      for (let j = 0; j <= n; j++) {
        const t = start + ((end - start) * j) / n, lt = t - start;
        const cam: Cam = { x: 14 * lt, y: 0, zoom: 1, fx: W / 2, fy: H / 2, dolly: 0, rot: 0, sx: 0, sy: 0, ...(this.camFn?.(t, lt) ?? {}) };
        const z = cam.zoom * (1 + cam.dolly * L.p), X = (u: number) => cam.sx + cam.fx + z * (u - L.px - cam.x * L.p - cam.fx), Y = (v: number) => cam.sy + cam.fy + z * (v + L.py - cam.y * L.p - cam.fy);
        const al = L.alpha ? L.alpha(t) : 1;
        if (al <= 0) continue;
        const bad = (solid.left && X(0) > 0.5 ? 'left' : '') || (solid.right && X(L.w) < W - 0.5 ? 'right' : '') || (solid.top && Y(0) > 0.5 ? 'top' : '') || (solid.bottom && Y(L.h) < H - 0.5 ? 'bottom' : '');
        if (bad) { this.warnings.push(`${this.world}: layer ${idx} shows its ${bad} edge (content cut off) at t=${t.toFixed(2)}`); return; }
      }
    });
    for (const w of this.warnings) console.warn(w);
  }

  private applyCam(c: C, cam: Cam, p: number) {
    if (p < 0) return;
    if (cam.sx || cam.sy) c.translate(cam.sx, cam.sy);
    const z = cam.zoom * (1 + cam.dolly * p);
    if (z !== 1 || cam.rot) { c.translate(cam.fx, cam.fy); if (cam.rot) c.rotate(cam.rot); c.scale(z, z); c.translate(-cam.fx, -cam.fy); }
    if (p) c.translate(-cam.x * p, -cam.y * p);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, lt = f.lt, a = f.a;
    clearRT(renderer, out, [0, 0, 0]);
    const cam: Cam = { x: 14 * lt, y: 0, zoom: 1, fx: W / 2, fy: H / 2, dolly: 0, rot: 0, sx: 0, sy: 0, ...(this.camFn?.(t, lt) ?? {}) };
    const c = this.text.ctx;
    this.text.clear();
    for (const it of this.items) {
      c.save();
      if ('L' in it) {
        const L = it.L, al = L.alpha ? L.alpha(t) : 1;
        if (al > 0) { this.applyCam(c, cam, L.p); c.globalAlpha = al; c.drawImage(L.cv, -L.px, L.py, L.w, L.h); }
      } else { this.applyCam(c, cam, it.p); it.f(c, t, lt, a); }
      c.restore();
    }
    // petals in the wind (deterministic in t: their clock runs faster in a gust), at their own depth
    const ink = this.world === 'ink', pc = this.windFn ? this.windFn(t) : t, pa = this.petalAlpha ? this.petalAlpha(t) : 1;
    if (this.petals > 0 && pa > 0) {
      c.save(); this.applyCam(c, cam, this.petalP); c.globalAlpha = pa;
      for (let i = 0; i < this.petals; i++) {
        const s = hash(i, 1), sp = 40 + 90 * hash(i, 2), x = ((hash(i, 3) * (W + 400) - pc * sp * 1.6) % (W + 400) + W + 400) % (W + 400) - 200;
        const y = ((hash(i, 4) * (H + 200) + pc * sp) % (H + 200)) - 100, r = (5 + 9 * s) * this.petalSize;
        sakuraFlower(c, x + Math.sin(t * 1.3 + i) * 20, y, r * 0.45, pc * (1 + s) + i, ink ? 'rgba(200,50,30,0.55)' : i % 3 ? PAL.sakura2 : PAL.sakura);
      }
      c.restore();
    }
    // a fast move: the frame echoed along it, fading (the overlays stay sharp)
    const sm = this.smearFn?.(t);
    if (sm && (Math.abs(sm.dx) + Math.abs(sm.dy) > 0.5 || Math.abs(sm.dz) > 0.002)) {
      const s = this.snap.ctx, n = sm.n ?? 6;
      this.snap.clear(); s.drawImage(this.text.canvas, 0, 0, W, H);
      c.save();
      for (let k = 1; k <= n; k++) {
        const u = k / n, z = 1 + sm.dz * u;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.translate(sm.fx + sm.dx * u, sm.fy + sm.dy * u); c.scale(z, z); c.translate(-sm.fx, -sm.fy);
        c.globalAlpha = (sm.a ?? 0.5) * (1 - u * 0.85) / Math.sqrt(n / 3);
        c.drawImage(this.snap.canvas, 0, 0, W, H);
      }
      c.restore();
    }
    for (const o of this.overlays) { c.save(); o(c, t, lt, a); c.restore(); }
    comp.draw(renderer, this.text.upload(), out);
    const base = { bloom: ink ? 0.15 : 0.55, halation: ink ? 0 : 0.22, grain: 0.045, vignette: ink ? 0.25 : 0.4, shoulder: 1 };
    return { ...base, ...(this.postFn?.(t) ?? {}) };
  }
}
