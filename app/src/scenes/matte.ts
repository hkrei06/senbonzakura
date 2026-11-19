// 2.5D matte plates: a Cycles still of a Blender set and its depth (blender/matte.py → assets/blender/matte_<name>/),
// lifted into a relief mesh (every vertex at its own distance, with the still's lens) that the engine's camera moves
// through: real parallax (near trees slide over the far ridges) at the engine's speed, the Cycles look kept. Petals fall
// in front of and among it in real metres (hidden behind whatever is nearer, by the depth), the lyric columns and the
// gold frame over it. The user's call (2026-10-26): the outside shots this way instead of Cycles frame by frame.
// Timeline params: { matte: 'reveal', move: { dolly, rise, side (m), tilt, pan, roll (deg), zoom }, petals: [near, far],
// exposure, carry, run }. run: the still's points (matte.json, e.g. the line's lamps bottom to top, the last one the
// shrine) lit over the relief, a front of light running up them from every downbeat.
// Keep the moves small (a few metres): a relief has nothing behind its near edges, so a long move smears them; zoom
// (no parallax) carries the rest of a push.
import * as THREE from 'three';
import { Scene, type Cue, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W } from '../engine/gl';
import { renderInto } from '../engine/world';
import { ease, mulberry32, shutterT } from '../engine/util';
import { decoFrame } from './taisho';
import { BLENDER_LOOK, LyricColumns } from './columns';

type Meta = { lens: number; sensor: number; res: [number, number]; overscan: number; near: number; points?: [number, number, number][] };

/** A soft round glow (for the lights run over the relief). */
function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!, g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
type Move = { dolly?: number; rise?: number; side?: number; tilt?: number; pan?: number; roll?: number; zoom?: number };

const GW = 384, GH = 216; // the relief's grid (quads across, down)
const FAR = 8000; // m: the sky's distance (depth code 0)

async function bitmap(url: string) {
  const r = await fetch(url);
  if (!r.ok || !(r.headers.get('content-type') ?? '').includes('image')) throw new Error(`matte: missing ${url} (render blender/matte.py)`);
  return createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}

/** A sakura petal's silhouette (alpha) for the falling petals; soft: out of focus (the near ones). */
function petalTexture(soft = false) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  if (soft) c.filter = 'blur(7px)';
  const g = c.createRadialGradient(32, 44, 2, 32, 34, 30);
  g.addColorStop(0, '#f7c2d2'); g.addColorStop(1, '#fde8ef');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(32, 60);
  c.bezierCurveTo(6, 44, 8, 14, 22, 6);
  c.lineTo(32, 14);
  c.lineTo(42, 6);
  c.bezierCurveTo(56, 14, 58, 44, 32, 60);
  c.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default class Matte extends Scene {
  text = new Layer2D();
  columns!: LyricColumns;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.3, FAR * 1.5);
  move: Move = {};
  petals: THREE.InstancedMesh[] = [];
  seeds: Float32Array = new Float32Array(0);
  fov0 = 40;
  run: THREE.Points | null = null;

  override async init() {
    const name = this.ctx.params.matte as string, base = `/assets/blender/matte_${name}`;
    const r = await fetch(`${base}/matte.json`);
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error(`matte: no still for ${name} (blender/matte.py --matte ${name})`);
    const meta = (await r.json()) as Meta;
    this.move = (this.ctx.params.move ?? {}) as Move;
    const [colorBmp, depthBmp] = await Promise.all([bitmap(`${base}/color.png`), bitmap(`${base}/depth.png`)]);
    // the depth, 16 bits as R (high) and G (low): inverse depth near / z
    const dw = depthBmp.width, dh = depthBmp.height;
    const cv = document.createElement('canvas');
    cv.width = dw; cv.height = dh;
    const cx = cv.getContext('2d', { willReadFrequently: true })!;
    cx.drawImage(depthBmp, 0, 0);
    const px = cx.getImageData(0, 0, dw, dh).data;
    const depthAt = (u: number, v: number) => {
      const x = Math.min(dw - 1, Math.max(0, Math.round(u * (dw - 1)))), y = Math.min(dh - 1, Math.max(0, Math.round((1 - v) * (dh - 1))));
      const o = (y * dw + x) * 4, code = px[o]! * 256 + px[o + 1]!;
      return code > 0 ? Math.min(FAR, meta.near / (code / 65535)) : FAR;
    };
    // the relief: each vertex back along its pixel's ray to its depth (Blender's camera: sensor fit horizontal)
    const tanH = meta.sensor / 2 / meta.lens, tanV = tanH * (meta.res[1] / meta.res[0]);
    const geo = new THREE.PlaneGeometry(1, 1, GW, GH);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute, uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i), v = uv.getY(i), z = depthAt(u, v);
      pos.setXYZ(i, (2 * u - 1) * tanH * z, (2 * v - 1) * tanV * z, -z);
    }
    geo.computeBoundingSphere();
    const tex = new THREE.Texture(colorBmp as unknown as HTMLImageElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    // (ImageBitmaps are not flipped on upload: the rows come top first, so the UVs flip instead)
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false });
    this.scene.add(new THREE.Mesh(geo, mat));
    // the frame shows the still's middle (it was rendered `overscan` times wider)
    this.cam.fov = this.fov0 = (2 * Math.atan(tanV / meta.overscan) * 180) / Math.PI;
    this.cam.aspect = this.ctx.W / this.ctx.H;
    this.cam.rotation.order = 'YXZ';
    this.cam.updateProjectionMatrix();
    // petals in real metres in front of the lens, falling and drifting (seeded: the same every render)
    // two sets: near ones out of focus (soft, dim, larger: the lens is focused on the mountain), the rest sharp and small
    const counts = (this.ctx.params.petals as [number, number] | undefined) ?? [40, 320];
    const n = Math.max(...counts);
    if (n > 0) {
      const pg = new THREE.PlaneGeometry(0.05, 0.05);
      const near = new THREE.MeshBasicMaterial({ map: petalTexture(true), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        color: new THREE.Color(0.34, 0.24, 0.3), opacity: 0.75 });
      const far = new THREE.MeshBasicMaterial({ map: petalTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, toneMapped: false,
        color: new THREE.Color(0.42, 0.32, 0.38) });
      for (const [k, m] of [near, far].entries()) {
        const im = new THREE.InstancedMesh(pg, m, counts[k]!);
        im.frustumCulled = false;
        this.petals.push(im);
        this.scene.add(im);
      }
      const rnd = mulberry32(2610);
      this.seeds = new Float32Array(n * 2 * 8);
      for (let i = 0; i < this.seeds.length; i++) this.seeds[i] = rnd();
    }
    if (this.ctx.params.run && meta.points?.length) { // the lights run over the relief (hidden by whatever is nearer)
      const pts = meta.points, g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pts.length * 3), 3));
      const m = new THREE.PointsMaterial({ size: 16, sizeAttenuation: false, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      this.run = new THREE.Points(g, m);
      this.run.frustumCulled = false;
      this.scene.add(this.run);
    }
    this.columns = new LyricColumns(this.ctx, !!this.ctx.params.carry);
  }

  /** The lights: run: 'line' (or true), a front from the first point to the last (the shrine) over the first three beats
   *  of every bar; 'pulse', all of them flaring on every beat (lanterns breathing with the band). */
  private runAt(t: number) {
    if (!this.run) return;
    const col = this.run.geometry.getAttribute('color') as THREE.BufferAttribute, n = col.count - 1, A = this.ctx.audio;
    const beats = A.beatAt(t) - A.beatAt(this.ctx.start), pulse = this.ctx.params.run === 'pulse';
    const f = ((beats / 4) % 1) * 1.35 - 0.12; // the front's place along the line, 0 … 1
    for (let i = 0; i <= n; i++) {
      const k = pulse ? 0.25 + 0.75 * Math.exp(-(beats - Math.floor(beats)) / 0.22)
        : i === n ? 0.9 + 1.2 * Math.exp(-(((f - 1) * 7) ** 2)) : 0.07 + 1.3 * Math.exp(-(((i / n - f) * 11) ** 2));
      col.setXYZ(i, k, 0.6 * k, 0.3 * k);
    }
    col.needsUpdate = true;
  }

  override cues(): Cue[] {
    return [{ t: this.ctx.start, name: `cut to the matte ${this.ctx.params.matte}`, on: 'downbeat' }];
  }

  private place(t: number) {
    const m = this.move, k = Math.min(1, Math.max(0, (t - this.ctx.start) / (this.ctx.end - this.ctx.start)));
    const e = ease.inOutQuad(k), d = Math.PI / 180;
    this.cam.position.set((m.side ?? 0) * e, (m.rise ?? 0) * e, -(m.dolly ?? 0) * e);
    this.cam.rotation.set((m.tilt ?? 0) * d * e, (m.pan ?? 0) * d * e, (m.roll ?? 0) * d * e);
    this.cam.fov = this.fov0 / (1 + ((m.zoom ?? 1) - 1) * e);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
  }

  private petalsAt(t: number) {
    const lt = t - this.ctx.start, s = this.seeds, o = new THREE.Object3D(), reach = this.move.dolly ?? 0;
    this.petals.forEach((im, set) => {
    const n = im.count;
    for (let i = 0; i < n; i++) {
      const r = (k: number) => s[(set * n + i) * 8 + k]!;
      // near set: 1.5-6 m from the lens (all through the push); far set: 6-45 m
      const z = set === 0 ? -(1.5 + (4.5 + reach) * r(2)) : -(6 + reach + 39 * r(2));
      const span = 0.6 * -z; // the box widens with the distance (the frustum)
      const fall = 0.5 + 0.9 * r(3), drift = 0.6 + 0.8 * r(4);
      const y = span * 0.6 - (((span * 1.2) * (1 - r(1)) + fall * lt) % (span * 1.2));
      const x = -span + ((span * 2 * r(0) - drift * lt + span * 4) % (span * 2));
      o.position.set(x + 0.2 * Math.sin(lt * 1.7 + r(5) * 6.3), y, z);
      o.rotation.set(r(5) * 6.3 + lt * (1 + 2 * r(6)), r(6) * 6.3 + lt * (0.7 + r(7)), r(7) * 6.3);
      o.scale.setScalar((0.7 + 0.9 * r(1)) * (set === 0 ? 1.7 : 0.85));
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const t = shutterT(f.t, 1), { renderer, comp } = this.ctx;
    this.place(t);
    this.petalsAt(t);
    this.runAt(t);
    renderInto(renderer, this.scene, this.cam, out, new THREE.Color(0, 0, 0));
    this.text.clear();
    this.columns.draw(this.text.ctx, shutterT(f.t, 0));
    decoFrame(this.text.ctx, W, this.ctx.H);
    comp.draw(renderer, this.text.upload(), out);
    return { ...BLENDER_LOOK, exposure: (this.ctx.params.exposure as number | undefined) ?? 1 };
  }
}
