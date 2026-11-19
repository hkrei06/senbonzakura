// 千本鳥居, the whole song as one flight: from high over a night cherry forest down through a great torii into an
// endless tunnel of vermilion gates, lifted out of it (the torii have no roof) for the interlude, the solo and the
// outro. The camera flies down the tunnel, up to one gate per beat. On the chorus
// downbeat (the bar the bass drops out) it brakes, the petals hang in the air and the line's first phrase stands in the
// tunnel as a huge vertical title; when the band comes back in the title bursts into petals and the camera surges on,
// a gate per beat.
// The title is the chorus line's first phrase and appears when it is sung (in the stop bar's frozen half); the rest of
// the lyrics run as vertical columns at the right, every character appearing on its own sung time (phraseTimes).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Scene, type Cue, type Frame } from '../engine/scene';
import { Layer2D, W, H, SCALE, SUBFRAME } from '../engine/gl';
import { GLSL_COMMON } from '../engine/glsl/common';
import { CamPath, canvasTex, handheld, setupRenderer, softSun } from '../engine/world';
import { GBuf, DofPass, VolLight, VolPass, scratchRT } from '../engine/kit3d';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { decoFrame, petalStorm } from './taisho';
import { clamp, ease, frameIdx, fbm2, hash, lerp, mulberry32, shutterT, smoothstep } from '../engine/util';

const GAP = 2.2; // m between gates
const NG = 70; // gates kept around the camera on the rail (154 m: the far end fogs out completely)
const NG_AIR = 420; // from the air: the whole line in view, BACK_AIR of them behind the rail point
const BACK_AIR = 170;
const LSLOT = 3; // a stone lantern pair every 3 gates
const NL = 10; // lantern slots kept on the rail
const NL_AIR = 140; // and from the air
const NPET = 22000; // the peak chorus shows them all; the rest of the song a share (density)
const NCAN = 7200; // blossom puffs of the forest seen from above (3 per crown)
const NBLOS = 96;
const BLOS_SPAN = 52.8;
const MOON_DIR = new THREE.Vector3(-0.33, 0.3, -1).normalize(); // the moonlight (shadow stripes across the path)
// the moon's disc: low ahead-left, seen in the open-sky shots (inside the tunnel the stacked beams hide it but slits:
// it shows only once the camera rises above the gates, uMoonVis)
const MOON_VIEW = new THREE.Vector3(-0.35, 0.14, -1).normalize();
// the outro's moon: higher, over the summit hall (moved while the camera is in the tunnel and the moon has set)
const MOON_OUT = new THREE.Vector3(-0.12, 0.42, -1).normalize();
// and for the last frame, low over the hills at the far end of the line (moved while the turning camera faces away)
const MOON_BACK = new THREE.Vector3(-0.2, 0.15, 1).normalize();
const NTP = 4500; // petals the title bursts into

const col = (c: [number, number, number]) => new THREE.Color(c[0], c[1], c[2]);

function paint(g: THREE.BufferGeometry, c: THREE.Color, grime = false) {
  const pos = g.getAttribute('position'), n = pos.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i), k = grime ? 1 - 0.3 * smoothstep(2.4, 3.3, y) - 0.22 * (1 - smoothstep(0.42, 1.1, y)) : 1;
    a.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const at = (g: THREE.BufferGeometry, x: number, y: number, z = 0) => g.translate(x, y, z);

/** One Inari-style torii (black kasagi and pillar bases, vermilion everywhere else), centred on x = 0, z = 0. */
export function toriiGeometry() {
  const red = col(LIN.signal), black = new THREE.Color(0.012, 0.009, 0.009);
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    parts.push(paint(at(new THREE.CylinderGeometry(0.165, 0.185, 3.3, 24), s * 1.35, 1.65), red, true));
    parts.push(paint(at(new THREE.CylinderGeometry(0.187, 0.215, 0.42, 24), s * 1.35, 0.21), black));
  }
  parts.push(paint(at(new THREE.BoxGeometry(3.3, 0.17, 0.13), 0, 2.75), red)); // nuki
  parts.push(paint(at(new THREE.BoxGeometry(0.16, 0.42, 0.12), 0, 3.04), red)); // gakuzuka
  parts.push(paint(at(new THREE.BoxGeometry(3.7, 0.18, 0.28), 0, 3.34), red)); // shimaki
  const kasagi = new THREE.BoxGeometry(4.1, 0.2, 0.36, 40, 1, 1);
  const p = kasagi.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.17 * Math.pow(Math.abs(p.getX(i)) / 2.05, 2.6)); // the upswept ends
  kasagi.computeVertexNormals();
  parts.push(paint(at(kasagi, 0, 3.52), black));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/** A stone lantern (tōrō) and, separately, its fire box openings. */
function lanternGeometry() {
  const stone = new THREE.Color(0.11, 0.105, 0.095);
  const parts = [
    at(new THREE.BoxGeometry(0.5, 0.18, 0.5), 0, 0.09),
    at(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 12), 0, 0.48),
    at(new THREE.BoxGeometry(0.46, 0.1, 0.46), 0, 0.83),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => at(new THREE.BoxGeometry(0.06, 0.3, 0.06), a! * 0.15, 1.03, b! * 0.15)),
    at(new THREE.ConeGeometry(0.42, 0.26, 4).rotateY(Math.PI / 4), 0, 1.31),
    at(new THREE.SphereGeometry(0.06, 10, 8), 0, 1.48),
  ].map((g) => paint(g.toNonIndexed(), stone));
  const fire = at(new THREE.BoxGeometry(0.25, 0.24, 0.25), 0, 1.03);
  return { stone: mergeGeometries(parts)!, fire };
}

/** A tangent-space normal map (linear data) from a height field h[y * w + x] in 0..1, wrapping at the edges. */
function normalMap(h: Float32Array, w: number, ht: number, strength: number, repeat: [number, number]) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = ht;
  const c = cv.getContext('2d')!, img = c.createImageData(w, ht);
  const at = (x: number, y: number) => h[((y + ht) % ht) * w + ((x + w) % w)]!;
  for (let y = 0; y < ht; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), o = (y * w + x) * 4;
    img.data[o] = (-dx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 8;
  return t;
}

/** The night the lacquer reflects: a dark sky dome, the moon, warm lantern glows along the path (PMREM). */
function nightEnvironment(r: THREE.WebGLRenderer) {
  const sc = new THREE.Scene();
  const dome = new THREE.SphereGeometry(50, 32, 16);
  const cols = new Float32Array(dome.getAttribute('position').count * 3);
  const pos = dome.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50, k = smoothstep(-0.1, 0.6, y);
    cols.set([lerp(0.012, 0.03, k), lerp(0.012, 0.04, k), lerp(0.014, 0.09, k)], i * 3);
  }
  dome.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  sc.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.3, 2.6) }));
  moon.position.copy(MOON_DIR).multiplyScalar(40);
  sc.add(moon);
  const fire = new THREE.MeshBasicMaterial({ color: col(LIN.acid).multiplyScalar(3) });
  for (const z of [-6, -2, 3, 9]) for (const x of [-2.2, 2.2]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), fire);
    m.position.set(x, 1.1, z); sc.add(m);
  }
  const pm = new THREE.PMREMGenerator(r);
  const tex = pm.fromScene(sc, 0.02).texture;
  pm.dispose();
  return tex;
}

/** Song-time integral of a rate, tabulated at 1 ms (camera travel, the petals' clock): deterministic in t. */
export class Integral {
  private v: Float32Array;
  constructor(private t0: number, t1: number, rate: (t: number) => number, private dt = 0.001) {
    const n = Math.ceil((t1 - t0) / dt) + 2;
    this.v = new Float32Array(n);
    let acc = 0, prev = rate(t0);
    for (let i = 1; i < n; i++) { const r = rate(t0 + i * dt); acc += 0.5 * (prev + r) * dt; prev = r; this.v[i] = acc; }
  }
  at(t: number) {
    const x = clamp((t - this.t0) / this.dt, 0, this.v.length - 1.001), i = Math.floor(x), u = x - i;
    return this.v[i]! * (1 - u) + this.v[i + 1]! * u;
  }
}

export type Phrase = { text: string; t: number; ct: number[] };
/** A line's phrases (split at spaces) with each character's sung time: the line's words (data/lyrics.json, aligned by
 *  analysis/ja_align.py + snap_words.py) spell the line without its spaces; a word's later characters sit on the vocal
 *  onsets inside it (snapped to the 16th grid: VOCALOID), else on an even split. */
export function phraseTimes(l: Line, onsets: number[], snap: (t: number) => number): Phrase[] {
  const times: number[] = [];
  for (const w of l.words) {
    const n = [...w.w].length;
    const inside = onsets.filter((t) => t > w.start + 0.06 && t < w.end - 0.04);
    let prev = w.start;
    for (let j = 0; j < n; j++) {
      const share = w.start + ((w.end - w.start) * j) / n;
      let t = share;
      if (j > 0 && inside.length) {
        const c = inside.filter((x) => x > prev + 0.05).sort((x, y) => Math.abs(x - share) - Math.abs(y - share))[0];
        if (c !== undefined) t = snap(c);
      }
      t = Math.max(t, prev);
      times.push(t); prev = t;
    }
  }
  let i = 0;
  return l.text.split(/\s+/).filter(Boolean).map((text) => {
    const ct = [...text].map(() => times[i++] ?? l.end);
    return { text, t: ct[0]!, ct };
  });
}

const ROTATE = new Set(['ー', '（', '）', '(', ')', '「', '」', '〜', '～', '…', '—']);
const SMALL = new Set([...'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ']);

/** Vertical (tategaki) setting: one glyph per cell, top to bottom; reveal(j) = 0..1 per glyph. */
export function drawColumn(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, reveal: (j: number) => number, stroke = false) {
  c.textAlign = 'center'; c.textBaseline = 'middle';
  let cy = y + size / 2;
  [...s].forEach((ch, j) => {
    const a = reveal(j), latin = /[A-Za-z0-9]/.test(ch);
    const step = latin ? size * 0.78 : size * 1.06;
    if (a > 0) {
      c.save();
      c.globalAlpha = a;
      c.translate(x + (SMALL.has(ch) ? size * 0.12 : 0), cy - (SMALL.has(ch) ? size * 0.12 : 0) - (1 - a) * size * 0.22);
      if (ROTATE.has(ch)) c.rotate(Math.PI / 2);
      if (stroke) c.strokeText(ch, 0, 0);
      c.fillText(ch, 0, 0);
      c.restore();
    }
    cy += step;
  });
}

type Sec = { name: string; start: number; end: number };
/** A chorus with a stop bar (the bass drops out for its first bar) and its title moment. */
type Chorus = {
  tC: number; tFull: number; tFreeze: number; punches: number[]; quiet: boolean;
  spanEnd: number; // the end of this run of chorus sections (chorus3a runs on into chorus3)
  barFull: number; sync: number; kS: number;
  tTitle: number; titleCt: number[]; tBurst: number; titleZ: number;
  title: THREE.Mesh | null; titlePetals: THREE.InstancedMesh | null;
};

export default class Torii extends Scene {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(48, W / H, 0.05, 900);
  g = new GBuf();
  dof = new DofPass();
  vol!: VolLight; // moonbeams through the gates
  volPass = new VolPass();
  volRT = scratchRT();
  text = new Layer2D();
  moon = new THREE.DirectionalLight(0xa9bcff, 1.6);
  gates!: THREE.InstancedMesh;
  stones!: THREE.InstancedMesh;
  fires!: THREE.InstancedMesh;
  fireMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  lights: THREE.PointLight[] = [];
  ground!: THREE.Mesh;
  path!: THREE.Mesh;
  sky!: THREE.Mesh;
  petals!: THREE.InstancedMesh;
  groundPetals!: THREE.InstancedMesh;
  blossoms!: THREE.InstancedMesh;
  canopies!: THREE.InstancedMesh;
  glow!: THREE.Mesh;
  lg!: ReturnType<typeof lanternGeometry>;
  m = new THREE.Matrix4();
  q = new THREE.Quaternion();
  tint = new THREE.Color();
  yAxis = new THREE.Vector3(0, 1, 0);
  v3 = new THREE.Vector3();
  s3 = new THREE.Vector3();
  lookAt = new THREE.Vector3();

  // the song (s), from the analysis
  P = 0.39; // beat period
  sec: Sec[] = [];
  choruses: Chorus[] = [];
  /** Distance flown down the tunnel (m) at song time t: 0 = the great gate, passed as verse 1 begins. */
  travel!: (t: number) => number;
  kEnd = 1e9; // the last gate (the summit)
  petalClock!: Integral;
  kicks: number[] = [];
  lines: { l: Line; ph: Phrase[]; titleOf: Chorus | null }[] = [];
  introPath!: CamPath;
  /** The straight crane moves out of (and back into) the tunnel; the rail stands still mid-gap over ta..tb, while the
   *  camera crosses the beams' height. */
  cranes: { t0: number; up: boolean; y1: number; ta: number; tb: number }[] = [];
  /** Fronts of light running down the line: from d0 (m along it) at v m/s. */
  fronts: { t0: number; d0: number; v: number; life: number; hold: boolean }[] = [];
  frontU = { value: Array.from({ length: 4 }, () => new THREE.Vector2(-1e4, 0)) }; // (d, strength) for the lacquer's glow
  glowAllU = { value: 0 }; // and a glow along the whole line
  tLast = 0; // the last gate is passed
  tCut = 1e9; // the band stops dead: so does the picture
  hits: number[] = []; // the outro's last two hits
  shrineZ = 0;
  outroYaw = 0; // the last crane's turn (0 = facing the summit, π = back down the line)
  hall: { lamps: THREE.MeshBasicMaterial[]; light: THREE.PointLight } | null = null;

  private S(name: string): Sec { return this.sec.find((s) => s.name === name) ?? { name, start: 0, end: 0 }; }
  private secAt(t: number): Sec { return this.sec.find((s) => t >= s.start && t < s.end) ?? this.sec[this.sec.length - 1]!; }
  private bar(k: number) { return this.ctx.audio.timeOfBar(k); }
  private barOf(t: number) { return Math.round(this.ctx.audio.barAt(t)); }
  /** Crane i's lift: 0 on the rail, 1 up; eased over a bar. */
  private craneW(i: number, t: number) {
    const c = this.cranes[i]!, u = ease.inOutCubic(clamp((t - c.t0) / (4 * this.P)));
    return c.up ? u : 1 - u;
  }

  override init() {
    const { audio, lyrics } = this.ctx;
    setupRenderer(this.ctx.renderer);
    const P = this.P = audio.periodAt(60);
    this.sec = audio.sections;
    this.kicks = audio.events('kick', 0, audio.duration + 1).map(([t]) => t);

    // ---- the choruses with a stop bar: the first chorus after each pre-chorus (the bass drops out for its first bar)
    const chs = this.sec.filter((s) => s.name.startsWith('chorus'));
    for (const s of chs) {
      const prev = this.sec[this.sec.indexOf(s) - 1];
      if (!prev || !prev.name.startsWith('pre')) continue;
      const tC = s.start, tFull = this.bar(this.barOf(tC) + 1);
      const bo = audio.ev.in(tC + 0.2, tFull - 0.2, 'bass_out');
      if (!bo.length) continue;
      let spanEnd = s.end;
      for (const n of chs) if (Math.abs(n.start - spanEnd) < 0.05) spanEnd = n.end;
      const tFreeze = bo[bo.length - 1]!.t;
      this.choruses.push({
        tC, tFull, tFreeze, spanEnd, quiet: s.name.endsWith('a'),
        punches: audio.ev.in(tC + 0.1, tFreeze, 'kick', 'sub').map((e) => e.t),
        barFull: audio.barAt(tFull), sync: this.bar(this.barOf(tFull) + 1), kS: 0,
        tTitle: tC, titleCt: [tC], tBurst: tFull, titleZ: 0, title: null, titlePetals: null,
      });
    }
    const peak = this.sec.find((s) => s.name.startsWith('chorus') && !this.choruses.some((c) => c.tC === s.start));

    // ---- the straight crane moves (up out of the tunnel at the interlude and the solo, back down at the interlude's
    // end), each over a bar: the camera crosses the beams' height (1.7–6.5 m) while the rail stands still mid-gap
    const iv = this.S('interlude'), so = this.S('solo'), bu = this.S('build'), bar1 = 4 * P;
    for (const [t0, up, y1] of [[iv.start, true, 7], [iv.end - bar1, false, 7], [so.start, true, 16]] as const) {
      const i = this.cranes.push({ t0, up, y1, ta: 0, tb: 0 }) - 1, c = this.cranes[i]!;
      const band: number[] = [];
      for (let j = 0; j <= 1000; j++) {
        const tj = t0 + (j / 1000) * bar1, y = 1.48 + (y1 - 1.48) * this.craneW(i, tj);
        if (y > 1.6 && y < 6.8) band.push(tj);
      }
      c.ta = band[0]!; c.tb = band[band.length - 1]!;
    }
    const still = (t: number) => this.cranes.reduce((a, c) => a * (1 - smoothstep(c.ta - 0.3, c.ta, t) * (1 - smoothstep(c.tb, c.tb + 0.3, t))), 1);

    // ---- gates per beat along the whole song (never above 1.15 a beat: 154 BPM × 2 = 5 passes / s, a strobe)
    const v1 = this.S('verse1'), intro = this.S('intro'), outro = this.S('outro');
    const tRail = this.bar(this.barOf(v1.start) - 4); // the camera joins the rail 4 bars before verse 1
    const tLast = this.bar(this.barOf(outro.start) + 2); // the last gate (the summit), passed on the outro's third downbeat
    const chAt = (t: number) => this.choruses.find((c) => t >= c.tC && t < c.spanEnd);
    const gRate = (t: number) => {
      const s = this.secAt(t), c = chAt(t);
      if (t < tRail) return 0;
      if (c) {
        if (t < c.tFreeze) return lerp(0.9, 0.15, ease.outCubic(clamp((t - c.tC) / 0.2)));
        if (t < c.tFull - 0.12) return lerp(0.15, 0.03, ease.outCubic(clamp((t - c.tFreeze) / 0.15)));
        const body = c.quiet ? 0.55 : 1;
        const v = lerp(0.03, body, ease.inOutCubic(clamp((t - c.tFull + 0.12) / 0.5)));
        return peak && t >= peak.start ? lerp(v, 1, ease.inOutCubic(clamp((t - peak.start) / 0.5))) : v;
      }
      if (s.name === 'intro') return 0.6;
      if (s.name.startsWith('verse')) return 0.6;
      if (s.name.startsWith('pre')) return lerp(0.6, 0.9, smoothstep(s.start, s.end, t));
      if (s.name === 'interlude') return lerp(1, 0.6, smoothstep(s.end - 4 * P, s.end, t)); // ticking past below the camera, a gate a beat
      if (s.name === 'solo') return lerp(1, 0.45, ease.inOutCubic(clamp((t - s.start) / (4 * P))));
      if (s.name === 'build') return lerp(0.45, 0.6, smoothstep(s.end - 4 * P, s.end, t));
      // through the last gate, slowing into the summit's plaza, still from bar 147 (the crane takes over)
      if (s.name === 'outro' || s.name === 'end')
        return t < tLast ? 1 : lerp(lerp(1, 0.22, ease.outCubic(clamp((t - tLast) / (2 * bar1)))), 0, smoothstep(this.bar(145.5), this.bar(147), t));
      return 0.6;
    };
    const g = (t: number) => gRate(t) * still(t);
    const T1 = audio.duration + 2;
    const raw = new Integral(0, T1, (t) => (GAP / P) * g(t));
    // the great gate (travel 0) is passed exactly as verse 1 begins
    const off = -raw.at(v1.start);
    // phase locks, in song order: after each full surge a gate passes the camera on every beat (the error is taken up in
    // the stop bar); each crane stands mid-gap (the next gate 1.1 m ahead); the last gate is passed on its downbeat
    const fixes: [number, number, number][] = [];
    const base = (t: number) => raw.at(t) + off + fixes.reduce((a, [f, a0, a1]) => a + f * smoothstep(a0, a1, t), 0);
    const lock = (x: number) => { const e = ((x % GAP) + GAP) % GAP; return e > GAP / 2 ? GAP - e : -e; };
    const locks: [number, () => void][] = [];
    for (const c of this.choruses) if (!c.quiet) locks.push([c.tC, () => fixes.push([lock(base(c.sync)), c.tC + 0.25, c.tFull - 0.15])]);
    for (const c of this.cranes) locks.push([c.ta, () => fixes.push([lock(base(c.ta) - GAP / 2), c.ta - 0.9, c.ta - 0.05])]);
    locks.push([tLast, () => fixes.push([lock(base(tLast)), tLast - 2 * bar1, tLast - 0.1])]);
    for (const [, f] of locks.sort((a, b) => a[0] - b[0])) f();
    this.travel = base;
    for (const c of this.choruses) c.kS = Math.round(this.travel(c.sync) / GAP);
    this.tLast = tLast;
    this.kEnd = Math.round(this.travel(tLast) / GAP);
    void intro;

    // ---- the petals' clock: drifting; held in each stop bar; a storm in the choruses (slow in the quiet one)
    this.petalClock = new Integral(0, T1, (t) => {
      const c = chAt(t);
      if (c) {
        if (t < c.tFreeze) return lerp(1, 0.6, smoothstep(c.tC, c.tC + 0.2, t));
        if (t < c.tFull - 0.05) return lerp(0.6, 0.04, smoothstep(c.tFreeze, c.tFreeze + 0.12, t));
        const body = c.quiet ? 0.45 : 1.8;
        const v = lerp(0.04, body, smoothstep(c.tFull - 0.05, c.tFull + 0.3, t));
        return peak && t >= peak.start ? lerp(v, 2.3, smoothstep(peak.start, peak.start + 0.4, t)) : v;
      }
      const last = this.choruses.filter((x) => x.spanEnd <= t).pop();
      return last ? lerp(1.8, 1, smoothstep(last.spanEnd, last.spanEnd + 8 * P, t)) : 1;
    });

    // ---- the lyrics; each stop chorus's title is the first phrase of the line sung in its stop bar
    const vOn = audio.events('vocal', 0, audio.duration + 1).map(([t]) => t);
    const g0 = audio.beats[0]!, q16 = P / 4, snap16 = (t: number) => g0 + Math.round((t - g0) / q16) * q16;
    for (const l of lyrics.lines) {
      const c = this.choruses.find((x) => l.start >= x.tC - 0.2 && l.start < x.tFull - 0.1 && !this.lines.some((y) => y.titleOf === x)) ?? null;
      this.lines.push({ l, ph: phraseTimes(l, vOn, snap16), titleOf: c });
    }
    const titleOf = (c: Chorus) => this.lines.find((x) => x.titleOf === c);
    for (const c of this.choruses) {
      const tl = titleOf(c);
      if (tl) { c.tTitle = tl.ph[0]!.t; c.titleCt = tl.ph[0]!.ct; }
    }
    // the same title phrase lands the same way in every chorus: the first chorus's glyph timing, its second glyph on the
    // vocal's jump 0.12 s after the first (review R4: it came 0.20 / 0.42 / 0.39 s after)
    const ref = this.choruses.find((c) => titleOf(c));
    if (ref) {
      const rel = ref.titleCt.map((x) => x - ref.tTitle);
      if (rel.length > 1) rel[1] = Math.min(0.12, rel[2] ?? 0.12);
      for (const c of this.choruses) if (titleOf(c)?.ph[0]!.text === titleOf(ref)!.ph[0]!.text) c.titleCt = rel.map((x) => c.tTitle + x);
    }
    // each title bursts on the first beat at least 0.35 s after its last glyph is sung, never before the band
    for (const c of this.choruses) {
      if (titleOf(c)) c.tBurst = audio.timeOfBeat(Math.ceil(audio.beatAt(Math.max(c.tFull, c.titleCt[c.titleCt.length - 1]! + 0.35)) - 1e-6));
    }

    // ---- the intro: black until the band's first hit (bar 1), a dive from 34 m to the treetops by bar 4, skimming them
    // (camera() weaves and banks) and down to the great gate, onto the rail 4 bars before verse 1
    const zRail = -this.travel(tRail);
    this.introPath = new CamPath([
      { t: this.bar(1), p: [-26, 34, zRail + 260], at: [-6, 6, zRail + 150], fov: 40 },
      { t: this.bar(2.5), p: [-12, 15, zRail + 236], at: [0, 4, zRail + 140], fov: 42 },
      { t: this.bar(4), p: [-4, 11, zRail + 215], at: [0, 4, zRail + 150], fov: 44 },
      { t: this.bar(8), p: [0, 11, zRail + 150], at: [0, 4, zRail + 85], fov: 44 },
      { t: this.bar(12), p: [0, 10, zRail + 80], at: [0, 4.5, zRail + 20], fov: 45 },
      { t: this.bar(14), p: [0, 5.5, zRail + 38], at: [0, 6, zRail - 12], fov: 46 },
      { t: this.bar(16), p: [0, 1.9, zRail + 6], at: [0, 3, zRail - 16], fov: 47 },
      { t: tRail, p: [0, 1.48, zRail], at: [0, 1.58, zRail - 10], fov: 48 },
    ]);

    // ---- fronts of light down the line: one each bar of the solo and the build, racing away at a gate per 16th; one on
    // the peak chorus's downbeat that lights every lantern ahead within a bar
    for (let b = this.barOf(so.start); b < this.barOf(bu.end); b++) {
      const t0 = this.bar(b);
      this.fronts.push({ t0, d0: this.travel(t0) - 4, v: GAP / (P / 4), life: 4 * bar1, hold: false });
    }
    if (peak) this.fronts.push({ t0: peak.start, d0: this.travel(peak.start), v: 110, life: peak.end - peak.start, hold: true });
    // the end: the outro's last two hits (the first, the strongest), then the band stops dead (its last bass-out)
    const lastBar = this.barOf(outro.end) - 1;
    this.tCut = audio.ev.in(this.bar(lastBar), audio.duration, 'bass_out').pop()?.t ?? audio.duration;
    const hs = audio.ev.in(this.bar(lastBar) - 0.05, this.tCut - 0.1, 'kick', 'snare');
    if (hs.length) this.hits = [...new Set([hs[0]!, hs.reduce((a, e) => (e.s > a.s ? e : a))].map((e) => e.t))];

    // ---- world
    // ---- world
    // ---- world
    const night = col(LIN.ink), horizon = col(LIN.ink2);
    this.scene.background = night;
    this.scene.fog = new THREE.FogExp2(horizon.clone().lerp(night, 0.35), 0.03);
    this.scene.add(new THREE.HemisphereLight(0x29324f, 0x0b0806, 0.35));
    this.scene.environment = nightEnvironment(this.ctx.renderer);
    this.scene.environmentIntensity = 0.25;
    // moonbeams: the moon's light fills the haze, the gates' depth map from the moon cuts it into shafts
    this.vol = new VolLight(new THREE.OrthographicCamera(-12, 12, 26, -26, 1, 95), 1024);
    this.vol.color.setRGB(0.6, 0.68, 1.1);
    Object.assign(this.vol, { density: 0.022, noise: 0.7, noiseScale: 0.35, edge: 0.04, g: 0.68, boxSoft: 0.5 });
    this.vol.box = new THREE.Box3(); // inside the tunnel only: the open night beside it stays dark (review R3)
    this.volPass.steps = 64;
    const moon = this.moon;
    moon.castShadow = true;
    moon.shadow.mapSize.set(4096, 4096);
    Object.assign(moon.shadow.camera, { left: -11, right: 11, top: 24, bottom: -24, near: 1, far: 90 });
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03;
    this.scene.add(moon, moon.target);

    const GW = 256, GH = 512, gh = new Float32Array(GW * GH), gr = mulberry32(17);
    const grainSeed = gr() * 100;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const u = x / GW, v = y / GH;
      const warp = fbm2(u * 3, v * 0.6, 3, grainSeed) * 2.5;
      gh[y * GW + x] = 0.5 + 0.5 * Math.sin((u * 11 + warp * 1.6 + fbm2(u * 30, v * 1.5, 2, grainSeed + 9)) * Math.PI * 2) * (0.5 + 0.5 * fbm2(u * 9, v * 2, 2, grainSeed + 5));
    }
    const grainMap = canvasTex(GW, GH, (c, w, h) => {
      const img = c.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const k = 228 + 22 * gh[i]! - 16 * Math.max(0, fbm2((i % w) / w * 4, Math.floor(i / w) / h * 12, 3, 9)); // grain + wear
        img.data.set([k, k * 0.97, k * 0.95, 255], i * 4);
      }
      c.putImageData(img, 0, 0);
    }, { repeat: [1, 1] });
    const lacquer = new THREE.MeshPhysicalMaterial({
      vertexColors: true, map: grainMap, normalMap: normalMap(gh, GW, GH, 1.6, [1, 1]), normalScale: new THREE.Vector2(0.14, 0.14),
      roughness: 0.6, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3,
    });
    // where a front of light passes, the vermilion glows (the black parts stay black): world z against uFront
    lacquer.onBeforeCompile = (sh) => {
      sh.uniforms.uFront = this.frontU;
      sh.uniforms.uGlowAll = this.glowAllU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWZ;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vWZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).z;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWZ;\nuniform vec2 uFront[4];\nuniform float uGlowAll;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  for (int i = 0; i < 4; i++) { float e = (-vWZ - uFront[i].x) / 3.5; totalEmissiveRadiance += vColor.rgb * uFront[i].y * 1.4 * exp(-e * e); }
  totalEmissiveRadiance += vColor.rgb * uGlowAll;`);
    };
    this.gates = new THREE.InstancedMesh(toriiGeometry(), lacquer, NG_AIR);
    this.gates.castShadow = this.gates.receiveShadow = true;
    this.gates.frustumCulled = false;
    this.scene.add(this.gates);

    const lg = this.lg = lanternGeometry();
    this.stones = new THREE.InstancedMesh(lg.stone, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), NL_AIR * 2);
    this.stones.castShadow = this.stones.receiveShadow = true;
    this.fires = new THREE.InstancedMesh(lg.fire, this.fireMat, NL_AIR * 2);
    for (const m of [this.stones, this.fires]) { m.frustumCulled = false; this.scene.add(m); }
    for (let i = 0; i < 6; i++) {
      const L = new THREE.PointLight(0xffa860, 0, 16, 2);
      this.lights.push(L); this.scene.add(L);
    }

    // gravel everywhere (a 4 m tile) and the stone path between the pillars (a 5 m tile, rows that close on
    // themselves); both world-locked: the meshes snap by whole tiles as the camera flies
    const gravel = canvasTex(1024, 1024, (c, w, h, rnd) => {
      c.fillStyle = '#0b0a0a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 70000; i++) {
        const v = 8 + rnd() * 18; c.fillStyle = `rgb(${v},${v * 0.97},${v * 0.93})`;
        c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
      }
    }, { repeat: [600, 600], seed: 12 });
    const gm = new THREE.MeshStandardMaterial({ map: gravel, roughness: 0.95 });
    // from the air the gravel tile alone is a flat grey sheet (review R4): moss, bare patches and drifts of fallen
    // petals over it, in world space (the mesh snaps with the camera); the tunnel's own ground stays plain gravel
    gm.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGW;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vGW = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vGW;
float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
  float n1 = 0.6 * gn(vGW * 0.035) + 0.4 * gn(vGW * 0.13), n2 = 0.7 * gn(vGW * 0.05 + 17.0) + 0.3 * gn(vGW * 0.3 + 5.0);
  float off = smoothstep(4.0, 9.0, abs(vGW.x));
  diffuseColor.rgb *= mix(0.6, 1.6, n1);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.022, 0.012), smoothstep(0.5, 0.72, n1) * 0.8 * off);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.07, 0.09), smoothstep(0.6, 0.82, n2) * 0.6 * off);`);
    };
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), gm);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    // the stone path: one piece from before the great gate to the summit's steps (from the air it ends there)
    const shrineZ = this.shrineZ = -this.travel(audio.duration) - 26, pathLen = 26 - (shrineZ + 9);
    const SH = new Float32Array(512 * 1024);
    const stones = canvasTex(512, 1024, (c, w, h, rnd) => {
      c.fillStyle = '#0c0b0a'; c.fillRect(0, 0, w, h);
      const rows: number[] = [];
      while (rows.reduce((a, b) => a + b, 0) < h - 120) rows.push(70 + rnd() * 50);
      const k = h / rows.reduce((a, b) => a + b, 0);
      let y = 0;
      for (const r of rows) {
        const rh = r * k;
        let x = 6;
        while (x < w - 10) {
          const sw = Math.min(w - 6 - x, 80 + rnd() * 110);
          const v = 50 + rnd() * 32;
          c.fillStyle = `rgb(${v},${v * 0.96},${v * 0.9})`;
          c.fillRect(x + 2, y + 2, sw - 4, rh - 4);
          // height: slab tops at 1 with rounded edges falling into the grooves, a little unevenness per slab
          const top = 0.85 + 0.15 * rnd();
          for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(h, Math.ceil(y + rh)); yy++)
            for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(w, Math.ceil(x + sw)); xx++) {
              const e = Math.min(xx - x, x + sw - xx, yy - y, y + rh - yy);
              SH[yy * w + xx] = top * smoothstep(1, 9, e);
            }
          for (let j = 0; j < 30; j++) { const u = 28 + rnd() * 40; c.fillStyle = `rgba(${u},${u},${u * 0.95},0.35)`; c.fillRect(x + 2 + rnd() * (sw - 8), y + 2 + rnd() * (rh - 8), 2 + rnd() * 8, 2 + rnd() * 5); }
          x += sw;
        }
        y += rh;
      }
    }, { repeat: [1, pathLen / 5], seed: 11 });
    stones.wrapS = THREE.ClampToEdgeWrapping;
    const stoneN = normalMap(SH, 512, 1024, 1.0, [1, pathLen / 5]);
    stoneN.wrapS = THREE.ClampToEdgeWrapping;
    this.path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, pathLen), new THREE.MeshStandardMaterial({
      map: stones, normalMap: stoneN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.74 })); // matte bevels: dark seams, not lit tile lines
    this.path.rotation.x = -Math.PI / 2;
    this.path.position.set(0, 0.004, 26 - pathLen / 2);
    this.path.receiveShadow = true;
    this.scene.add(this.ground, this.path);

    // the sky: night gradient, stars, the moon and its halo (follows the camera, no fog)
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uMoon: { value: MOON_VIEW.clone() }, uMoonVis: { value: 0 }, uFlare: { value: 0 } },
      vertexShader: /* glsl */ `out vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `layout(location = 0) out highp vec4 outColor;
` + GLSL_COMMON + /* glsl */ `
        in vec3 vDir; uniform vec3 uMoon; uniform float uMoonVis, uFlare;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 fogc = mix(C_INK2, C_INK, 0.35);
          vec3 c = mix(fogc, C_INK * 0.55, smoothstep(-0.05, 0.6, h)); // the horizon = the fog colour: no bright window at the vanishing point
          vec2 sp = vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0))) * 160.0;
          vec2 cell = floor(sp);
          float r = hash12(cell);
          if (r > 0.982) {
            vec2 o = hash22(cell + 7.0) - 0.5;
            float s = smoothstep(0.16, 0.0, length(fract(sp) - 0.5 - o * 0.6));
            c += vec3(0.55, 0.6, 0.8) * s * (r - 0.982) / 0.018 * smoothstep(0.04, 0.35, h) * 0.9;
          }
          // the moon never dims (review R4: a dead grey disc): as the camera sinks below the treetops it sets behind the hills
          float sink = 1.0 - uMoonVis;
          vec3 mo = normalize(vec3(uMoon.x, uMoon.y - 0.2 * sink, uMoon.z));
          float md = acos(clamp(dot(d, mo), -1.0, 1.0));
          float R = 0.06;
          c += vec3(0.34, 0.37, 0.5) * (exp(-md * 7.0) * 0.3 + exp(-md * 30.0) * 0.9) * (1.0 + 1.5 * uFlare);
          vec2 mp = vec2(dot(d, normalize(cross(mo, vec3(0, 1, 0)))), d.y - mo.y) / R;
          float maria = 0.86 + 0.14 * smoothstep(-0.3, 0.6, fbm(mp * 1.7 + 3.0, 4));
          c = mix(c, vec3(1.0, 0.96, 0.88) * 2.2 * maria * (1.0 + 0.5 * uFlare), smoothstep(R, R * 0.985, md));
          // far hills in three ranges, the nearer darker and higher: the forest recedes in layers (low down, in the
          // tunnel, they all go to the fog colour)
          float ang = atan(d.x, d.z);
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float ridge = 0.018 + 0.022 * fi + 0.03 * sink + (0.024 + 0.014 * fi) * fbm(vec2(ang * (2.2 + 1.4 * fi) + fi * 7.1, 1.7 + fi), 4)
                        + 0.008 * fbm(vec2(ang * (11.0 + 5.0 * fi), 5.0 + fi), 3);
            vec3 lc = mix(fogc, C_INK * 0.4, (0.3 + 0.35 * fi) * (1.0 - sink) * smoothstep(-0.01, ridge, h)); // their feet in the haze
            c = mix(c, lc, smoothstep(ridge + 0.003, ridge - 0.003, h));
          }
          outColor = vec4(c, 1.0);
        }`,
    }));
    this.sky.renderOrder = -1;
    this.sky.layers.set(2);
    this.scene.add(this.sky);

    // a warm light deep in the tunnel (70 m on): where the flight is going, the frame's focal point
    const gt = canvasTex(256, 256, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: gt, color: col(LIN.acid).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.glow.scale.setScalar(2.4); // inside the far openings (2.7 × 2.6 m), so the gates do not crop it square
    this.glow.layers.set(2);
    this.scene.add(this.glow);

    this.petals = this.makePetals();
    this.groundPetals = this.makeGroundPetals();
    this.groundPetals.layers.set(2);
    this.scene.add(this.groundPetals);
    this.blossoms = this.makeBlossoms();
    this.petals.layers.set(2); this.blossoms.layers.set(2);
    this.cam.layers.enable(2);
    this.scene.add(this.petals, this.blossoms);
    this.canopies = this.makeCanopies();
    this.canopies.layers.set(2);
    this.scene.add(this.canopies);

    for (const c of this.choruses) this.makeTitle(c);

    // the great gate's plaque (扁額): black lacquer, the song's title in gold, facing the approach
    const pq = canvasTex(256 * SCALE, 512 * SCALE, (c, w, h) => {
      c.fillStyle = '#0d0a0a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#b8862e'; c.lineWidth = 10 * SCALE; c.strokeRect(14 * SCALE, 14 * SCALE, w - 28 * SCALE, h - 28 * SCALE);
      c.fillStyle = '#f0c46a'; c.font = `${120 * SCALE}px "NotoSerifSC-900"`;
      drawColumn(c, '千本桜', w / 2, 52 * SCALE, 128 * SCALE, () => 1);
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9), new THREE.MeshStandardMaterial({
      map: pq, emissiveMap: pq, emissive: new THREE.Color(1.6, 1.1, 0.5), roughness: 0.5 }));
    plaque.position.set(0, 7.2, 0.4);
    this.scene.add(plaque);

    // the entrance: two stone lanterns before the great gate and a warm light on it, so it glows red on the approach
    for (const x of [-4.6, 4.6]) {
      const st = new THREE.Mesh(lg.stone, this.stones.material as THREE.Material); st.scale.setScalar(1.6); st.position.set(x, 0, 3.2);
      const fi = new THREE.Mesh(lg.fire, this.fireMat); fi.scale.setScalar(1.6); fi.position.set(x, 0, 3.2);
      st.castShadow = true; this.scene.add(st, fi);
    }
    const gl = new THREE.PointLight(0xffa860, 40, 26, 2); gl.position.set(0, 3.2, 6); this.scene.add(gl);

    this.buildShrine(shrineZ);
    (this.canopies.material as THREE.ShaderMaterial).uniforms.uShrineZ!.value = shrineZ;
    (this.blossoms.material as THREE.ShaderMaterial).uniforms.uShrineZ!.value = shrineZ;
  }

  /** The title of one stop chorus: its first phrase, set vertically, standing in the tunnel between two gates; it
   *  bursts into petals sampled from its own glyphs (千本桜: it becomes the blossom). */
  private makeTitle(ch: Chorus) {
    const tl = this.lines.find((x) => x.titleOf === ch);
    if (!tl) return;
    const P = this.P;
    const s = tl.ph[0]!.text, n = [...s].length, px = 380;
    const cv = document.createElement('canvas');
    cv.width = Math.round(px * 1.1 * SCALE); cv.height = Math.round(px * (n * 1.04 + 0.2) * SCALE);
    const c = cv.getContext('2d', { willReadFrequently: true })!;
    c.scale(SCALE, SCALE);
    c.fillStyle = '#fff'; c.font = `${px}px "NotoSerifSC-900"`;
    drawColumn(c, s, (px * 1.1) / 2, px * 0.1, px, () => 1);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const hgt = 2.2, wid = (hgt * cv.width) / cv.height;
      ch.title = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt), new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
        uniforms: { uMap: { value: t }, uGlow: { value: 1 }, uAge: { value: [-1, -1, -1, -1, -1, -1, -1, -1] },
          uY0: { value: (px * 0.1) / (cv.height / SCALE) }, uStep: { value: (px * 1.06) / (cv.height / SCALE) }, uN: { value: Math.min(8, n) } },
        vertexShader: /* glsl */ `out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `layout(location = 0) out highp vec4 outColor;
` + GLSL_COMMON + /* glsl */ `
          in vec2 vUv; uniform sampler2D uMap; uniform float uGlow, uY0, uStep; uniform float uAge[8]; uniform int uN;
          void main() {
            vec4 m = texture(uMap, vUv);
            int j = int(clamp(floor((1.0 - vUv.y - uY0) / uStep), 0.0, float(uN - 1)));
            float age = uAge[j];
            if (m.a < 0.5 || age < 0.0) discard;
            float pop = exp(-age / 0.09);
            outColor = vec4(vec3(m.r) * uGlow * (1.0 + 1.0 * pop) + C_SIGNAL * 4.0 * exp(-age / 0.35), 1.0);
          }`,
      }));
      // between two gates ~6–8 m ahead (the camera, surging, must not reach it before the burst) of where the camera brakes, top under the nuki (2.75 m): no beam crosses it;
      // its middle at eye height
      const zc = -this.travel(ch.tTitle);
      ch.titleZ = (Math.floor((zc - 5.4) / GAP) + 0.5) * GAP;
      ch.title.position.set(0, 1.5, ch.titleZ);
      ch.title.layers.set(2);
      this.scene.add(ch.title);

      // the petals: NTP points on the glyphs' fill, each flying out and toward the lens with drag (k = 1.8 / s); the mean
      // speed toward the lens is solved so the densest layer reaches the camera one beat after the surge
      const DRAG = 1.8, zBeat = -this.travel(ch.tBurst + P);
      const vz = ((zBeat - ch.titleZ) * DRAG) / (1 - Math.exp(-DRAG * P));
      const img = c.getImageData(0, 0, cv.width, cv.height).data, r = mulberry32(31);
      const o = new Float32Array(NTP * 3), v = new Float32Array(NTP * 4);
      for (let i = 0, tries = 0; i < NTP && tries < 2e6; tries++) {
        const x = Math.floor(r() * cv.width), y = Math.floor(r() * cv.height);
        if (img[(y * cv.width + x) * 4 + 3]! < 160) continue;
        const lx = (x / cv.width - 0.5) * wid, ly = (0.5 - y / cv.height) * hgt;
        o.set([lx, 1.5 + ly, ch.titleZ], i * 3);
        const out = (2.5 + 2.8 * r()) * (ch.quiet ? 0.3 : 1), len = Math.hypot(lx, ly * 0.6) + 0.05;
        v.set([(lx / len) * out + (r() - 0.5) * 1.2, ((ly * 0.6) / len) * out + (ch.quiet ? 1.6 : 0.3) + (r() - 0.5) * 1.0, (ch.quiet ? 0.5 : vz) * (0.75 + 0.5 * r()), r()], i * 4);
        i++;
      }
      const geo = new THREE.PlaneGeometry(1, 1, 2, 2);
      geo.setAttribute('aO', new THREE.InstancedBufferAttribute(o, 3));
      geo.setAttribute('aV', new THREE.InstancedBufferAttribute(v, 4));
      ch.titlePetals = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
        uniforms: { uU: { value: -1 }, uFog: { value: new THREE.Color() }, uFogD: { value: 0.03 }, uMoon: { value: MOON_DIR },
          uLift: { value: ch.quiet ? 0.6 * Math.max(0, ch.tBurst - ch.tTitle) : 0 }, uGrav: { value: ch.quiet ? 0.03 : 0.18 } },
        vertexShader: /* glsl */ `
          in vec3 aO; in vec4 aV; uniform float uU, uLift, uGrav; out vec2 vUv; out float vD; out float vAge; out vec3 vN;
          mat3 rx(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
          mat3 ry(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
          void main() {
            float u = max(uU, 0.0), k = 1.8, ph = aV.w * 6.2832;
            vec3 p = aO + vec3(0.0, uLift, 0.0) + aV.xyz * (1.0 - exp(-k * u)) / k - vec3(0.0, uGrav, 0.0) * u * u;
            p.x += 0.15 * sin(u * 3.0 + ph) * u; p.y += 0.12 * sin(u * 2.3 + ph * 1.7) * u;
            float sz = uU < 0.0 ? 0.0 : 0.05 * (0.5 + 1.5 * fract(aV.w * 7.0)) * (1.0 - smoothstep(3.0, 4.0, u));
            float spin = smoothstep(0.0, 0.06, u);  // the glyph holds its shape for a frame, then the petals flip
            mat3 R = rx(spin * (u * (3.0 + 4.0 * aV.w) + ph)) * ry(spin * (u * (2.0 + 3.0 * fract(aV.w * 3.0)) + ph * 2.0));
            vec3 lp = position; lp.z += 0.22 * lp.x * lp.x;
            vec4 mv = viewMatrix * vec4(p + R * (lp * vec3(0.8, 1.0, 1.0) * sz), 1.0);
            vUv = uv; vD = -mv.z; vAge = u; vN = R * vec3(0, 0, 1);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `layout(location = 0) out highp vec4 outColor;
` + GLSL_COMMON + /* glsl */ `
          in vec2 vUv; in float vD; in float vAge; in vec3 vN; uniform vec3 uFog; uniform float uFogD; uniform vec3 uMoon;
          void main() {
            vec2 q = vUv * 2.0 - 1.0;
            float w = 0.62 * (0.3 + 0.7 * smoothstep(-1.0, 0.1, q.y));
            if ((q.x * q.x) / (w * w) + q.y * q.y > 1.0) discard;
            if (q.y > 0.74 && abs(q.x) < (q.y - 0.74) * 0.6) discard;
            vec3 pink = mix(toLinear(vec3(1.0, 0.93, 0.95)), C_EMBER, smoothstep(-0.7, 0.9, q.y));
            // a light hit from the title on the downbeat (×3.2, 2–3 frames), pink within 0.15 s, flipping in the moonlight
            float sh = 0.45 + 0.75 * abs(dot(normalize(vN), uMoon));
            vec3 c = mix(C_BONE * 3.2, pink * 0.85 * sh, smoothstep(0.0, 0.15, vAge));
            c = mix(c, uFog, 1.0 - exp(-pow(uFogD * vD, 2.0)));
            outColor = vec4(c, 1.0);
          }`,
      }), NTP);
      ch.titlePetals.frustumCulled = false;
      ch.titlePetals.layers.set(2);
      this.scene.add(ch.titlePetals);
  }

  private makePetals() {
    const geo = new THREE.PlaneGeometry(1, 1, 2, 2);
    const r = mulberry32(5), a = new Float32Array(NPET * 4), b = new Float32Array(NPET * 4);
    for (let i = 0; i < NPET * 4; i++) { a[i] = r(); b[i] = r(); }
    geo.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4));
    geo.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 4));
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
      uniforms: {
        uT: { value: 0 }, uCamZ: { value: 0 }, uBurst: { value: 0 }, uDensity: { value: 1 },
        uLP: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) }, uLW: { value: new Array(6).fill(0) },
        uMoon: { value: MOON_DIR }, uFog: { value: new THREE.Color() }, uFogD: { value: 0.03 },
      },
      vertexShader: /* glsl */ `
        in vec4 aA; in vec4 aB;
        uniform float uT, uCamZ, uBurst, uDensity;
        out vec2 vUv; out vec3 vN; out vec3 vW; out float vD;
        mat3 rx(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
        mat3 ry(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
        void main() {
          float T = uT * (0.65 + 0.7 * aA.w);
          vec3 p = vec3((aA.x * 2.0 - 1.0) * 5.5, 0.15 + aA.y * 5.2, -aA.z * 44.0);
          p += vec3(0.3, -0.5, 0.85) * T;
          float ph = aB.x * 6.2832;
          p.x += 0.4 * sin(uT * (0.9 + aB.y) + ph);
          p.y += 0.3 * sin(uT * (0.7 + aB.z) + ph * 1.7);
          vec2 rd = normalize(vec2(aB.y - 0.5, aB.z - 0.5) + 1e-3);
          p.xy += rd * uBurst * (0.4 + aA.w);
          // wrapped in a box around the camera, world-locked: the camera flies through them, up in the air too
          float bx = cameraPosition.x, by = max(0.0, cameraPosition.y - 1.48);
          p.x = bx - 5.5 + mod(p.x - bx + 5.5, 11.0);
          p.y = by + 0.15 + mod(p.y - by - 0.15, 5.2);
          p.z = uCamZ + 3.0 - mod(uCamZ + 3.0 - p.z, 44.0);
          float edge = smoothstep(0.15, 0.6, p.y - by) * smoothstep(5.35, 4.8, p.y - by) * smoothstep(5.5, 4.9, abs(p.x - bx))
                     * smoothstep(uCamZ - 41.0, uCamZ - 36.0, p.z);
          float sz = 0.06 * (0.75 + 0.6 * aB.x) * edge * smoothstep(aB.w, aB.w + 0.08, uDensity);
          mat3 R = rx(uT * (1.2 + 2.2 * aB.w) + ph) * ry(uT * (0.9 + 1.6 * aB.y) + ph * 2.3);
          vec3 lp = position; lp.z += 0.22 * lp.x * lp.x;
          vec3 w = p + R * (lp * vec3(0.8, 1.0, 1.0) * sz);
          vN = R * vec3(0, 0, 1); vW = w; vUv = uv;
          vec4 mv = viewMatrix * vec4(w, 1.0);
          vD = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `layout(location = 0) out highp vec4 outColor;
` + GLSL_COMMON + /* glsl */ `
        in vec2 vUv; in vec3 vN; in vec3 vW; in float vD;
        uniform vec3 uLP[6]; uniform float uLW[6]; uniform vec3 uMoon; uniform vec3 uFog; uniform float uFogD;
        void main() {
          vec2 q = vUv * 2.0 - 1.0;
          float w = 0.62 * (0.3 + 0.7 * smoothstep(-1.0, 0.1, q.y));
          if ((q.x * q.x) / (w * w) + q.y * q.y > 1.0) discard;
          if (q.y > 0.74 && abs(q.x) < (q.y - 0.74) * 0.6) discard;
          vec3 base = mix(toLinear(vec3(1.0, 0.93, 0.95)), toLinear(vec3(0.97, 0.62, 0.74)), smoothstep(-0.7, 0.9, q.y));
          vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
          float moon = 0.18 + 0.55 * max(dot(n, uMoon), 0.0) + 0.25 * max(dot(-n, uMoon), 0.0);
          vec3 warm = vec3(0.0);
          for (int i = 0; i < 6; i++) { float d = length(uLP[i] - vW); warm += uLW[i] * vec3(1.0, 0.62, 0.32) * 2.2 / (1.0 + d * d); }
          vec3 c = base * (vec3(0.42, 0.47, 0.68) * moon + warm + 0.06);
          c = mix(c, uFog, 1.0 - exp(-pow(uFogD * vD, 2.0)));
          outColor = vec4(c, 1.0);
        }`,
    });
    const m = new THREE.InstancedMesh(geo, mat, NPET);
    m.frustumCulled = false;
    return m;
  }

  /** Fallen petals on the path and the gravel beside it: drifts against the pillar bases and along the path edges. */
  private makeGroundPetals() {
    const N = 7000, geo = new THREE.PlaneGeometry(1, 1);
    const r = mulberry32(23), a = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const k = r(), side = r() < 0.5 ? -1 : 1;
      const x = k < 0.35 ? side * (1.35 + (r() - 0.5) * 0.8) : k < 0.6 ? side * (1.12 + r() * 0.3) : (r() * 2 - 1) * 3.6;
      a.set([x, r() * 44, r(), r()], i * 4);
    }
    geo.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4));
    const pu = (this.petals.material as THREE.ShaderMaterial).uniforms;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
      uniforms: { uCamZ: { value: 0 }, uLP: pu.uLP!, uLW: pu.uLW!, uMoon: pu.uMoon!, uFog: pu.uFog!, uFogD: pu.uFogD! },
      vertexShader: /* glsl */ `
        in vec4 aA; uniform float uCamZ; out vec2 vUv; out vec3 vW; out float vD;
        void main() {
          float z = uCamZ + 3.0 - mod(uCamZ + 3.0 + aA.y * 44.0, 44.0);
          float an = aA.z * 6.2832, c = cos(an), s = sin(an);
          float sz = 0.05 * (0.6 + 0.8 * aA.w) * smoothstep(uCamZ - 41.0, uCamZ - 36.0, z);
          vec2 q = position.xy * vec2(0.8, 1.0) * sz;
          vec3 w = vec3(aA.x + c * q.x - s * q.y, 0.008 + 0.004 * aA.w, z + s * q.x + c * q.y);
          vUv = uv; vW = w;
          vec4 mv = viewMatrix * vec4(w, 1.0); vD = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `layout(location = 0) out highp vec4 outColor;
` + GLSL_COMMON + /* glsl */ `
        in vec2 vUv; in vec3 vW; in float vD;
        uniform vec3 uLP[6]; uniform float uLW[6]; uniform vec3 uMoon; uniform vec3 uFog; uniform float uFogD;
        void main() {
          vec2 q = vUv * 2.0 - 1.0;
          float w = 0.62 * (0.3 + 0.7 * smoothstep(-1.0, 0.1, q.y));
          if ((q.x * q.x) / (w * w) + q.y * q.y > 1.0) discard;
          if (q.y > 0.74 && abs(q.x) < (q.y - 0.74) * 0.6) discard;
          vec3 base = mix(toLinear(vec3(0.95, 0.86, 0.88)), toLinear(vec3(0.86, 0.55, 0.65)), smoothstep(-0.7, 0.9, q.y));
          vec3 warm = vec3(0.0);
          for (int i = 0; i < 6; i++) { float d = length(uLP[i] - vW); warm += uLW[i] * vec3(1.0, 0.62, 0.32) * 2.0 / (1.0 + d * d); }
          vec3 c = base * (vec3(0.3, 0.34, 0.5) * 0.18 + warm + 0.035); // lying in the gates' shadows: mostly lantern-lit
          c = mix(c, uFog, 1.0 - exp(-pow(uFogD * vD, 2.0)));
          outColor = vec4(c, 1.0);
        }`,
    });
    const m = new THREE.InstancedMesh(geo, mat, N);
    m.frustumCulled = false;
    return m;
  }

  /** Lit-up cherry trees behind the gates: upright billboards (3 drawn variants: trunk, branches, blossom clusters at
   *  the twigs), standing on the ground, glowing pink from below. */
  private makeBlossoms() {
    const V = 3, S = 1024;
    const tex = canvasTex(S * V, S, (c, w, h, rnd) => {
      c.clearRect(0, 0, w, h);
      for (let v = 0; v < V; v++) {
        const tips: [number, number, number][] = [];
        const cx0 = S * v;
        const inside = (x: number, y: number, m: number) => x > cx0 + m && x < cx0 + S - m && y > m;
        const branch = (x: number, y: number, a: number, len: number, wd: number, d: number) => {
          let x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
          if (!inside(x1, y1, 110)) { len *= 0.5; x1 = x + Math.cos(a) * len; y1 = y + Math.sin(a) * len; d = 0; }
          if (!inside(x1, y1, 90)) return;
          c.strokeStyle = '#140c0e'; c.lineWidth = wd; c.lineCap = 'round';
          c.beginPath(); c.moveTo(x, y);
          c.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.5, y + Math.sin(a + 0.3) * len * 0.5, x1, y1); c.stroke();
          if (d === 0 || len < 18) { tips.push([x1, y1, len]); return; }
          const n = 2 + (rnd() < 0.45 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const da = (i - (n - 1) / 2) * (0.42 + rnd() * 0.3) + (rnd() - 0.5) * 0.25;
            branch(x1, y1, a + da, len * (0.66 + rnd() * 0.16), wd * 0.64, d - 1);
          }
          if (d < 4) tips.push([x1, y1, len * 0.8]);
        };
        const x0 = S * v + S / 2;
        branch(x0 + (rnd() - 0.5) * 40, h, -Math.PI / 2 + (rnd() - 0.5) * 0.2, h * 0.24, 30, 6);
        for (const [x, y, len] of tips) {
          const R = 24 + len * 0.55;
          for (let i = 0; i < 70; i++) {
            const a = rnd() * Math.PI * 2, rr = R * Math.sqrt(rnd());
            const q = rnd();
            c.fillStyle = q < 0.28 ? '#fff4f7' : q < 0.72 ? '#f7c1d2' : '#e48aab';
            const bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr * 0.75;
            if (!inside(bx, by, 10)) continue;
            c.beginPath(); c.arc(bx, by, 2.5 + rnd() * 4, 0, Math.PI * 2); c.fill();
          }
        }
      }
    }, { seed: 21 });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const geo = new THREE.PlaneGeometry(1, 1);
    const r = mulberry32(9), a = new Float32Array(NBLOS * 4);
    for (let i = 0; i < NBLOS; i++) a.set([i % 2, r(), (i + r() * 0.8) / NBLOS, r()], i * 4);
    geo.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4));
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uMap: { value: tex }, uCamZ: { value: 0 }, uGlow: { value: 1 }, uShow: { value: 1 }, uFog: { value: new THREE.Color() }, uFogD: { value: 0.03 }, uShrineZ: { value: -1e5 } },
      vertexShader: /* glsl */ `
        in vec4 aA; uniform float uCamZ, uShow, uShrineZ; out vec2 vUv; out float vD; out float vY;
        void main() {
          float side = aA.x < 0.5 ? -1.0 : 1.0;
          float z = -aA.z * ${BLOS_SPAN.toFixed(1)};
          z = uCamZ + 4.0 - mod(uCamZ + 4.0 - z, ${BLOS_SPAN.toFixed(1)});
          float ahead = uCamZ - z;
          float sz = uShow * (6.5 + aA.w * 3.5 + aA.y * 3.0) * smoothstep(${(BLOS_SPAN - 2).toFixed(1)}, ${(BLOS_SPAN - 10).toFixed(1)}, ahead);
          vec3 base = vec3(side * (4.4 + pow(aA.y, 1.6) * 22.0), -0.15, z);
          if (abs(base.x) < 17.0 && abs(base.z - uShrineZ) < 16.0) sz = 0.0;
          vec3 d = base - cameraPosition;
          vec3 right = normalize(vec3(-d.z, 0.0, d.x));
          vec3 w = base + right * position.x * sz * (fract(aA.w * 7.0) > 0.5 ? 1.0 : -1.0) + vec3(0.0, (position.y + 0.5) * sz, 0.0);
          float v = floor(fract(aA.y * 13.0) * 3.0);
          vUv = vec2((uv.x + v) / 3.0, uv.y); vY = position.y + 0.5;
          vec4 mv = viewMatrix * vec4(w, 1.0); vD = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        layout(location = 0) out highp vec4 outColor;
        in vec2 vUv; in float vD; in float vY; uniform sampler2D uMap; uniform float uGlow; uniform vec3 uFog; uniform float uFogD;
        void main() {
          vec4 t = texture(uMap, vUv);
          if (t.a < 0.5) discard;
          vec3 c = t.rgb * uGlow * mix(1.2, 0.5, smoothstep(0.25, 1.0, vY));
          c *= mix(0.45, 1.0, smoothstep(5.0, 15.0, vD)); // near crowns hang above the lanterns' light: dimmer (and the pillars sweeping past them no longer flash)
          c = mix(c, uFog, 1.0 - exp(-pow(uFogD * vD, 2.0)));
          outColor = vec4(c, 1.0);
        }`,
    });
    const m = new THREE.InstancedMesh(geo, mat, NBLOS);
    m.frustumCulled = false;
    return m;
  }

  /** The forest seen from above: tree crowns of three soft puffs each (camera-facing billboards, lighter on top, the
   *  lower puffs in shade) on a jittered grid; four blossom outlines (3–7 lobes, ragged rims), tinted per tree, and one
   *  crown in four a dark cedar (a column of puffs) so the pink reads (review R4: one stamped icon). In the near trees'
   *  zone they give way to those (uBill); elsewhere they show once the camera is above the trunks (uLow). */
  private makeCanopies() {
    const V = 5, S = 256;
    const tex = canvasTex(S * V, S, (c, w, h, rnd) => {
      c.clearRect(0, 0, w, h);
      for (let v = 0; v < V; v++) {
        const cedar = v === V - 1, L = [3, 5, 4, 7][v] ?? 9, ph = [rnd() * 6.3, rnd() * 6.3, rnd() * 6.3];
        const rim = (an: number) => 0.4 * (0.84 + 0.1 * Math.sin(an * L + ph[0]!) + 0.04 * Math.sin(an * (2 * L + 1) + ph[1]!) + 0.03 * Math.sin(an * 13 + ph[2]!));
        const cols = cedar ? ['#2a3a2f', '#16221b', '#0c140f'] : ['#fff4f7', '#f7c1d2', '#d97b9c'];
        for (let i = 0; i < 3000; i++) {
          const an = rnd() * Math.PI * 2, f = Math.pow(rnd(), 0.55);
          const rr = Math.min(S * 0.46, f * rim(an) * S * (f > 0.9 ? 0.9 + rnd() * 0.35 : 1)); // stray clusters past the rim
          const q = rnd();
          c.fillStyle = cols[q < 0.25 ? 0 : q < 0.7 ? 1 : 2]!;
          c.beginPath(); c.arc(S * v + S / 2 + Math.cos(an) * rr, h / 2 + Math.sin(an) * rr, 2 + rnd() * 3.5, 0, Math.PI * 2); c.fill();
        }
      }
    }, { seed: 33 });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const N = NCAN, NT = N / 3, COLS = 48, ROWS = NT / COLS, geo = new THREE.PlaneGeometry(1, 1);
    const r = mulberry32(41), a = new Float32Array(N * 4), b = new Float32Array(N * 4), tr = new Float32Array(N * 4);
    for (let ti = 0; ti < NT; ti++) {
      // a jittered grid: 24 columns a side from 7.5 m out, 50 rows over the 420 m the crowns wrap
      const ci = ti % COLS, side = ci < COLS / 2 ? -1 : 1, x = side * (7.5 + ((ci % (COLS / 2)) + 0.1 + 0.8 * r()) * (190 / (COLS / 2)));
      const zf = (Math.floor(ti / COLS) + 0.1 + 0.8 * r()) / ROWS;
      const cedar = r() < 0.25, tree = [cedar ? 4 : Math.floor(r() * 4), r() * 2 - 1, r() * 2 - 1, (cedar ? 0.7 : 0.6) + 0.9 * r()];
      for (let k = 0; k < 3; k++) {
        const i = ti * 3 + k, an = r() * Math.PI * 2, rr = k === 0 ? 0 : (cedar ? 0.5 : 1.6 + r()) * tree[3]!;
        a.set([x, zf, r(), r()], i * 4);
        b.set([Math.cos(an) * rr, (cedar ? 1.3 * (2 - k) : k === 0 ? 1.4 : r() * 0.8) * tree[3]!, Math.sin(an) * rr, k === 0 ? 1 : 0.72 + 0.12 * r()], i * 4);
        tr.set(tree, i * 4);
      }
    }
    geo.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4));
    geo.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 4));
    geo.setAttribute('aT', new THREE.InstancedBufferAttribute(tr, 4));
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uMap: { value: tex }, uCamZ: { value: 0 }, uOff: { value: 60 }, uBill: { value: 1 }, uLow: { value: 0 }, uGlow: { value: 1 }, uFog: { value: new THREE.Color() }, uFogD: { value: 0.03 }, uShrineZ: { value: -1e5 } },
      vertexShader: /* glsl */ `
        in vec4 aA; in vec4 aB; in vec4 aT; uniform float uCamZ, uOff, uBill, uLow, uShrineZ; out vec2 vUv; out float vD; out float vShade; out vec3 vTint;
        void main() {
          float z = uCamZ + uOff - mod(uCamZ + uOff + aA.y * 420.0, 420.0);
          vec3 c = vec3(aA.x + aB.x, 3.6 + aB.y + aA.z * 1.6, z + aB.z);
          float sz = (3.4 + aA.w * 2.2) * aT.w * (aT.x > 3.5 ? 0.72 : 1.0) * smoothstep(uCamZ + uOff - 420.0, uCamZ + uOff - 380.0, z) * smoothstep(uCamZ + uOff, uCamZ + uOff - 40.0, z);
          sz *= smoothstep(2.5, 6.0, distance(c, cameraPosition));
          float zone = smoothstep(27.0, 24.0, abs(c.x)) * smoothstep(uCamZ - 52.0, uCamZ - 44.0, c.z) * smoothstep(uCamZ + 7.0, uCamZ + 4.0, c.z);
          sz *= mix(uLow, 1.0 - uBill, zone);
          if (abs(c.x) < 17.0 && abs(c.z - uShrineZ) < 16.0) sz = 0.0; // the summit plaza is open
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 w = c + (right * position.x + up * position.y) * sz;
          vUv = vec2((uv.x + aT.x) / 5.0, uv.y); vShade = aB.w;
          vTint = aT.x > 3.5 ? vec3(1.0 + 0.12 * aT.z) : vec3(1.0 + 0.1 * aT.y, 1.0 - 0.03 * aT.y, 1.0 - 0.1 * aT.y) * (1.0 + 0.15 * aT.z);
          vec4 mv = viewMatrix * vec4(w, 1.0); vD = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        layout(location = 0) out highp vec4 outColor;
        in vec2 vUv; in float vD; in float vShade; in vec3 vTint; uniform sampler2D uMap; uniform float uGlow; uniform vec3 uFog; uniform float uFogD;
        void main() {
          vec4 t = texture(uMap, vUv);
          if (t.a < 0.5) discard;
          vec3 c = t.rgb * vTint * uGlow * vShade * mix(0.5, 1.05, vUv.y);
          c = mix(c, uFog, 1.0 - exp(-pow(uFogD * vD, 2.0)));
          outColor = vec4(c, 1.0);
        }`,
    });
    const m = new THREE.InstancedMesh(geo, mat, N);
    m.frustumCulled = false;
    return m;
  }

  /** The summit: a nagare-zukuri hall (the front slope of its roof runs far out over the worship area) on a stone
   *  platform where the tunnel ends; crossed finials and logs on the ridge, a sacred rope with paper streamers between the
   *  front columns, four tall paper lanterns under the eave (lit one by one in render()). The moon is behind it: its front
   *  stands in shadow. */
  private buildShrine(z: number) {
    const red = col(LIN.signal), wood = new THREE.Color(0.045, 0.02, 0.016), stoneC = new THREE.Color(0.1, 0.095, 0.09);
    const mat = (c: THREE.Color, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, zz: number) => {
      const o = new THREE.Mesh(geo, m); o.position.set(x, y, zz); o.castShadow = o.receiveShadow = true; g.add(o); return o;
    };
    const stone = mat(stoneC, 0.9), lacq = mat(red, 0.55), black = mat(new THREE.Color(0.012, 0.01, 0.01), 0.6);
    add(new THREE.BoxGeometry(26, 0.9, 18), stone, 0, 0.45, 0); // the platform
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(6, 0.3 * (i + 1), 0.8), stone, 0, 0.15 * (i + 1), 9.4 + (2 - i) * 0.8); // its steps
    add(new THREE.BoxGeometry(13, 4.6, 7.5), mat(wood, 0.8), 0, 0.9 + 2.3, -1); // the hall
    const pillar = new THREE.CylinderGeometry(0.26, 0.28, 4.6, 16);
    for (let i = 0; i < 6; i++) add(pillar, lacq, -6.2 + i * 2.48, 0.9 + 2.3, 3.0); // the front columns
    for (const x of [-6.45, 6.45]) add(pillar, lacq, x, 0.9 + 2.3, -4.6); // the back corners
    add(new THREE.BoxGeometry(13.6, 0.5, 0.6), lacq, 0, 5.4, 3.0); // the beam
    // the roof: a concave gable 0.3 m thick, its front slope running far out (nagare), 1.2 m past the hall's sides
    const sh = new THREE.Shape();
    sh.moveTo(-6.3, 6.0); sh.quadraticCurveTo(-3.2, 7.2, -1.5, 9.6); sh.quadraticCurveTo(2.2, 6.7, 6.2, 5.35);
    sh.lineTo(6.25, 5.05); sh.quadraticCurveTo(2.2, 6.4, -1.5, 9.3); sh.quadraticCurveTo(-3.2, 6.9, -6.35, 5.7); sh.closePath();
    const roof = new THREE.ExtrudeGeometry(sh, { depth: 15.4, bevelEnabled: false, curveSegments: 20 }).rotateY(-Math.PI / 2).translate(7.7, 0, 0);
    add(roof, mat(new THREE.Color(0.03, 0.028, 0.03), 0.8), 0, 0, 0);
    add(new THREE.BoxGeometry(15.8, 0.4, 0.6), black, 0, 9.65, -1.5); // the ridge
    const gold = mat(new THREE.Color(0.25, 0.17, 0.05), 0.4);
    for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.17, 0.17, 1.2, 12).rotateX(Math.PI / 2), gold, -5 + i * 2.5, 10.0, -1.5); // katsuogi
    for (const x of [-7.6, 7.6]) for (const k of [-1, 1]) add(new THREE.BoxGeometry(0.12, 2.8, 0.34).rotateX(k * 0.62), black, x, 10.2, -1.5); // chigi: the crossed finials
    // the sacred rope between the front columns, sagging, with paper streamers
    const ropeY = (x: number) => 4.9 - 0.4 * (1 - (x / 6.2) ** 2);
    const rope = new THREE.CatmullRomCurve3([-6.2, -3.1, 0, 3.1, 6.2].map((x) => new THREE.Vector3(x, ropeY(x), 3.4)));
    add(new THREE.TubeGeometry(rope, 64, 0.15, 10), mat(new THREE.Color(0.3, 0.23, 0.1), 0.9), 0, 0, 0);
    const paper = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.88, 0.82), roughness: 0.8, side: THREE.DoubleSide });
    for (const x of [-4.6, -1.55, 1.55, 4.6]) add(new THREE.PlaneGeometry(0.22, 0.62), paper, x, ropeY(x) - 0.45, 3.42);
    // four tall paper lanterns under the front eave
    const lathe = new THREE.LatheGeometry(Array.from({ length: 13 }, (_, i) => new THREE.Vector2(0.24 + 0.16 * Math.sin((i / 12) * Math.PI), (i / 12) * 1.3 - 0.65)), 24);
    const lamps: THREE.MeshBasicMaterial[] = [];
    for (const x of [-4.8, -1.6, 1.6, 4.8]) {
      const m = new THREE.MeshBasicMaterial({ color: 0x000000 });
      lamps.push(m);
      add(lathe, m, x, 4.35, 4.6).castShadow = false;
      add(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 20), black, x, 5.06, 4.6);
      add(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 20), black, x, 3.66, 4.6);
    }
    for (const x of [-7.5, 7.5]) {
      const st = new THREE.Mesh(this.stones.geometry, this.stones.material as THREE.Material); st.scale.setScalar(2); st.position.set(x, 0.9, 6.5); g.add(st);
      const fi = new THREE.Mesh(this.fires.geometry, this.fireMat); fi.scale.setScalar(2); fi.position.set(x, 0.9, 6.5); g.add(fi);
    }
    const L = new THREE.PointLight(0xffa860, 6, 30, 2); L.position.set(0, 4, 9); g.add(L);
    this.hall = { lamps, light: L };
    g.position.set(0, 0, z);
    this.scene.add(g);
  }

  override cues(): Cue[] {
    const out: Cue[] = [];
    for (const c of this.choruses) {
      out.push({ t: c.tC, name: 'brake (the pre-chorus lands)', on: 'downbeat' });
      out.push({ t: c.tFreeze, name: 'freeze (bass out)', on: 'bass_out' });
      out.push({ t: c.tFull, name: c.quiet ? 'the quiet chorus' : 'surge: the band is back, the title flares', on: 'downbeat' });
      if (c.title) out.push({ t: c.tBurst, name: 'the title bursts into petals', on: 'beat' });
      for (const t of c.punches) out.push({ t, name: 'title punch', on: this.ctx.audio.ev.in(t - 0.01, t + 0.01, 'kick').length ? 'kick' : 'sub' });
    }
    out.push({ t: this.S('verse1').start, name: 'through the great gate', on: 'downbeat' });
    return out;
  }

  /** The camera: on the rail down the tunnel, or lifted out of it (intro, interlude, solo / build, outro). */
  private camera(f: Frame, t: number, z: number, ch: Chorus | undefined) {
    const P = this.P, bar1 = 4 * P, audio = this.ctx.audio, peak = this.S('chorus3');
    // the stop bar, its frozen second half, the chorus body (all 0 away from a chorus)
    const end01 = ch ? 1 - smoothstep(ch.tFull - 0.1, ch.tFull + 0.35, t) : 0;
    const stop = ch ? smoothstep(ch.tC, ch.tC + 0.3, t) * end01 : 0;
    const hold = ch ? smoothstep(ch.tFreeze, ch.tFreeze + 0.15, t) * end01 : 0;
    const after = ch ? smoothstep(ch.tFull, ch.tFull + 0.6, t) * (1 - smoothstep(ch.spanEnd - 0.3, ch.spanEnd + bar1, t)) : 0;
    // the chorus moves on every second downbeat: bar +1 dolly right, +2 a quarter roll, +3 drop low and centre, +5 rise
    // back (the roll swaps back), +6 dolly left; each eased over one bar. The peak chorus rides low all through.
    const bk = ch ? Math.round(ch.barFull) : 0;
    const mv = (k: number) => (ch ? ease.inOutCubic(clamp((t - audio.timeOfBar(bk + k)) / bar1)) : 0);
    const peakLow = smoothstep(peak.start, peak.start + 0.5, t) * (1 - smoothstep(peak.end - bar1, peak.end, t));
    const low = Math.max(ch ? mv(3) * (1 - mv(5)) * (1 - smoothstep(ch.spanEnd - bar1, ch.spanEnd, t)) : 0, peakLow);
    const railX = 0.16 * Math.sin((f.bar / 8) * Math.PI * 2) * (1 - stop) + (0.7 * (mv(1) - mv(3)) - 0.65 * mv(6)) * (ch ? 1 - smoothstep(ch.spanEnd - bar1, ch.spanEnd, t) : 0) * (1 - peakLow); // the peak rides centred: low and 0.65 m off it the pillars and lanterns swept the frame's corner at 4 / s (flash check, 1-sample final)
    const railY = lerp(1.48, 0.62, low);
    const pos = this.v3.set(railX, railY, z);
    const at = this.lookAt.set(railX * 0.4, railY + 0.1 - 0.08 * stop + 0.45 * low, z - 10);
    // the great gate's plaque: a 3° tilt up on the approach so it reads whole, then it passes overhead
    const v1s = this.S('verse1').start;
    at.y += 0.52 * smoothstep(v1s - 6, v1s - 4.8, t) * (1 - smoothstep(v1s - 3.8, v1s - 2.3, t));
    let fov = 48 - 7 * stop + 17 * after - 3 * after * (ch ? smoothstep(ch.tFull + 1, ch.tFull + 4, t) : 0) + 2.5 * f.a.snare * after;
    let roll = -0.045 * after * lerp(1, -1, low) * Math.sin(((f.bar - (ch?.barFull ?? 0)) / 4) * Math.PI * 2)
      + 0.0087 * hold * (ch ? smoothstep(ch.tFreeze, ch.tFull, t) : 0) + 0.09 * (mv(2) - mv(4)) * after;

    // ---- lifted out of the tunnel (the torii have no roof): weight w, pose (ap, aa), bank aroll. A straight crane
    // rises clear of the beams over the rail before it moves off it.
    const s = this.secAt(t);
    let w = 0, aroll = 0, straight = false;
    const ap = new THREE.Vector3(), aa = new THREE.Vector3();
    let afov = 50;
    const iv = this.S('interlude'), so = this.S('solo'), bu = this.S('build'), ou = this.S('outro');
    if (t < this.bar(this.barOf(v1s) - 4)) {
      // the intro: the dive on the first hit, then skimming the treetops with a bank into each turn, one per 4-bar phrase
      // (bars 4, 8, 12), down to the great gate
      const k = this.introPath.at(t);
      const ph = clamp((t - this.bar(4)) / (12 * bar1)) * 3 * Math.PI, A = lerp(5, 1.5, smoothstep(this.bar(11), this.bar(13), t));
      w = 1; ap.copy(k.p); aa.copy(k.at); afov = k.fov;
      ap.x += A * Math.sin(ph); aa.x += 0.5 * A * Math.sin(ph);
      aroll = 0.21 * (A / 5) * Math.sin(ph);
    } else if (s === iv) {
      // the interlude: straight up out of the tunnel and along above it, the gates ticking past below at one a beat
      w = this.craneW(0, t) * this.craneW(1, t); straight = true;
      const u = (t - iv.start) / (iv.end - iv.start);
      ap.set(-1.6 + 1.2 * Math.sin(u * Math.PI), 7 + 0.4 * Math.sin(u * Math.PI * 2), z + 2); aa.set(0, 1.2, z - 20); afov = 46;
    } else if (s === so || s === bu) {
      w = this.craneW(2, t) * (1 - ease.inOutCubic(clamp((t - (bu.end - 3 * bar1)) / (3 * bar1))));
      straight = t < so.start + bar1;
      const u = (t - so.start) / (bu.end - so.start); // 0 → 1 over solo + build
      const sp = smoothstep(so.end, bu.end, t); // the build spirals down
      const phi = u * Math.PI * 2.4 + sp * sp * Math.PI * 1.2;
      const bob = (1 - sp) * 3.5 * Math.sin(((t - so.start) / (8 * P)) * Math.PI * 2);
      // the orbit closes in on bar 97 and opens out wide and high on bar 101 (the whole line in view)
      const rk = lerp(lerp(1, 0.75, ease.inOutCubic(clamp((t - this.bar(97)) / (2 * P)))), 1.3, ease.inOutCubic(clamp((t - this.bar(101)) / (2 * P))));
      const k = lerp(rk, 1, sp);
      const R = (lerp(20, 5, sp) + (1 - sp) * 3 * Math.sin(((t - so.start) / (16 * P)) * Math.PI * 2)) * k, y = (lerp(16, 6, sp) + bob) * k; // oblique: the red pillars show
      ap.set(R * Math.sin(phi), y, z + R * Math.cos(phi)); aa.set(0, 1, z - 9); afov = lerp(46, 52, sp);
    } else if (s === ou || s.name === 'end') {
      // the arrival: out of the last gate into the plaza, a tilt up to the moon over the hall (bar 142); on bar 147 the
      // crane rises over the hall and turns back down the mountain: the whole lit line of gates, held to the cut
      at.y += 3.2 * ease.inOutCubic(clamp((t - this.bar(this.barOf(this.tLast) + 2)) / bar1));
      const r = clamp((t - this.bar(147)) / (5 * bar1)), e = ease.inOutCubic(r);
      if (r > 0) {
        w = 1;
        const th = this.outroYaw = (Math.PI + 0.2) * ease.inOutCubic(clamp((r - 0.2) / 0.8)), ph = lerp(0.31, -0.2, e);
        ap.set(lerp(pos.x, -12, e), lerp(pos.y, 30, ease.outCubic(r)) + 0.8 * Math.max(0, t - this.bar(152)), lerp(pos.z, this.shrineZ - 38, e));
        aa.set(-Math.sin(th) * Math.cos(ph), Math.sin(ph), -Math.cos(th) * Math.cos(ph)).multiplyScalar(40).add(ap);
        aa.lerp(at, 1 - smoothstep(0, 0.15, r));
        afov = lerp(fov, 50, e);
      }
    }
    if (w > 0) {
      const y = lerp(pos.y, ap.y, w), wxz = straight ? w * smoothstep(5.8, 6.6, y) : w;
      pos.set(lerp(pos.x, ap.x, wxz), y, lerp(pos.z, ap.z, wxz));
      at.lerp(aa, w); fov = lerp(fov, afov, w); roll = roll * (1 - w) + aroll * w;
    }
    const cam = this.cam;
    cam.position.copy(pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(at);
    const hh = handheld(t, 0.0022 * (1 + 2 * w), 0.3, 3);
    cam.rotateZ(roll + hh[2]);
    cam.rotateY(hh[0]); cam.rotateX(hh[1]);
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld(true);
    return { stop, hold, after, lifted: w };
  }

  /** Petal density by section (the share of the NPET petals in the air), crossfaded over a bar at each boundary. */
  private density(t: number) {
    const base = (s: Sec) => {
      if (s.name === 'intro') return 0.14;
      if (s.name === 'verse2') return 0.1; // the dark verse
      if (s.name.startsWith('verse')) return 0.2;
      if (s.name.startsWith('pre')) return 0.27;
      if (s.name === 'chorus3a') return 0.32;
      if (s.name === 'chorus3') return 1;
      if (s.name.startsWith('chorus')) return 0.46;
      if (s.name === 'outro' || s.name === 'end') return 0.22;
      return 0.29;
    };
    const i = this.sec.indexOf(this.secAt(t)), s = this.sec[i]!, prev = this.sec[i - 1];
    // a stop chorus thickens on its surge, not on its downbeat
    const c = this.choruses.find((x) => x.tC === s.start);
    const t0 = c ? c.tFull - 0.1 : s.start;
    return prev ? lerp(base(prev), base(s), smoothstep(t0, t0 + (c ? 0.7 : 4 * this.P), t)) : base(s);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, params } = this.ctx;
    const t = f.t, P = this.P;
    const ch = this.choruses.find((c) => t >= c.tC - 0.5 && t < c.spanEnd + 4 * P);
    // the camera winds back 0.15 m into a surge and is slung forward on it
    let wind = 0;
    if (ch && !ch.quiet) wind = t < ch.tFull ? 0.15 * ease.inCubic(clamp((t - (ch.tFull - 0.4)) / 0.4)) : 0.15 * (1 - ease.outCubic(clamp((t - ch.tFull) / 0.15)));
    const z = -this.travel(t) + wind;
    const { stop, hold, after, lifted } = this.camera(f, t, z, ch);
    const cam = this.cam, cz = cam.position.z, cy = cam.position.y;
    const peak = this.S('chorus3'), ou = this.S('outro');

    // ---- gates: the great gate at k = 0 (2.4×), none past the summit; in a chorus the gate passing on each downbeat is
    // 22 % larger. On the rail a window around the camera; from the air the whole line in view, behind the rail point too
    const air = cy > 4.5;
    const ng = air ? NG_AIR : NG;
    const k0 = Math.max(0, Math.floor(-(air ? z : cz) / GAP) - (air ? BACK_AIR : 2));
    this.gates.count = ng;
    for (let i = 0; i < ng; i++) {
      const k = k0 + i;
      let s = k > this.kEnd ? 0 : k === 0 ? 2.4 : 0.97 + 0.06 * hash(k, 4);
      // a crane stands mid-gap: the gate just ahead goes while the camera crosses its beams (it is out of frame then:
      // the beams above, the pillars beside)
      const ahead = cz + k * GAP;
      if (k > 0 && cy > 1.7 && cy < 6.5 && ahead > -0.6 && ahead < 1.6 && Math.abs(cam.position.x) < 2.4) s = 0;
      for (const c of this.choruses) {
        if (c.quiet || k === 0) continue;
        const d = k * GAP;
        if (d >= this.travel(c.tFull) && d <= this.travel(c.spanEnd) && (((k - c.kS) % 4) + 4) % 4 === 0) s *= 1.22;
      }
      this.q.setFromAxisAngle(this.yAxis, (hash(k, 3) - 0.5) * 0.012);
      this.m.compose(this.v3.set(0, 0, -k * GAP), this.q, this.s3.set(s, s, s));
      this.gates.setMatrixAt(i, this.m);
      this.gates.setColorAt(i, this.tint.setRGB(0.9 + 0.14 * hash(k, 5), 0.86 + 0.16 * hash(k, 5), 0.85 + 0.1 * hash(k, 6)));
    }
    this.gates.instanceMatrix.needsUpdate = true;
    this.gates.instanceColor!.needsUpdate = true;

    const punches = ch?.punches ?? [];
    const punch = (x: number, rel: number) => punches.reduce((a, k) => a + clamp((x - k) / 0.033) * Math.exp(-Math.max(0, x - k - 0.033) / rel), 0);
    const surge = (t0: number | undefined) => (t0 !== undefined && t >= t0 ? Math.exp(-(t - t0) / 0.25) : 0);
    const peakW = smoothstep(peak.start - 0.05, peak.start + 0.1, t) * (1 - smoothstep(peak.end - 4 * P, peak.end, t));
    const hit = this.hits.reduce((a, h) => a + (t >= h ? Math.exp(-(t - h) / 0.25) : 0), 0); // the outro's last two hits
    const flare = 1 + 1.1 * (1 + 0.6 * peakW) * f.a.snare * (1 - stop) + 0.8 * punch(t, 0.1) + 2.2 * surge(ch && !ch.quiet ? ch.tFull : undefined) + 2.2 * surge(peak.start) + 2.5 * hit;
    const quietW = ch?.quiet ? smoothstep(ch.tFull, ch.tFull + 0.4, t) * (1 - smoothstep(peak.start - 0.1, peak.start + 0.1, t)) : 0;
    const dim = (1 - 0.55 * hold) * (1 - 0.55 * quietW);
    // the fronts of light running down the line (the lacquer glows where one passes)
    const so = this.S('solo'), bu2 = this.S('build'), v2 = this.S('verse2'), pre2 = this.S('pre2');
    const chase = smoothstep(so.start, so.start + 2 * 4 * P, t) * (1 - smoothstep(bu2.end - 4 * P, bu2.end, t));
    const fr = this.fronts.filter((w) => t >= w.t0 && t < w.t0 + w.life)
      .map((w) => ({ d: w.d0 + w.v * (t - w.t0), a: w.hold ? peakW : chase * (1 - (t - w.t0) / w.life), hold: w.hold }));
    this.frontU.value.forEach((u, i) => u.set(fr[i]?.d ?? -1e4, fr[i] ? fr[i]!.a * (fr[i]!.hold ? 0.5 : 1) : 0));
    // verse 2 runs dark (one lantern in four lit); through pre-chorus 2 they come back on one by one
    const v2on = smoothstep(v2.start - 0.1, v2.start + 0.3, t), v2p = clamp((t - pre2.start) / (pre2.end - pre2.start));
    const v2dark = v2on * (1 - v2p);
    const lvl = (j: number) => {
      const d = j * LSLOT * GAP + GAP / 2;
      let k = 1;
      for (const w of fr) k += w.hold ? 0.8 * w.a * smoothstep(d - 4, d, w.d) : 3 * w.a * Math.exp(-(((d - w.d) / 3.5) ** 2));
      if (j % 4 !== 0) { const h = hash(j, 8) * 0.92; k *= 1 - 0.95 * v2on * (1 - smoothstep(h, h + 0.06, v2p)); }
      return k;
    };
    const lastSlot = Math.floor(this.kEnd / LSLOT);
    const nl = air ? NL_AIR : NL;
    const s0 = Math.max(0, Math.floor(-(air ? z : cz) / (GAP * LSLOT)) - (air ? Math.round(BACK_AIR / LSLOT) : 1));
    this.stones.count = this.fires.count = nl * 2;
    for (let i = 0; i < nl; i++) {
      const j = s0 + i, lz = -(j * LSLOT * GAP) - GAP / 2, on = j < lastSlot ? 1 : 0, k = lvl(j);
      for (const side of [0, 1]) {
        this.m.makeRotationY(hash(j, side) * 0.2 - 0.1).scale(this.s3.setScalar(on)).setPosition(side ? 2.05 : -2.05, 0, lz);
        this.stones.setMatrixAt(i * 2 + side, this.m);
        this.fires.setMatrixAt(i * 2 + side, this.m);
        this.fires.setColorAt(i * 2 + side, this.tint.setScalar(k));
      }
    }
    this.stones.instanceMatrix.needsUpdate = this.fires.instanceMatrix.needsUpdate = true;
    this.fires.instanceColor!.needsUpdate = true;
    const hi = smoothstep(3, 8, cy), rise = clamp((t - this.bar(147)) / (5 * 4 * P));
    this.glowAllU.value = (0.45 * rise + 0.12 * chase * lifted) * (1 + hit);
    this.fireMat.color.copy(col(LIN.acid).multiplyScalar(2.4 * flare * dim * (1 + 2 * hi))); // gold, not clipped to white; from the air a line of lights
    const cs = Math.max(0, -z / (GAP * LSLOT));
    const pu = this.petals.material as THREE.ShaderMaterial;
    for (let l = 0; l < 3; l++) {
      const j0 = Math.floor(cs - 0.45);
      const j = j0 + ((((l - j0) % 3) + 3) % 3);
      const dz = j - cs;
      const w = smoothstep(2.55, 2.0, dz) * smoothstep(-0.45, -0.05, dz) * (j < lastSlot ? 1 : 0);
      for (const side of [0, 1]) {
        const L = this.lights[l * 2 + side]!;
        L.position.set(side ? 2.05 : -2.05, 1.05, -(j * LSLOT * GAP) - GAP / 2);
        const wv = lvl(j) ** 1.3; // a front of light lights the gates around each lantern too
        L.intensity = 7 * w * flare * dim * wv;
        (pu.uniforms.uLP!.value as THREE.Vector3[])[l * 2 + side]!.copy(L.position);
        (pu.uniforms.uLW!.value as number[])[l * 2 + side] = w * flare * dim * wv;
      }
    }
    // the summit: its paper lanterns light one by one on the beats of bar 141, the front of the hall warming with them
    if (this.hall) {
      const audio = this.ctx.audio, b0 = audio.beatAt(this.bar(this.barOf(this.tLast) + 1));
      let n = 0;
      this.hall.lamps.forEach((m, i) => {
        const u = smoothstep(0, 0.08, t - audio.timeOfBeat(b0 + i));
        n += u;
        m.color.setRGB(0.05, 0.035, 0.03).lerp(this.tint.copy(col(LIN.acid)).multiplyScalar(2.0 * (1 + 0.8 * hit)), u);
      });
      this.hall.light.intensity = (6 + 10 * n) * (1 + hit);
    }

    // ---- moonlight: the shadow (and moonbeam) camera covers more ground as the camera rises
    const reach = lerp(1, 4.5, lifted);
    const tz = lerp(z - 14, this.lookAt.z, lifted);
    this.moon.target.position.set(0, 0, tz);
    this.moon.position.copy(this.moon.target.position).addScaledVector(MOON_DIR, 40 * reach);
    const sc = this.moon.shadow.camera;
    if (sc.right !== 11 * reach) { Object.assign(sc, { left: -11 * reach, right: 11 * reach, top: 24 * reach, bottom: -24 * reach, far: 90 * reach }); sc.updateProjectionMatrix(); }
    softSun(this.moon, 0.006);
    this.vol.cam.position.copy(this.moon.target.position).addScaledVector(MOON_DIR, 45 * reach);
    this.vol.cam.lookAt(this.moon.target.position);
    const vc = this.vol.cam as THREE.OrthographicCamera;
    if (vc.right !== 12 * reach) { Object.assign(vc, { left: -12 * reach, right: 12 * reach, top: 26 * reach, bottom: -26 * reach, far: 95 * reach }); vc.updateProjectionMatrix(); }
    this.vol.density = 0.022 * (1 - 0.35 * hold) * (1 + 0.5 * v2dark); // the air stills with the music; the dark verse is all moonbeams
    this.moon.intensity = 1.6 * (1 + 0.25 * v2dark);
    // inside the tunnel only, from the great gate to the last one (past it the box is empty)
    this.vol.box!.min.set(-1.25, 0, Math.max(z - 40 * reach, -this.kEnd * GAP)); this.vol.box!.max.set(1.25, 3.4, Math.min(z + 2, 2));
    this.ground.position.set(0, 0, Math.round(cz / 4) * 4);
    this.sky.position.copy(cam.position);
    // the moon: set below the treetops; up over the summit once the camera is out of the last gate; flaring on the hits
    const su = (this.sky.material as THREE.ShaderMaterial).uniforms;
    su.uMoonVis!.value = Math.max(smoothstep(3, 9, cy), smoothstep(this.tLast, this.bar(this.barOf(this.tLast) + 2), t));
    (su.uMoon!.value as THREE.Vector3).copy(MOON_VIEW).lerp(MOON_OUT, smoothstep(ou.start - 1, ou.start + 1, t))
      .lerp(MOON_BACK, t > this.bar(147) ? smoothstep(0.85, 2.1, this.outroYaw) : 0).normalize(); // while out of frame
    su.uFlare!.value = (t >= this.bar(1) ? Math.exp(-(t - this.bar(1)) / 0.6) : 0) + 0.6 * hit;
    // from the air the lacquer's clear coat reads as neon stripes along the black kasagi (review R4): it goes matte
    (this.gates.material as THREE.MeshPhysicalMaterial).clearcoat = lerp(0.35, 0.02, hi);
    this.scene.environmentIntensity = lerp(0.25, 0.1, hi);
    this.glow.position.set(0, 1.25, z - 70);
    this.glow.quaternion.copy(cam.quaternion);
    this.glow.visible = lifted < 0.5 && -z > -10;

    // ---- the air thins as the camera rises; petals, the forest
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density = lerp(0.03, 0.0055, Math.max(smoothstep(3, 30, cy), 0.75 * smoothstep(4, 10, cy)));
    const fogC = fog.color;
    let flutter = 0;
    for (const k of this.kicks) if (k <= t && k > t - 3) flutter += 0.1 * (1 - Math.exp(-(t - k) / 0.18));
    flutter += 0.1 * this.kicks.filter((k) => k <= t - 3).length;
    pu.uniforms.uT!.value = this.petalClock.at(t);
    pu.uniforms.uCamZ!.value = cz;
    pu.uniforms.uFogD!.value = fog.density;
    (this.groundPetals.material as THREE.ShaderMaterial).uniforms.uCamZ!.value = z;
    // the outro's last two hits: a gust of petals
    pu.uniforms.uBurst!.value = flutter + this.hits.reduce((a, h) => a + (t >= h ? 1.5 * (1 - Math.exp(-(t - h) / 0.2)) : 0), 0);
    pu.uniforms.uDensity!.value = Math.min(1, this.density(t) + this.hits.reduce((a, h) => a + 0.3 * smoothstep(h, h + 0.1, t), 0));
    (pu.uniforms.uFog!.value as THREE.Color).copy(fogC);
    const bu = (this.blossoms.material as THREE.ShaderMaterial).uniforms;
    bu.uCamZ!.value = cz; (bu.uFog!.value as THREE.Color).copy(fogC); bu.uFogD!.value = fog.density;
    bu.uGlow!.value = 0.95 * (1 - 0.3 * hold) * (1 + 0.25 * f.a.kick) * (1 + 0.15 * peakW) * (1 - 0.25 * v2dark);
    bu.uShow!.value = 1 - smoothstep(7.5, 9.5, cy);
    const cu = (this.canopies.material as THREE.ShaderMaterial).uniforms;
    cu.uCamZ!.value = cz; (cu.uFog!.value as THREE.Color).copy(fogC); cu.uFogD!.value = fog.density;
    const soloLit = chase * lifted; // the solo from the air was the darkest stretch of the film (review R4)
    cu.uBill!.value = bu.uShow!.value; cu.uLow!.value = smoothstep(2.5, 6, cy);
    cu.uOff!.value = t >= ou.start ? 210 : 60; // switched in the tunnel, where no crown shows
    cu.uGlow!.value = 0.95 * (1 + 0.2 * f.a.kick) * (1 + 0.35 * soloLit);

    // ---- the titles: each glyph slams in as it is sung (vermilion flash), it flares with the band, then bursts into petals
    let focus = 7.5;
    for (const c of this.choruses) {
      if (!c.title) continue;
      c.title.visible = t >= c.tTitle && t < c.tBurst;
      if (c.title.visible) {
        const ts = shutterT(t, 1), u = ts - c.tTitle, pk = punch(ts, 0.167);
        c.title.scale.setScalar((1 + 0.6 * Math.exp(-Math.max(0, u) / 0.07)) * (1 + 0.06 * pk));
        c.title.position.y = 1.5 + (c.quiet ? 0.6 * Math.max(0, u) : 0); // the quiet chorus's title drifts up
        const tu = (c.title.material as THREE.ShaderMaterial).uniforms;
        tu.uGlow!.value = (1.5 + 2.2 * Math.exp(-Math.max(0, u) / 0.1)) * (1 + 1.2 * pk) * (1 + (!c.quiet && ts >= c.tFull ? 0.6 * Math.exp(-(ts - c.tFull) / 0.15) : 0));
        const ages = tu.uAge!.value as number[];
        c.titleCt.forEach((ct, j) => { if (j < 8) ages[j] = ts - ct; });
      }
      const pt = (c.titlePetals!.material as THREE.ShaderMaterial).uniforms;
      pt.uU!.value = t - c.tBurst;
      (pt.uFog!.value as THREE.Color).copy(fogC); pt.uFogD!.value = fog.density;
      if (t >= c.tTitle - 0.05 && t < c.tBurst + 0.9) {
        const dT = Math.max(0.6, z - c.titleZ);
        focus = lerp(7.5, lerp(dT, 7.5, smoothstep(c.tBurst + 0.2, c.tBurst + 0.9, t)), smoothstep(c.tTitle - 0.05, c.tTitle + 0.05, t));
      }
    }
    focus = lerp(focus, cam.position.distanceTo(this.lookAt), lifted);

    this.vol.update(renderer, this.scene);
    this.g.render(renderer, this.scene, cam, fogC);
    // the raymarch's jitter walks with the sub-frame (averaged away in the export), fixed per frame elsewhere
    this.volPass.render(renderer, this.g, cam, [this.vol], this.volRT, SUBFRAME.s >= 0 ? SUBFRAME.s * 97.1 : frameIdx(t) % 997, 32 * reach);
    this.dof.focus = focus;
    this.dof.aperture = lerp(22, 34, stop) * (1 - 0.75 * lifted);
    this.dof.maxBlur = 24;
    this.dof.render(renderer, this.volRT.texture, this.g.depth, cam, out);

    // ---- the lyric columns (crisp: they hold still in the frame). A line clears (slides 40 px left, fades in 120 ms)
    // before the next one starts, so two lines never share a column.
    const tt = shutterT(t, 0);
    const c = this.text.ctx;
    this.text.clear();
    const size = 62, x0 = W - 136, step = 92, y0 = 124;
    const state = this.lines.map(({ l, ph, titleOf }, li) => {
      const next = this.lines[li + 1]?.l.start ?? Infinity;
      const gone = Math.min(next - 0.03, l.end + 0.9);
      const o = smoothstep(gone - 0.12, gone, tt);
      // (only the lines that start in this shot: the scene before it set its own, e.g. the festival street's banners)
      const shown = l.start < this.ctx.start - 0.3 ? [] : titleOf ? ph.slice(1) : ph;
      const on = shown.length > 0 && tt >= shown[0]!.t ? 1 - o : 0;
      return { shown, fade: on, slide: -40 * ease.inCubic(o) };
    });
    // a soft night scrim behind the block, so the columns read over pillars and lit trees alike
    const scrim = Math.max(0, ...state.map((s) => s.fade));
    if (scrim > 0) {
      c.save();
      c.translate(W - 230, y0 + 430);
      c.scale(0.62, 1);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, 560);
      gr.addColorStop(0, rgba('ink', 0.62 * scrim)); gr.addColorStop(0.55, rgba('ink', 0.48 * scrim)); gr.addColorStop(1, rgba('ink', 0));
      c.fillStyle = gr; c.fillRect(-560, -560, 1120, 1120);
      c.restore();
    }
    c.font = font(F.serif(600), size);
    c.shadowColor = 'rgba(7,9,18,0.75)'; c.shadowBlur = 14;
    c.lineWidth = 3; c.lineJoin = 'round';
    state.forEach(({ shown, fade, slide }) => {
      if (fade <= 0) return;
      shown.forEach((p, k) => {
        if (tt < p.t) return;
        const x = x0 - k * step + slide;
        c.fillStyle = rgba('bone', fade); c.strokeStyle = rgba('ink', 0.7 * fade);
        drawColumn(c, p.text, x, y0, size, (j) => ease.outCubic(clamp((tt - p.ct[j]!) / 0.11)), true);
        // a rule beside the column, drawn down with it (paper white: vermilion vanished over the pillars)
        const len = p.ct.reduce((a, ct) => a + ease.outCubic(clamp((tt - ct) / 0.11)), 0) * size * 1.06;
        c.fillStyle = rgba('bone', 0.55 * fade);
        c.fillRect(x + size * 0.62, y0 + 4, 2, len);
      });
    });
    c.shadowBlur = 0;
    if (params.gust !== undefined) petalStorm(c, tt, params.gust as number); // the storm the cut into this shot hides in
    if (params.deco) decoFrame(c, W, H); // Direction v3: the design system's gold frame over the tunnel
    comp.draw(renderer, this.text.upload(), out);

    const fadeIn = params.fade ? 1 - smoothstep(this.bar(1) - 0.03, this.bar(1) + 0.1, t) : 0; // black until the band's first hit
    const fadeOut = params.fade ? smoothstep(this.tCut - 0.02, this.tCut + 0.015, t) : 0; // the band stops dead: so does the picture
    return {
      exposure: 1 + 0.3 * soloLit,
      bloom: 0.62, halation: 0.28, ca: 0.6, grain: 0.04, vignette: 0.4, shoulder: 1, grade: 0.35,
      flash: 0, // the slam is the glyph's own vermilion bloom; a frame flash lifts the darks to grey (review R1, R3)
      zoom: 1 + (ch && !ch.quiet && t >= ch.tFull ? 0.035 * Math.exp(-(t - ch.tFull) / 0.15) : 0)
        + (ch && t >= ch.tC ? 0.02 * Math.exp(-(t - ch.tC) / 0.12) : 0) + (t >= peak.start ? 0.035 * Math.exp(-(t - peak.start) / 0.15) : 0),
      shake: [0.6 * punch(t, 0.1), 1.5 * punch(t, 0.1)] as [number, number],
      fade: Math.max(fadeIn, fadeOut),
    };
  }
}
