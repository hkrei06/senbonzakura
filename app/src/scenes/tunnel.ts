// 千本鳥居 in Cycles: the chorus's Blender shots (blender/shots_chorus.py, rendered by tools/blender/render.py into
// assets/blender/<shot>/) as plates, with the engine's lyric columns (columns.ts) and the design system's gold frame.
// Timeline params: { shot: 'tunnel_entry', title: true } (title: this shot holds the chorus's stop bar and its 3D
// title, which the columns skip); carry: true picks up a line still being sung across the cut from the shot before;
// captions: [role, name][] set one after another at the lower left over the shot (the credits, as their gates pass).
import { PlateScene, type PlateOptions } from '../library/kit/plate';
import { Layer2D, W } from '../engine/gl';
import type { Cue, Frame, PostOverrides } from '../engine/scene';
import type * as THREE from 'three';
import { clamp, shutterT } from '../engine/util';
import { PAL, SERIF900, decoFrame } from './taisho';
import { BLENDER_LOOK, LyricColumns } from './columns';

type Manifest = { fps: number; formats: Record<string, { first: number; last: number; count: number; missing: number[] }> };

export default class Tunnel extends PlateScene {
  text = new Layer2D();
  columns!: LyricColumns;
  manifest!: Manifest;
  tFull = 0;
  tBurst = 0;

  protected override plateOptions(): PlateOptions {
    const shot = this.ctx.params.shot as string, m = this.manifest, png = m.formats.png!;
    return { src: `/assets/blender/${shot}/####.png`, fps: m.fps, first: png.first, last: png.last, at: png.first / m.fps };
  }

  override async init() {
    const shot = this.ctx.params.shot as string;
    const r = await fetch(`/assets/blender/${shot}/frames.json`);
    // (a missing file comes back as the app's index.html, not a 404)
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error(`tunnel: no rendered frames for ${shot} (render blender/shots_chorus.py --shot ${shot})`);
    this.manifest = await r.json();
    const png = this.manifest.formats.png;
    if (!png || png.missing.length) throw new Error(`tunnel: ${shot} has missing frames (${png?.missing.slice(0, 5).join(', ')})`);
    await super.init();
    const audio = this.ctx.audio;
    // the stop bar: the chorus's first bar; its line's first phrase is the title in the plate
    if (this.ctx.params.title) this.tFull = audio.timeOfBar(Math.round(audio.barAt(this.ctx.start)) + 1);
    this.columns = new LyricColumns(this.ctx, !!this.ctx.params.carry, this.tFull);
    const tl = this.tFull ? this.columns.lines.find((x) => x.title) : undefined;
    if (tl) {
      const last = tl.ph[0]!.ct[tl.ph[0]!.ct.length - 1]!;
      this.tBurst = audio.timeOfBeat(Math.ceil(audio.beatAt(Math.max(this.tFull, last + 0.35)) - 1e-6));
    }
  }

  override cues(): Cue[] {
    const out: Cue[] = [{ t: this.ctx.start, name: `cut to the Blender plate ${this.ctx.params.shot}`, on: 'downbeat' }];
    if (this.tFull) out.push({ t: this.tFull, name: 'surge: the band is back, the title flares', on: 'downbeat' });
    if (this.tBurst) out.push({ t: this.tBurst, name: 'the title bursts into petals (in the plate)', on: 'beat' });
    return out;
  }

  protected override overlay(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const t = f.t, { renderer, comp } = this.ctx;
    this.text.clear();
    this.columns.draw(this.text.ctx, shutterT(t, 0));
    const caps = this.ctx.params.captions as [string, string][] | undefined;
    if (caps?.length) { // each caption for its share of the shot (as its gate comes up), faded in and out
      const c = this.text.ctx, span = (this.ctx.end - this.ctx.start) / (caps.length + 0.4), k = Math.floor((t - this.ctx.start) / span - 0.2);
      if (k >= 0 && k < caps.length) {
        const u = (t - this.ctx.start) / span - 0.2 - k, a = clamp(u / 0.12) * clamp((0.94 - u) / 0.12), [role, name] = caps[k]!;
        c.save(); c.globalAlpha = a; c.textBaseline = 'alphabetic'; c.shadowColor = 'rgba(10,6,8,0.85)'; c.shadowBlur = 10;
        c.fillStyle = PAL.gold2; c.font = `26px "Cormorant-600", ${SERIF900}`; c.fillText(role, 120, this.ctx.H - 168);
        c.fillStyle = PAL.cream; c.font = `44px "Cormorant-600", ${SERIF900}`; c.fillText(name, 120, this.ctx.H - 118);
        c.restore();
      }
    }
    decoFrame(this.text.ctx, W, this.ctx.H);
    comp.draw(renderer, this.text.upload(), out);
    const kick = (k: number, rel: number) => (t >= k ? Math.exp(-(t - k) / rel) : 0);
    return {
      ...BLENDER_LOOK,
      zoom: 1 + 0.02 * kick(this.ctx.start, 0.12) + (this.tFull ? 0.035 * kick(this.tFull, 0.15) : 0) + (this.tBurst ? 0.03 * kick(this.tBurst, 0.12) : 0),
    };
  }
}
