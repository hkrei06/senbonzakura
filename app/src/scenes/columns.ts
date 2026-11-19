// The lyric columns of the Blender shots (tunnel.ts plates, matte.ts reliefs): set at the right as torii.ts sets
// them, every character on its own sung time; a line clears (slides 40 px left, fades in 120 ms) before the next.
// carry: pick up a line still being sung across the cut from the shot before (only from another Blender shot: the
// festival street sets its lines as banners). A chorus's title phrase is the 3D title in the tunnel's plate, so it is
// skipped (in the shot that holds the stop bar, and in a line carried on from it).
import type { SceneCtx } from '../engine/scene';
import type { Line } from '../engine/lyrics';
import { W } from '../engine/gl';
import { F, font } from '../engine/type';
import { rgba } from '../engine/palette';
import { clamp, ease, smoothstep } from '../engine/util';
import { drawColumn, phraseTimes, type Phrase } from './torii';

export class LyricColumns {
  lines: { l: Line; ph: Phrase[]; title: boolean }[] = [];

  /** tFull: the band's return after the stop bar when this shot holds it (0 if not). */
  constructor(private ctx: SceneCtx, carry: boolean, tFull = 0) {
    const audio = ctx.audio;
    const vOn = audio.events('vocal', 0, audio.duration + 1).map(([t]) => t);
    const g0 = audio.beats[0]!, q16 = audio.periodAt(60) / 4, snap16 = (t: number) => g0 + Math.round((t - g0) / q16) * q16;
    for (const l of ctx.lyrics.lines.filter((x) => (carry ? x.end > ctx.start : x.start >= ctx.start - 0.3) && x.start < ctx.end - 0.3)) {
      const title = tFull ? l.start < tFull - 0.1 : l.start < ctx.start && this.titleLine(l);
      this.lines.push({ l, ph: phraseTimes(l, vOn, snap16), title });
    }
  }

  /** A line sung from a chorus's stop bar: its first phrase was the shot's 3D title. */
  private titleLine(l: Line): boolean {
    const audio = this.ctx.audio, kL = Math.floor(audio.barAt(l.start) + 1e-6);
    const ch = audio.sections.find((s) => s.name.startsWith('chorus') && Math.abs(s.start - audio.timeOfBar(kL)) < 0.05);
    return !!ch && l.start < audio.timeOfBar(kL + 1);
  }

  draw(c: CanvasRenderingContext2D, tt: number) {
    const size = 62, x0 = W - 136, step = 92, y0 = 124;
    const state = this.lines.map(({ l, ph, title }, li) => {
      const next = this.lines[li + 1]?.l.start ?? Infinity;
      const gone = Math.min(next - 0.03, l.end + 0.9);
      const o = smoothstep(gone - 0.12, gone, tt);
      const shown = title ? ph.slice(1) : ph;
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
        // a rule beside the column, drawn down with it
        const len = p.ct.reduce((a, ct) => a + ease.outCubic(clamp((tt - ct) / 0.11)), 0) * size * 1.06;
        c.fillStyle = rgba('bone', 0.55 * fade);
        c.fillRect(x + size * 0.62, y0 + 4, 2, len);
      });
    });
    c.shadowBlur = 0;
  }
}

/** The film look over a Blender image (tone-mapped already in AgX: no shoulder), as the torii scenes have it. */
export const BLENDER_LOOK = { bloom: 0.5, halation: 0.24, ca: 0.5, grain: 0.04, vignette: 0.38, shoulder: 0, grade: 0.3 };
