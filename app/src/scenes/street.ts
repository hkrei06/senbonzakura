// The festival street (pre-chorus 1; docs/TREATMENT.md, Direction v3): a Taisho shopping street at night built from flat,
// poster-like cards in 3D space (drawn with the taisho.ts kit): shop fronts down both sides (brick, machiya, storehouse,
// café) with vertical signboards, lantern strings across it that light on the beat just ahead of the camera, the lyric
// phrases rising as nobori banners while they are sung, Miku's silhouette running ahead. The camera runs down the street
// faster and faster and flies through the vermilion torii at its end on the chorus downbeat: a hard cut into the tunnel
// (torii.ts).
import * as THREE from 'three';
import { Scene, type Cue, type Frame } from '../engine/scene';
import { W, H, Layer2D } from '../engine/gl';
import { canvasTex, handheld, setupRenderer } from '../engine/world';
import { clamp, ease, hash, lerp, smoothstep } from '../engine/util';
import { PAL, SERIF900, layer, crest, moonDisc, skyline, mikuRunning, sakuraTree, decoFrame } from './taisho';
import { elevation, type Kind as Arch, type Palette } from './taisho-arch';
import { walker } from './intro';
import { sheetBack, HERO_B } from './verse1';
import { toriiGeometry, phraseTimes, drawColumn, Integral, type Phrase } from './torii';

const HALF = 5.2; // the shop fronts stand this far either side of the street's middle (m)
const PXM = 96; // facade texture px per metre (× SCALE)
const SIGNS = ['御菓子', '珈琲', '牛鍋', '呉服', '時計', '洋品', '茶房', '甘味', '酒', '薬'];
const MOON = new THREE.Vector3(0.05, 0.3, -1).normalize();
/** A vertical signboard (kanban): black lacquer with a gold frame and cream characters, or the reverse. */
function signboard(text: string, seed: number) {
  const n = [...text].length, wm = 0.62, hm = 0.34 + n * 0.5, k = PXM * 1.6;
  return { cv: layer(wm * k, hm * k, (c, r) => {
    const dark = r() < 0.6, w = wm * k, h = hm * k;
    c.fillStyle = dark ? '#140b0e' : '#e6d8b8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(5, 5, w - 10, h - 10); c.lineWidth = 1; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = dark ? PAL.cream : PAL.ink; c.font = `${0.42 * k}px ${SERIF900}`;
    drawColumn(c, text, w / 2, 0.15 * k, 0.45 * k, () => 1);
  }, seed), wm, hm };
}

/** A paper lantern (chōchin): red with a white crest, or white with a red band. */
function chochin(red: boolean) {
  return layer(80, 116, (c) => {
    const body = new Path2D();
    body.moveTo(16, 14); body.bezierCurveTo(-4, 40, -4, 76, 16, 102); body.lineTo(64, 102); body.bezierCurveTo(84, 76, 84, 40, 64, 14); body.closePath();
    c.fillStyle = red ? PAL.ver : PAL.cream; c.fill(body);
    c.save(); c.clip(body);
    c.strokeStyle = red ? 'rgba(60,8,4,0.45)' : 'rgba(120,90,60,0.4)'; c.lineWidth = 1.2;
    for (let y = 18; y < 102; y += 7) { c.beginPath(); c.moveTo(0, y); c.lineTo(80, y); c.stroke(); }
    if (!red) { c.fillStyle = PAL.ver; c.fillRect(0, 50, 80, 16); }
    const g = c.createRadialGradient(40, 58, 4, 40, 58, 46); g.addColorStop(0, 'rgba(255,240,200,0.55)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = g; c.fillRect(0, 0, 80, 116);
    c.restore();
    if (red) crest(c, 40, 58, 15, PAL.cream);
    c.fillStyle = PAL.ink; c.fillRect(14, 6, 52, 10); c.fillRect(14, 100, 52, 10); c.fillRect(37, 0, 6, 7);
  });
}

/** A shop front on the festival street, wm × hm m: a Taisho elevation painted in colour (brick, wood, plaster, copper)
 *  with dark key lines — a coloured print, not the gold line art of the intro's avenue — dressed for the festival: red
 *  and white bunting (kōhaku maku) over the ground floor and a row of paper lanterns along it. */
const BODIES: [string, string][] = [['#6a2c22', '#2a1e26'], ['#4a2e20', '#221c26'], ['#a89a80', '#2a2630'], ['#3f5f57', '#2f5a50'], ['#5a2430', '#26202a']];
function festivalFront(kind: Arch, wm: number, hm: number, seed: number, sign?: string) {
  const W0 = wm * PXM, H0 = hm * PXM, floors = kind === 'machiya' ? 2 : kind === 'gable' ? 4 : 3, FH = 92;
  const s = (H0 * (kind === 'machiya' ? 0.8 : 0.82)) / (FH * (1.3 + floors - 1));
  return layer(W0, H0, (c, r) => {
    const [body, roof] = kind === 'machiya' ? ['#3a2218', '#1f1c24'] : BODIES[Math.floor(r() * BODIES.length)]!;
    const pal: Palette = { ink: body, ink2: roof, line: '#160b0d', dim: 'rgba(22,11,13,0.6)', win: '#1d1b33', lit: ['#f2c46e', '#e8ae58', '#f6d690', '#eab865'] };
    c.save(); c.scale(s, s);
    const base = H0 / s, w = W0 / s, gh = FH * 1.3;
    elevation(c, 0, base, { kind, w, floors, fh: FH, sign, awning: kind === 'shop' && r() < 0.5, lit: 0.6, pal }, r);
    // the bunting: red and white, scalloped, on a rope, across the top of the ground floor (under the eave on a machiya)
    const by = kind === 'machiya' ? base - gh + 2 : base - gh - 2, bh = 30, sw = 15;
    c.fillStyle = '#120a0c'; c.fillRect(0, by - 2, w, 3);
    for (let x = 0, i = 0; x < w; x += sw, i++) {
      c.fillStyle = i % 2 ? '#efe4cc' : '#c8321e';
      c.beginPath(); c.moveTo(x, by); c.lineTo(x + sw, by); c.lineTo(x + sw, by + bh); c.arc(x + sw / 2, by + bh, sw / 2, 0, Math.PI); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + sw - 2, by, 2, bh); // the folds
    }
    // the paper lanterns along it, lit
    for (let x = 26 + r() * 20; x < w - 20; x += 58) {
      const ly = by + bh + 22, red = r() < 0.6;
      const g = c.createRadialGradient(x, ly, 0, x, ly, 34); g.addColorStop(0, 'rgba(255,190,120,0.55)'); g.addColorStop(1, 'rgba(255,190,120,0)');
      c.fillStyle = g; c.fillRect(x - 34, ly - 34, 68, 68);
      c.fillStyle = '#120a0c'; c.fillRect(x - 0.6, by + bh, 1.2, 10); c.fillRect(x - 6, ly - 12, 12, 3); c.fillRect(x - 6, ly + 10, 12, 3);
      c.fillStyle = red ? '#d8472c' : '#f2e6cc'; c.beginPath(); c.ellipse(x, ly, 8.5, 11, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,236,200,0.5)'; c.beginPath(); c.ellipse(x - 1.5, ly - 1.5, 3.5, 5.5, 0, 0, Math.PI * 2); c.fill();
      if (!red) { c.fillStyle = '#c8321e'; c.fillRect(x - 8.5, ly - 1.5, 17, 3); }
    }
    c.restore();
  }, seed);
}
const FRONT_SIGNS = ['甘味', '呉服', '牛鍋', '玩具', '蕎麦', '薬種', '酒', '小間物', '茶', '煎餅'];

type Banner = { g: THREE.Group; mat: THREE.ShaderMaterial; ph: Phrase; tUp: number; z: number };
type LString = { z: number; tLit: number; mats: THREE.MeshBasicMaterial[]; lamps: THREE.Mesh[]; pool: THREE.MeshBasicMaterial };

export default class Street extends Scene {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(46, W / H, 0.05, 1500);
  t0 = 0; t1 = 0; D = 0; A = 2.2; B = 8.5;
  fronts: { mat: THREE.MeshBasicMaterial; z: number }[] = [];
  crowd: THREE.Mesh[] = [];
  text = new Layer2D();
  back = sheetBack(HERO_B.w, HERO_B.h, HERO_B.seed, HERO_B.o); // the extra the street opens out of (verse1.ts's last frame)
  strings: LString[] = [];
  banners: Banner[] = [];
  miku!: { mesh: THREE.Mesh; cv: HTMLCanvasElement; tex: THREE.CanvasTexture };
  stride!: Integral;
  petals!: THREE.InstancedMesh;
  moon!: THREE.Mesh;

  /** The camera's z at song time t: speed A + B·u² over the pre-chorus (u = 0 → 1), through the torii (z = −D) at t1. */
  private zAt(t: number) {
    const T = this.t1 - this.t0, d = t - this.t0, u = clamp(d / T, 0, 1);
    return -(this.A * d + (this.B * T * u ** 3) / 3 + (d > T ? this.B * (d - T) : 0));
  }
  private speedAt(t: number) { const u = clamp((t - this.t0) / (this.t1 - this.t0), 0, 1); return this.A + this.B * u * u; }
  /** The lantern light on the street at z (0 dark … ~1.2). */
  private lightAt(z: number, t: number) {
    let l = 0;
    for (const s of this.strings) l += this.lit(s, t) * Math.exp(-(((z - s.z) / 7) ** 2));
    return Math.min(1.2, l);
  }
  private lit(s: LString, t: number) { return smoothstep(s.tLit, s.tLit + 0.05, t); }

  override init() {
    const { audio, lyrics } = this.ctx;
    setupRenderer(this.ctx.renderer);
    const P = audio.periodAt(50);
    const pre = audio.sections.find((s) => s.name === ((this.ctx.params.section as string) ?? 'pre1'))!;
    this.t0 = pre.start; this.t1 = pre.end;
    const T = this.t1 - this.t0;
    this.D = this.A * T + (this.B * T) / 3;
    const D = this.D, sc = this.scene;
    sc.fog = new THREE.FogExp2(new THREE.Color('#3a1d3c'), 0.012);
    this.stride = new Integral(this.t0 - 1, this.t1 + 1, (t) => { const v = this.speedAt(t); return v / (2.6 + 0.35 * v); }, 0.002);

    // ---- the sky (a dome with the night gradient and stars), the moon (a card), the far skyline beyond the torii
    sc.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color(PAL.night0) }, uMid: { value: new THREE.Color(PAL.plum) }, uLow: { value: new THREE.Color('#6a3354') } },
      vertexShader: `out vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `layout(location = 0) out highp vec4 outColor; in vec3 vDir; uniform vec3 uTop, uMid, uLow;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 d = normalize(vDir); float h = d.y;
          vec3 c = mix(mix(uLow, uMid, smoothstep(0.0, 0.18, h)), uTop, smoothstep(0.18, 0.6, h));
          vec2 sp = vec2(atan(d.x, d.z), asin(clamp(h, -1.0, 1.0))) * 180.0, cell = floor(sp);
          float r = h21(cell);
          if (r > 0.985 && h > 0.08) c += vec3(1.0, 0.92, 0.85) * 0.5 * smoothstep(0.22, 0.0, length(fract(sp) - 0.5)) * (r - 0.985) / 0.015;
          outColor = vec4(c, 1.0);
        }`,
    })));
    const mt = new THREE.CanvasTexture(layer(800, 800, (c, r) => moonDisc(c, 400, 400, 120, r), 21));
    mt.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: mt, transparent: true, depthWrite: false, fog: false }));
    this.moon.scale.setScalar(453); sc.add(this.moon);
    const farW = 1100, farH = 200, ft = new THREE.CanvasTexture(layer(farW * 2, farH * 2, (c, r) => {
      skyline(c, farW * 2, farH * 2 - 30, r, { fill: '#2c1531', win: 0.1, rim: 'rgba(201,162,74,0.5)', scale: 0.5, tower: farW * 1.18 });
    }, 22));
    ft.colorSpace = THREE.SRGBColorSpace;
    const far = new THREE.Mesh(new THREE.PlaneGeometry(farW, farH), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, fog: false }));
    far.position.set(0, farH / 2 - 14, -D - 520); sc.add(far);

    // ---- the ground: flagstones, and a warm pool of light under each lantern string
    const gt = canvasTex(512, 512, (c, w, h, r) => {
      c.fillStyle = '#0e0a10'; c.fillRect(0, 0, w, h); // dark seams
      for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? -40 : 0; x < w; x += 96 + r() * 40) {
        const v = 40 + r() * 38; c.fillStyle = `rgb(${v},${v * 0.86},${v * 0.98})`; c.fillRect(x + 4, y + 4, 88 + r() * 30, 56);
        c.fillStyle = 'rgba(255,240,220,0.08)'; c.fillRect(x + 4, y + 4, 88, 3); // a lit edge
      }
      for (let i = 0; i < 420; i++) { // fallen petals on the stones
        c.fillStyle = r() < 0.5 ? 'rgba(242,184,198,0.85)' : 'rgba(247,214,222,0.8)';
        c.beginPath(); c.ellipse(r() * w, r() * h, 3 + r() * 3, 2 + r() * 2, r() * 6.3, 0, Math.PI * 2); c.fill();
      }
    }, { repeat: [2, (D + 94) / 5.2], seed: 31 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, D + 94), new THREE.MeshBasicMaterial({ map: gt, color: new THREE.Color(0.55, 0.5, 0.58) }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 14 - (D + 94) / 2); sc.add(ground); // on past the torii, under the gates
    const land = new THREE.Mesh(new THREE.PlaneGeometry(700, 1400), new THREE.MeshBasicMaterial({ color: new THREE.Color('#100a12') }));
    land.rotation.x = -Math.PI / 2; land.position.set(0, -0.03, -D); sc.add(land);
    const poolTex = canvasTex(256, 256, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,190,110,1)'); g.addColorStop(1, 'rgba(255,190,110,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });

    // ---- the shop fronts down both sides (until 8 m before the torii), their signboards
    let si = 0;
    for (const side of [-1, 1]) {
      let z = 16, b = 0;
      while (z > -D + 8) {
        const kinds: Arch[] = ['shop', 'machiya', 'bank', 'machiya', 'mansard', 'shop', 'gable', 'machiya', 'tower', 'dome'];
        const kind = kinds[Math.floor(hash(b, side + 3) * kinds.length)]!;
        const w = kind === 'machiya' ? 5.4 + 1.6 * hash(b, side + 5) : 6.2 + 2.6 * hash(b, side + 5);
        const h = kind === 'machiya' ? 6.8 : kind === 'gable' || kind === 'tower' ? 11 + 2 * hash(b, side + 7) : 9 + 2.4 * hash(b, side + 7);
        const tex = new THREE.CanvasTexture(festivalFront(kind, w, h, 100 + b * 7 + (side + 1) * 50, kind === 'shop' || kind === 'bank' ? FRONT_SIGNS[(b * 3 + side + 4) % FRONT_SIGNS.length] : undefined));
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        const zc = z - w / 2;
        mesh.position.set(side * HALF, h / 2, zc); mesh.rotation.y = -side * Math.PI / 2;
        sc.add(mesh);
        this.fronts.push({ mat, z: zc });
        if (hash(b, side + 9) < 0.75) { // a signboard sticking out over the street
          const s = signboard(SIGNS[si++ % SIGNS.length]!, 300 + si);
          const st = new THREE.CanvasTexture(s.cv); st.colorSpace = THREE.SRGBColorSpace;
          const sm = new THREE.MeshBasicMaterial({ map: st, side: THREE.DoubleSide });
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(s.wm, s.hm), sm);
          sign.position.set(side * (HALF - 0.5), 3.4 + s.hm / 2, zc + w * 0.25);
          sc.add(sign);
          this.fronts.push({ mat: sm, z: zc });
        }
        if (kind === 'machiya') { // its eave, seen from below as a dark band with rafters
          const eave = new THREE.Mesh(new THREE.PlaneGeometry(0.9, w), new THREE.MeshBasicMaterial({ color: new THREE.Color('#120d14') }));
          eave.rotation.x = Math.PI / 2; eave.position.set(side * (HALF - 0.45), 2.66, zc); sc.add(eave);
        }
        z -= w; b++;
      }
    }

    // ---- the lantern strings: every 5 m; each lights on the beat when the camera is ~11 m from it
    const red = new THREE.CanvasTexture(chochin(true)), white = new THREE.CanvasTexture(chochin(false));
    red.colorSpace = white.colorSpace = THREE.SRGBColorSpace;
    const ropeM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#0e080c') });
    for (let z = -8; z > -D + 7; z -= 5) {
      let tl = this.t0;
      while (tl < this.t1 && this.zAt(tl) > z + 11) tl += 0.01;
      tl = Math.max(audio.timeOfBeat(Math.round(audio.beatAt(tl))), audio.timeOfBeat(Math.ceil(audio.beatAt(this.t0 + 0.3))));
      const mats = [new THREE.MeshBasicMaterial({ map: red, alphaTest: 0.5 }), new THREE.MeshBasicMaterial({ map: white, alphaTest: 0.5 })];
      const pts = Array.from({ length: 9 }, (_, i) => { const x = -HALF + (2 * HALF * i) / 8; return new THREE.Vector3(x, 5.7 - 0.75 * (1 - (x / HALF) ** 2), z); });
      sc.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.018, 6), ropeM));
      const lamps: THREE.Mesh[] = [];
      for (let i = 1; i < 8; i++) {
        const x = -HALF + (2 * HALF * i) / 8, y = 5.7 - 0.75 * (1 - (x / HALF) ** 2) - 0.36;
        const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.55), mats[i % 2]!);
        lm.position.set(x, y, z); sc.add(lm); lamps.push(lm);
      }
      const pool = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 7), pool); pm.rotation.x = -Math.PI / 2; pm.position.set(0, 0.02, z); sc.add(pm);
      this.strings.push({ z, tLit: tl, mats, lamps, pool });
    }

    // ---- the torii at the street's end (2×), two stone lanterns, and the tunnel of gates beyond it, fading into the night
    const tg = toriiGeometry(), tm = new THREE.MeshBasicMaterial({ vertexColors: true });
    const great = new THREE.Mesh(tg, tm); great.scale.setScalar(2.0); great.position.set(0, 0, -D); sc.add(great);
    for (let i = 0; i < 26; i++) {
      const gm = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color().setScalar(i % 2 ? 0.62 * 0.96 ** i : 0.96 ** i) });
      const g = new THREE.Mesh(tg, gm); g.position.set(0, 0, -D - 7 - i * 2.2); sc.add(g);
    }
    const treeTex = new THREE.CanvasTexture(layer(900, 900, (c, r) => sakuraTree(c, 450, 900, 230, -Math.PI / 2, r, { ink: '#170c14', spread: 1.3, bloom: 2.0, depth: 6 }), 41));
    treeTex.colorSpace = THREE.SRGBColorSpace;
    for (const x of [-7.2, 7.2]) {
      const tr = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ map: treeTex, alphaTest: 0.5, side: THREE.DoubleSide }));
      tr.position.set(x, 5.5, -D + 3.5); sc.add(tr);
      this.fronts.push({ mat: tr.material as THREE.MeshBasicMaterial, z: -D + 3.5 });
    }
    const toro = new THREE.CanvasTexture(layer(200, 360, (c) => { // a stone lantern, its fire box lit
      c.fillStyle = '#2a2430'; c.fillRect(70, 300, 60, 60); c.fillRect(85, 200, 30, 100); c.fillRect(55, 185, 90, 18);
      c.fillStyle = '#ffd27a'; c.fillRect(70, 120, 60, 62); c.fillStyle = '#2a2430'; c.fillRect(96, 120, 8, 62);
      c.beginPath(); c.moveTo(30, 122); c.lineTo(100, 70); c.lineTo(170, 122); c.closePath(); c.fill(); c.fillRect(92, 45, 16, 28);
      c.strokeStyle = PAL.gold; c.lineWidth = 2; c.strokeRect(70, 120, 60, 62);
    }));
    toro.colorSpace = THREE.SRGBColorSpace;
    for (const x of [-3.6, 3.6]) {
      const tl = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.25), new THREE.MeshBasicMaterial({ map: toro, alphaTest: 0.5, side: THREE.DoubleSide }));
      tl.position.set(x, 1.125, -D + 2.4); sc.add(tl);
    }

    // ---- the lyric banners (nobori): each phrase of the lines sung here, rising beside the street as it is sung
    const vOn = audio.events('vocal', 0, audio.duration + 1).map(([t]) => t);
    const g0 = audio.beats[0]!, q16 = P / 4, snap16 = (t: number) => g0 + Math.round((t - g0) / q16) * q16;
    let side = -1;
    for (const l of lyrics.lines.filter((x) => x.start >= this.t0 - 0.3 && x.start < this.t1 - 0.3)) {
      for (const ph of phraseTimes(l, vOn, snap16)) {
        const n = Math.min(12, [...ph.text].length), last = ph.ct[n - 1]!;
        const z = Math.max(-D + 5, Math.min(this.zAt(last + 0.9), this.zAt(ph.t) - 9));
        this.banners.push(this.makeBanner(ph, n, side, z));
        side = -side;
      }
    }

    // ---- the festival crowd along both pavements: Taisho passers-by standing and watching, some with paper lanterns, lit
    // warm by the lanterns (cards facing the camera)
    const kinds2 = ['gent', 'hakama', 'parasol', 'student', 'child', 'hakama', 'gent', 'parasol', 'student'];
    for (let i = 0; i < 36; i++) {
      const sideP = i % 2 ? 1 : -1, z = 6 - ((i + 0.5) / 36) * (D - 14) + (hash(i, 61) - 0.5) * 3, x = sideP * (3.95 + 0.7 * hash(i, 62));
      const pair = hash(i, 63) < 0.3, kind = kinds2[i % kinds2.length]!, dir = hash(i, 64) < 0.5 ? -1 : 1, lantern = hash(i, 65) < 0.4;
      const PPM = 224, cw = pair ? 480 : 320, ch = 440;
      const cv = layer(cw, ch, (c) => {
        walker(c, kind, pair ? 140 : cw / 2, 430, kind === 'child' ? 220 : 370, 0.15 * hash(i, 66), dir, { line: 'rgba(255,196,130,0.75)', px: 2, lantern });
        if (pair) walker(c, hash(i, 67) < 0.5 ? 'child' : 'hakama', 330, 430, hash(i, 67) < 0.5 ? 220 : 350, 0.1, -dir, { line: 'rgba(255,196,130,0.75)', px: 2, lantern: !lantern });
      }, 700 + i);
      const tex2 = new THREE.CanvasTexture(cv); tex2.colorSpace = THREE.SRGBColorSpace; tex2.anisotropy = 8;
      const mat = new THREE.MeshBasicMaterial({ map: tex2, transparent: true, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(cw / PPM, ch / PPM), mat);
      m.position.set(x, ch / PPM / 2 - 0.045, z); sc.add(m);
      this.crowd.push(m); this.fronts.push({ mat, z });
    }

    // ---- Miku, running ahead (redrawn every frame), and the petals
    const cv = document.createElement('canvas'); cv.width = 600; cv.height = 1200;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    sc.add(mesh);
    this.miku = { mesh, cv, tex };
    this.petals = this.makePetals(); sc.add(this.petals);
  }

  private makeBanner(ph: Phrase, n: number, side: number, z: number): Banner {
    const wm = 0.86, hm = 3.5, k = 150, top = 0.72, step = Math.min(0.37, (hm - top - 0.18) / n), size = step / 1.06;
    const cloth = new THREE.CanvasTexture(layer(wm * k, hm * k, (c, r) => {
      c.fillStyle = PAL.cream; c.fillRect(0, 0, wm * k, hm * k);
      for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(120,90,60,${0.03 + 0.04 * r()})`; c.fillRect(r() * wm * k, r() * hm * k, 1 + r() * 3, 0.8); }
      c.fillStyle = PAL.ver; c.fillRect(0, 0, wm * k, 0.55 * k);
      crest(c, (wm * k) / 2, 0.27 * k, 0.17 * k, PAL.gold2);
      c.fillStyle = PAL.ver; c.fillRect(0, hm * k - 0.09 * k, wm * k, 0.09 * k);
      c.fillStyle = PAL.ink; for (let y = 0.7; y < hm - 0.1; y += 0.45) c.fillRect(side < 0 ? 0 : wm * k - 0.05 * k, y * k, 0.05 * k, 0.1 * k); // the ties to the pole
    }, 400 + Math.round(z)));
    const glyph = new THREE.CanvasTexture(layer(wm * k, hm * k, (c) => {
      c.fillStyle = '#fff'; c.font = `${size * k}px ${SERIF900}`;
      drawColumn(c, [...ph.text].slice(0, n).join(''), (wm * k) / 2 + 0.03 * k, top * k, size * k, () => 1);
    }));
    cloth.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
      uniforms: { uCloth: { value: cloth }, uGlyph: { value: glyph }, uAge: { value: new Array(12).fill(-1) }, uN: { value: n }, uY0: { value: top / hm }, uStep: { value: step / hm }, uT: { value: 0 }, uLight: { value: 1 }, uPole: { value: side < 0 ? 0 : 1 } },
      vertexShader: /* glsl */ `
        uniform float uT, uPole; out vec2 vUv;
        void main() {
          vec3 p = position; float k = abs(uv.x - uPole); // 0 at the pole, 1 at the free edge
          p.z += (0.07 * sin(p.y * 2.2 - uT * 3.4) + 0.025 * sin(p.y * 5.3 - uT * 5.1)) * k;
          vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        layout(location = 0) out highp vec4 outColor;
        in vec2 vUv; uniform sampler2D uCloth, uGlyph; uniform float uAge[12]; uniform int uN; uniform float uY0, uStep, uLight;
        void main() {
          vec3 col = texture(uCloth, vUv).rgb * uLight;
          int j = int(floor((1.0 - vUv.y - uY0) / uStep));
          if (j >= 0 && j < uN) {
            float age = uAge[j], a = texture(uGlyph, vUv).a * smoothstep(0.0, 0.05, age);
            vec3 ink = mix(vec3(2.4, 0.4, 0.14), vec3(0.012, 0.006, 0.008), smoothstep(0.04, 0.32, age)); // a vermilion flash, then ink
            col = mix(col, ink, a);
          }
          outColor = vec4(col, 1.0);
        }`,
    });
    const g = new THREE.Group();
    const cloth3 = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), mat), dir = -side; // the cloth hangs toward the street's middle
    cloth3.position.set(dir * (wm / 2 + 0.04), 0.42 + hm / 2, 0); g.add(cloth3);
    const wood = new THREE.MeshBasicMaterial({ color: new THREE.Color('#1a0f0c') });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 4.5, 8), wood); pole.position.set(0, 2.25, 0); g.add(pole);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, wm + 0.1, 6), wood); rod.rotation.z = Math.PI / 2; rod.position.set(dir * (wm / 2 + 0.04), 0.42 + hm + 0.02, 0); g.add(rod);
    // beside the street, the cloth on the street side of its pole, turned a little toward the camera
    g.position.set(side * 3.55, 0, z); g.rotation.y = -side * 0.32;
    g.scale.y = 0; this.scene.add(g);
    return { g, mat, ph, tUp: ph.t - 0.14, z };
  }

  private makePetals() {
    const N = 2600, geo = new THREE.PlaneGeometry(1, 1);
    const a = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) a.set([hash(i, 1), hash(i, 2), hash(i, 3), hash(i, 4)], i * 4);
    geo.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4));
    const m = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uCamZ: { value: 0 }, uPink: { value: new THREE.Color(PAL.sakura) }, uPale: { value: new THREE.Color(PAL.sakura2) } },
      vertexShader: /* glsl */ `
        in vec4 aA; uniform float uT, uCamZ; out vec2 vUv; out float vK;
        mat3 rx(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
        mat3 ry(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
        void main() {
          float T = uT * (0.7 + 0.6 * aA.w);
          vec3 p = vec3((aA.x * 2.0 - 1.0) * 5.0, 0.2 + aA.y * 6.5, -aA.z * 40.0) + vec3(0.25, -0.55, 0.9) * T;
          p.x += 0.4 * sin(uT * (0.8 + aA.y) + aA.w * 6.3);
          p.x = -5.0 + mod(p.x + 5.0, 10.0); p.y = 0.2 + mod(p.y - 0.2, 6.5);
          p.z = uCamZ + 3.0 - mod(uCamZ + 3.0 - p.z, 40.0);
          float sz = 0.07 * (0.7 + 0.6 * aA.x) * smoothstep(uCamZ - 39.0, uCamZ - 33.0, p.z);
          mat3 R = rx(uT * (1.3 + 2.0 * aA.w) + aA.x * 6.0) * ry(uT * (1.0 + 1.5 * aA.y) + aA.z * 6.0);
          vec4 mv = viewMatrix * vec4(p + R * (position * vec3(0.8, 1.0, 1.0) * sz), 1.0);
          vUv = uv; vK = aA.y; gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        layout(location = 0) out highp vec4 outColor; in vec2 vUv; in float vK; uniform vec3 uPink, uPale;
        void main() {
          vec2 q = vUv * 2.0 - 1.0; float w = 0.62 * (0.3 + 0.7 * smoothstep(-1.0, 0.1, q.y));
          if ((q.x * q.x) / (w * w) + q.y * q.y > 1.0 || (q.y > 0.74 && abs(q.x) < (q.y - 0.74) * 0.6)) discard;
          outColor = vec4(mix(uPink, uPale, vK) * 0.9, 1.0);
        }`,
    }), N);
    m.frustumCulled = false;
    return m;
  }

  override cues(): Cue[] {
    const out: Cue[] = this.strings.map((s) => ({ t: s.tLit, name: 'a lantern string lights', on: 'beat' as const }));
    for (const b of this.banners) out.push({ t: b.ph.t, name: 'a lyric banner rises', on: 'vocal' as const });
    out.push({ t: this.t1, name: 'through the torii (cut to the tunnel)', on: 'downbeat' });
    return out;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx, t = f.t, cam = this.cam;
    const z = this.zAt(t), sp = clamp((this.speedAt(t) - this.A) / this.B), last = smoothstep(this.t1 - 1.6, this.t1, t);
    // ---- the camera: eye height with a footfall bob, rising a little into the torii; wider as it speeds up
    const bob = 0.035 * Math.abs(Math.sin(f.beat * Math.PI)) * (1 - last);
    cam.position.set(0.25 * Math.sin(t * 0.5) * (1 - last), 1.62 + bob + 0.4 * ease.inOutCubic(last), z);
    cam.up.set(0, 1, 0);
    cam.lookAt(0.1 * Math.sin(t * 0.37), 2.55 - 0.5 * last, z - 16);
    const hh = handheld(t, 0.0025, 0.35, 5);
    cam.rotateZ(hh[2] + 0.02 * Math.sin(t * 0.6) * (1 - last)); cam.rotateY(hh[0]); cam.rotateX(hh[1]);
    const fov = 46 + 16 * sp * sp;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld(true);
    this.moon.position.copy(cam.position).addScaledVector(MOON, 1000); this.moon.quaternion.copy(cam.quaternion);

    // ---- lanterns: lit on their beat (a flash as each catches), breathing with the snare
    const flare = 1 + 0.5 * f.a.snare;
    for (const s of this.strings) {
      const l = this.lit(s, t), catchF = t >= s.tLit ? Math.exp(-(t - s.tLit) / 0.12) : 0;
      const v = lerp(0.32, 2.3 * flare, l) * (1 + 1.4 * catchF);
      for (const m of s.mats) m.color.setScalar(v);
      for (const lm of s.lamps) lm.quaternion.copy(cam.quaternion);
      s.pool.opacity = 0.2 * l * (1 + catchF);
    }
    for (const fr of this.fronts) fr.mat.color.setScalar(0.55 + 0.5 * this.lightAt(fr.z, t));
    for (const m of this.crowd) m.rotation.set(0, Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z), 0);
    // ---- the banners rise as their phrase begins (a spring), each glyph inks in as it is sung
    for (const b of this.banners) {
      const u = clamp((t - b.tUp) / 0.42);
      b.g.scale.y = u <= 0 ? 0 : ease.outBack(u);
      b.g.visible = u > 0;
      const ages = b.mat.uniforms.uAge!.value as number[];
      b.ph.ct.forEach((ct, j) => { if (j < 12) ages[j] = t - ct; });
      b.mat.uniforms.uT!.value = t; b.mat.uniforms.uLight!.value = 0.72 + 0.35 * this.lightAt(b.z, t);
    }
    // ---- Miku, 7 m ahead and a little right of the middle, running faster as the camera does
    const mz = z - lerp(7, 6, sp), mc = this.miku;
    mc.mesh.position.set(1.05, 1.2, mz); mc.mesh.rotation.set(0, Math.atan2(cam.position.x - 1.05, cam.position.z - mz), 0);
    const c = mc.cv.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 600, 1200);
    c.setTransform(1.5, 0, 0, 1.5, 0, 0);
    mikuRunning(c, 200, 790, 525, this.stride.at(t) * Math.PI * 2, sp);
    mc.tex.needsUpdate = true;
    const pu = (this.petals.material as THREE.ShaderMaterial).uniforms;
    pu.uT!.value = t; pu.uCamZ!.value = z;

    renderer.setRenderTarget(out);
    renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
    renderer.render(this.scene, cam);
    // the extra it opens out of (verse1.ts's last frame: the sheet's back filling the frame) flies off, and the gold frame
    const o = this.text.ctx; this.text.clear();
    const u = (t - this.t0) / 0.4;
    if (u < 1) {
      // (the first frame is still all paper, then it flies away)
      const e = ease.inOutCubic(clamp(u)), s = lerp(3.6, 0.22, e), turn = Math.cos(Math.PI * 0.5 * e);
      o.save(); o.translate(lerp(W / 2, -260, e), lerp(H / 2, -200, e)); o.rotate(-1.3 * e); o.scale(s * Math.max(0.06, turn), s);
      o.drawImage(this.back, -HERO_B.w / 2, -HERO_B.h / 2, HERO_B.w, HERO_B.h); o.restore();
    }
    decoFrame(o, W, H);
    this.ctx.comp.draw(renderer, this.text.upload(), out);
    return { bloom: 0.7, halation: 0.3, ca: 0.35, grain: 0.045, vignette: 0.42, shoulder: 1, grade: 0.2 };
  }
}
