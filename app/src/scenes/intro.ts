// The intro's poster worlds, animated (docs/TREATMENT.md, Direction v3), each four bars, cut on the phrase downbeats:
//   title    0 → bar 5: black; the gold frame draws itself in the silence; on the hit before bar 1 the moon ignites, on
//            bar 1 (the band) the branch and the waves sweep in; 千 本 桜 stamp on the beats of bar 2, the seal on bar 3
//            (the riser's end); the camera pushes into the moon
//   skyline  bar 5 → 9: a match cut on the moon (the same disc, zoomed), pulling back to the city; the tower lights floor
//            by floor on the beats, a train crosses on the viaduct; a tram sweeps across the lens (the wipe)
//   avenue   bar 9 → 13: behind the tram, a gas-lamp avenue: the lamps light on the beats, Taisho pedestrians, a passer-by
//            close to the lens; a whip tilt up
//   rooftop  bar 13 → 17: the tilt lands on Miku saluting on a roof ridge before a huge moon, the wind in her tails; on
//            bar 16 she crouches and leaps across the moon, a gust of petals, cut to the great gate (torii.ts)
import { W, H } from '../engine/gl';
import { clamp, ease, hash, lerp, mulberry32, smoothstep } from '../engine/util';
import {
  PAL, SERIF900, SERIF600, layer, washi, decoFrame, crest, moonDisc, seigaiha, skyline, sakuraTree, sealStamp, sakuraFlower,
  mikuStanding, mikuLeap, facade, withGlow, petalStorm, type Kind,
} from './taisho';
import { nightSky, glowDot, gasLamp, tram } from './worlds';
import { ARCH, elevation, halftoneSprite, dotScreen, withOutline, type Kind as Arch } from './taisho-arch';
import type { Build } from './poster';

type C = CanvasRenderingContext2D;

/** A petal clock: t, plus the extra drift of a gust at each of `at` (amount × τ seconds of drift each, easing in). */
const gusts = (at: number[], amount = 2.2, tau = 0.45) => (t: number) => at.reduce((s, k) => s + (t > k ? amount * tau * (1 - Math.exp(-(t - k) / tau)) : 0), t);
/** The gold frame, drawn in from its four corners (u 0 → 1). */
function frameIn(c: C, u: number) {
  if (u <= 0) return;
  if (u >= 1) { decoFrame(c, W, H); return; }
  const rw = (W / 2) * u + 60, rh = (H / 2) * u + 60;
  c.save(); c.beginPath();
  c.rect(0, 0, rw, rh); c.rect(W - rw, 0, rw, rh); c.rect(0, H - rh, rw, rh); c.rect(W - rw, H - rh, rw, rh);
  c.clip(); decoFrame(c, W, H); c.restore();
}
/** A stamp's scale and opacity at age u (s): it lands from 1.4× in 0.16 s. */
const stamp = (u: number) => ({ s: 1 + 0.4 * (1 - ease.outCubic(clamp(u / 0.16))), a: clamp(u / 0.05) });

/** The tram that sweeps across the lens, right to left, as the wipe between the skyline and the avenue: its nose reaches
 *  the frame's left edge exactly at the cut (both scenes draw it from the same song time). Echoes behind it smear it. */
function tramWipe(c: C, t: number, tCut: number) {
  const L = 3800, v = W / 0.32, x = W - v * (t - (tCut - 0.32));
  if (x > W || x + L < 0) return;
  for (let k = 4; k >= 1; k--) { c.globalAlpha = 0.16; tram(c, x + (k * v) / 70, 1110, L, mulberry32(77), '浅草'); }
  c.globalAlpha = 1; tram(c, x, 1110, L, mulberry32(77), '浅草');
}

/** A Taisho passer-by in silhouette, side-on, walking toward +x (dir −1: toward −x); feet at (x, y), height h; ph = the
 *  stride's phase (one step = π). kinds: gent (bowler hat, inverness cape, cane), student (cap, long mantle), hakama
 *  (a schoolgirl: ribbon, long sleeves, hakama, boots), parasol (kimono, obi bow, a paper parasol), child, rickshaw. */
export function walker(c: C, kind: string, x: number, y: number, h: number, ph: number, dir: number, o: { line?: string; px?: number; lantern?: boolean } = {}) {
  const u = h / 100, run = kind === 'child' || kind === 'rickshaw';
  const back = kind === 'rickshaw' ? 95 : 30;
  withOutline(c, x - (dir > 0 ? back : 40) * u - 10, y - 125 * u, (back + 80) * u + 20, 135 * u, (s) => {
    s.translate(x, y + (run ? -Math.abs(Math.sin(ph)) * 3 * u : -Math.abs(Math.sin(ph)) * 1.4 * u)); s.scale(dir * u, u);
    s.fillStyle = PAL.ink; s.strokeStyle = PAL.ink; s.lineCap = 'round'; s.lineJoin = 'round';
    const leg = (hipY: number, len: number, w: number, swing: number) => {
      for (const sd of [1, -1]) {
        const a = Math.sin(ph) * swing * sd, fx = Math.sin(a) * len, fy = -hipY + Math.cos(a) * len, kx = Math.sin(a) * len * 0.5 + (sd * Math.sin(ph) > 0 ? 2.5 : 0);
        s.lineWidth = w; s.beginPath(); s.moveTo(0, -hipY); s.lineTo(kx, -hipY + len * 0.5); s.lineTo(fx, Math.min(0, fy)); s.stroke();
        s.beginPath(); s.ellipse(fx + 2.6, Math.min(0, fy) - 1.2, 4.2, 1.9, 0, 0, Math.PI * 2); s.fill();
      }
    };
    const head = (hx: number, hy: number, r = 6) => { s.beginPath(); s.ellipse(hx, hy, r * 0.92, r, 0, 0, Math.PI * 2); s.fill(); };
    const poly = (pts: [number, number][]) => { s.beginPath(); s.moveTo(...pts[0]!); for (const q of pts.slice(1)) s.lineTo(...q); s.closePath(); s.fill(); };
    if (kind === 'gent') {
      leg(46, 45, 5.6, 0.38);
      poly([[-6, -81], [7, -81], [9, -42], [-9, -42]]); // the coat
      poly([[-7, -82], [8, -82], [14 + Math.sin(ph) * 1, -57], [-13, -58]]); // the inverness cape
      head(1.5, -88); s.beginPath(); s.ellipse(1.5, -93.6, 9.5, 1.9, 0, 0, Math.PI * 2); s.fill(); s.beginPath(); s.arc(1.5, -94.5, 6.2, Math.PI, 0); s.fill(); // the bowler
      s.lineWidth = 1.6; s.beginPath(); s.moveTo(10, -52); s.lineTo(16 + Math.sin(ph) * 5, 0); s.stroke(); // the cane
    } else if (kind === 'student') {
      leg(46, 45, 5.4, 0.42);
      poly([[-6, -80], [6, -80], [8, -46], [-8, -46]]);
      poly([[-7, -81], [7, -81], [11 + Math.sin(ph * 0.5) * 1.5, -30], [-13 - Math.sin(ph * 0.5) * 1.5, -32]]); // the mantle
      head(1, -88); poly([[-6, -93], [7, -93], [7, -97.5], [-6, -97.5]]); poly([[6, -93.5], [12, -92.5], [6, -92]]); // the cap and its visor
    } else if (kind === 'hakama') {
      const sw = Math.sin(ph) * 2;
      for (const sd of [1, -1]) { const fx = sd * Math.sin(ph) * 7; s.beginPath(); s.ellipse(fx + 3, -1.5, 4.4, 2, 0, 0, Math.PI * 2); s.fill(); s.fillRect(fx - 1.5, -8, 4, 7); } // the boots
      poly([[-7, -58], [7, -58], [12 + sw, -7], [-12 + sw, -7]]); // the hakama
      poly([[-6, -80], [6, -80], [7, -57], [-7, -57]]);
      s.beginPath(); s.roundRect(3, -77, 9, 26, 4); s.fill(); // the long sleeve
      head(1, -87.5); s.beginPath(); s.moveTo(-3, -92); s.quadraticCurveTo(-11, -80, -8, -62); s.lineTo(-3, -64); s.closePath(); s.fill(); // the hair down her back
      s.fillStyle = PAL.ver; poly([[-5, -93], [-14, -99], [-13, -88]]); poly([[-5, -93], [2, -101], [-1, -90]]); // the ribbon
    } else if (kind === 'parasol') {
      for (const sd of [1, -1]) { const fx = sd * Math.sin(ph) * 3.5; s.beginPath(); s.ellipse(fx + 2.5, -1.2, 3.8, 1.7, 0, 0, Math.PI * 2); s.fill(); }
      poly([[-6, -80], [6, -80], [7.5, -3], [-7, -3]]); // the kimono, narrow at the hem
      s.beginPath(); s.ellipse(-8, -62, 5, 7, 0, 0, Math.PI * 2); s.fill(); // the obi's bow
      head(1, -87.5); s.beginPath(); s.arc(-1, -96, 4.6, 0, Math.PI * 2); s.fill(); // the hair in a bun
      s.lineWidth = 1.4; s.beginPath(); s.moveTo(6, -66); s.lineTo(-6, -110); s.stroke();
      s.save(); s.translate(-6, -110); s.rotate(-0.25); s.fillStyle = PAL.ver; s.beginPath(); s.ellipse(0, 0, 28, 9, 0, Math.PI, 0); s.closePath(); s.fill();
      s.strokeStyle = 'rgba(239,228,204,0.55)'; s.lineWidth = 0.8; for (let k = -3; k <= 3; k++) { s.beginPath(); s.moveTo(0, -8.5); s.lineTo(k * 9, -1); s.stroke(); } s.restore();
    } else if (kind === 'child') {
      leg(26, 25, 4.4, 0.65); poly([[-5, -48], [5, -48], [7, -26], [-7, -26]]); head(1, -55, 6.5);
      s.lineWidth = 3; s.beginPath(); s.moveTo(1, -46); s.lineTo(9 + Math.sin(ph) * 5, -34); s.stroke();
    } else if (kind === 'rickshaw') {
      s.save(); s.translate(4, 0); s.rotate(0.12); leg(46, 45, 5.4, 0.55); poly([[-6, -80], [6, -80], [8, -44], [-8, -44]]); head(4, -88);
      s.beginPath(); s.ellipse(4, -94, 12, 3, 0, 0, Math.PI * 2); s.fill(); s.restore(); // the puller, leaning in, his straw hat
      s.lineWidth = 2.2; s.beginPath(); s.moveTo(9, -58); s.lineTo(-48, -40); s.stroke(); // the shafts
      const wx = -62, wr = 22; // the wheel and its spokes, turning
      s.lineWidth = 2.4; s.beginPath(); s.arc(wx, -wr, wr, 0, Math.PI * 2); s.stroke();
      s.lineWidth = 1; for (let k = 0; k < 8; k++) { const a = ph * 0.6 + (k / 8) * Math.PI; s.beginPath(); s.moveTo(wx - Math.cos(a) * wr, -wr - Math.sin(a) * wr); s.lineTo(wx + Math.cos(a) * wr, -wr + Math.sin(a) * wr); s.stroke(); }
      poly([[-48, -40], [-84, -40], [-86, -60], [-50, -58]]); // the seat
      s.beginPath(); s.moveTo(-50, -58); s.quadraticCurveTo(-60, -100, -90, -96); s.lineTo(-88, -60); s.closePath(); s.fill(); // the hood
      head(-70, -70, 6); poly([[-78, -64], [-62, -64], [-60, -44], [-80, -44]]); // the passenger
    }
  }, o.line ?? ARCH.line, o.px ?? 1.3);
  if (o.lantern) { // a paper lantern carried at the front hand, swinging a little
    const lx = x + dir * (11 + Math.sin(ph) * 1.5) * u, ly = y - (kind === 'child' ? 26 : 44) * u + Math.abs(Math.cos(ph)) * 1.2 * u;
    glowDot(c, lx, ly, 16 * u, 'rgba(255,150,90,A)', 0.55);
    c.strokeStyle = '#120d14'; c.lineWidth = 0.8 * u; c.beginPath(); c.moveTo(lx, ly - 7 * u); c.lineTo(lx, ly - 11 * u); c.stroke();
    c.fillStyle = '#d8472c'; c.beginPath(); c.ellipse(lx, ly, 4.2 * u, 5.6 * u, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd9a0'; c.beginPath(); c.ellipse(lx - 1 * u, ly - 1 * u, 1.6 * u, 2.4 * u, 0, 0, Math.PI * 2); c.fill();
  }
}

export const INTRO: Record<string, (b: Build) => void> = {
  title(b) {
    const A = b.audio, tFx = A.ev.in(0, A.timeOfBar(1), 'fx_hit').pop()?.t ?? A.timeOfBar(1) - 0.16, tHit = A.timeOfBar(1), T5 = b.end;
    const MX = 1390, MY = 330, MR = 290, PADX = 120, b8 = Math.round(A.beatAt(A.timeOfBar(2)));
    const glyphT = [0, 1, 2].map((j) => A.timeOfBeat(b8 + j)), sealT = A.timeOfBar(3), credT = A.timeOfBeat(b8 + 6);
    const kicks = A.ev.in(tHit, T5, 'kick').filter((e) => e.s > 0.9).map((e) => e.t);
    const zoomEnd = 1.18;
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, PAL.night0, 'rgba(255,240,220,0.035)', 0.06);
      const g = c.createRadialGradient(MX, MY, 100, MX, MY, 900); g.addColorStop(0, 'rgba(120,50,90,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }, 3), { alpha: (t) => smoothstep(tFx, tHit + 0.5, t) });
    const moon = layer(1600, 1600, (c, r) => moonDisc(c, 800, 800, MR, r, false), 31);
    b.dyn((c, t, _lt, a) => { // the moon ignites on the hit, settles on the band, swells a little on the kicks
      if (t < tFx) return;
      const s = (0.86 + 0.14 * ease.outCubic(clamp((t - tFx) / 0.5))) * (1 + 0.02 * a.kick);
      c.globalAlpha = smoothstep(tFx, tFx + 0.22, t); c.translate(MX, MY); c.scale(s, s); c.drawImage(moon, -800, -800, 1600, 1600);
    });
    b.dyn((c, t, _lt, a) => { // its rings grow out of it one after another; the dashed one turns; on the hit a ring flies out
      if (t < tFx) return;
      c.translate(MX, MY); c.strokeStyle = PAL.gold;
      ([[1.18, 1.2, 0], [1.32, 0.8, 6], [1.55, 1.6, 0]] as const).forEach(([k, lw, dash], i) => {
        const u = ease.outCubic(clamp((t - tHit - 0.1 * i) / 0.7));
        if (u <= 0) return;
        c.globalAlpha = u; c.lineWidth = lw * (1 + 0.8 * a.kick); c.setLineDash(dash ? [dash, dash * 1.6] : []); c.lineDashOffset = -t * 16;
        c.beginPath(); c.arc(0, 0, MR * lerp(1, k, u), 0, Math.PI * 2); c.stroke();
      });
      c.setLineDash([]);
      const ub = (t - tFx) / 0.9;
      if (ub < 1) { c.globalAlpha = (1 - ub) ** 2; c.lineWidth = 3.5 * (1 - ub) + 0.5; c.beginPath(); c.arc(0, 0, MR * (1 + 2.6 * ease.outCubic(ub)), 0, Math.PI * 2); c.stroke(); }
    });
    const branch = layer(W + 2 * PADX, H, (c, r) => sakuraTree(c, PADX - 60, -30, 210, 0.62, r, { ink: '#2a1420', glow: 'rgba(247,182,204,0.55)', spread: 1.15, bloom: 1.5, depth: 5 }), 4);
    b.dyn((c, t) => { // the branch sweeps in on the band and sways; the kicks shake it
      if (t < tHit) return;
      const u = ease.outBack(clamp((t - tHit) / 0.95), 1.1);
      const sway = 0.012 * Math.sin(t * 1.7) + 0.006 * Math.sin(t * 2.9 + 1) + kicks.reduce((s, k) => s + (t > k ? 0.022 * Math.exp(-(t - k) / 0.35) * Math.sin((t - k) * 14) : 0), 0);
      c.translate(lerp(-320, 0, u), lerp(-240, 0, u)); c.translate(-60, -30); c.rotate(sway); c.translate(60, 30);
      c.drawImage(branch, -PADX, 0, W + 2 * PADX, H);
    }, { p: 1.15 });
    const waves = layer(W + 100, 220, (c) => {
      c.fillStyle = PAL.plum; c.fillRect(0, 20, W + 100, 200);
      seigaiha(c, 0, 25, W + 100, 195, 46, 'rgba(201,162,74,0.55)', PAL.night1);
      const f = c.createLinearGradient(0, 20, 0, 100); f.addColorStop(0, 'rgba(28,15,30,0.9)'); f.addColorStop(1, 'rgba(28,15,30,0)'); c.fillStyle = f; c.fillRect(0, 20, W + 100, 80);
      c.fillStyle = PAL.gold; c.fillRect(0, 16, W + 100, 1.6);
    });
    b.dyn((c, t) => { // the waves rise on the band and roll slowly to the left
      if (t < tHit) return;
      const u = ease.outCubic(clamp((t - tHit - 0.12) / 0.85));
      c.drawImage(waves, -((t * 14) % 92), 880 + (1 - u) * 260, W + 100, 220);
    });
    b.dyn((c, t) => { // 千 本 桜 stamped on the beats of bar 2, the seal on bar 3, the credit typed in after
      c.font = `190px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 2.5; c.strokeStyle = PAL.gold;
      [...'千本桜'].forEach((ch, j) => {
        const st = stamp(t - glyphT[j]!);
        if (st.a <= 0) return;
        c.save(); c.translate(760, 245 + j * 201.4); c.scale(st.s, st.s); c.globalAlpha = st.a;
        const fl = Math.exp(-Math.max(0, t - glyphT[j]!) / 0.18); // the ink is lit as it lands
        c.shadowColor = fl > 0.05 ? `rgba(255,236,200,${0.9 * fl})` : 'rgba(0,0,0,0.55)'; c.shadowBlur = 24 + 30 * fl;
        c.fillStyle = PAL.cream; c.fillText(ch, 0, 0); c.shadowBlur = 0; c.strokeText(ch, 0, 0);
        c.restore();
      });
      const ss = (t - sealT) / 0.28;
      if (ss >= 0) { c.save(); const k = ease.outBack(clamp(ss), 2.2); c.translate(905, 520); c.rotate(-0.12 * (1 - clamp(ss))); c.scale(lerp(1.7, 1, k), lerp(1.7, 1, k)); c.globalAlpha = clamp(ss * 4); sealStamp(c, '初音', 0, 0, 64); c.restore(); }
      const text = '黒うさP  feat. 初音ミク', n = Math.floor(clamp((t - credT) / 0.9) * [...text].length);
      if (n > 0) { c.font = `30px "Cormorant-600", ${SERIF600}`; c.fillStyle = PAL.gold2; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText([...text].slice(0, n).join(''), 980, 806); }
    });
    b.overlay((c, t) => frameIn(c, ease.inOutCubic(clamp((t - 0.25) / 1.15))));
    b.camera((t) => { // a slow push in, then into the moon for the match cut
      const z = lerp(1, 1.05, ease.inOutQuad(clamp((t - tHit) / (T5 - 0.6 - tHit)))) * lerp(1, zoomEnd / 1.05, ease.inCubic(clamp((t - (T5 - 0.6)) / 0.6)));
      return { x: 0, zoom: z, fx: MX, fy: MY };
    });
    b.smear((t) => (t > T5 - 0.4 ? { dx: 0, dy: 0, dz: 0.05 * ease.inQuad(clamp((t - (T5 - 0.4)) / 0.4)), fx: MX, fy: MY, n: 5, a: 0.45 } : null));
    b.wind(gusts([tHit, ...kicks], 2.6, 0.5));
    b.petals(90, { p: 1.3, alpha: (t) => smoothstep(tHit, tHit + 0.8, t) });
    b.post((t) => {
      const sh = glyphT.concat([sealT]).reduce((s, k) => s + (t >= k ? 2.4 * Math.exp(-(t - k) / 0.07) : 0), 0);
      return { bloom: 0.6, halation: 0.24, zoom: 1 + 0.03 * (t >= tHit ? Math.exp(-(t - tHit) / 0.16) : 0), shake: [sh * 0.6, sh] as [number, number] };
    });
  },

  skyline(b) {
    const A = b.audio, T5 = b.start, T9 = b.end, PX = 300;
    const MX = 1330, MY = 250, MR = 125, M1 = [1390, 330] as const, R1 = 290 * 1.18; // the title's moon at the cut
    const Z0 = R1 / MR, FX = (Z0 * MX - M1[0]) / (Z0 - 1), FY = (Z0 * MY - M1[1]) / (Z0 - 1);
    const b6 = Math.round(A.beatAt(A.timeOfBar(6))), floorT = Array.from({ length: 11 }, (_, j) => A.timeOfBeat(b6 + j));
    b.add(layer(W + 120, H, (c, r) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, PAL.night0); g.addColorStop(0.62, PAL.plum); g.addColorStop(1, '#6a3354');
      c.fillStyle = g; c.fillRect(0, 0, W + 120, H);
      for (let i = 0; i < 520; i++) { c.fillStyle = `rgba(255,240,220,${0.2 + 0.6 * r()})`; c.fillRect(r() * (W + 120), r() * H * 0.6, 1.4, 1.4); }
      moonDisc(c, MX + 60, MY, MR, r);
    }, 6), { px: 60, p: 0.04 });
    b.add(layer(W + 2 * PX, H, (c, r) => skyline(c, W + 2 * PX, 690, r, { fill: '#3d2147', win: 0.03, scale: 0.6 }), 7), { px: PX, p: 0.2 });
    let tower: ReturnType<typeof skyline>['tower'];
    b.add(layer(W + 2 * PX, H, (c, r) => {
      const hz = c.createLinearGradient(0, 600, 0, 760); hz.addColorStop(0, 'rgba(150,80,120,0)'); hz.addColorStop(1, 'rgba(150,80,120,0.32)');
      c.fillStyle = hz; c.fillRect(0, 600, W + 2 * PX, 160);
      tower = skyline(c, W + 2 * PX, 800, r, { fill: '#27132e', win: 0.17, rim: 'rgba(201,162,74,0.6)', scale: 0.95, tower: 1080 + PX, towerUnlit: true }).tower;
      // the elevated railway across the city: a brick viaduct, its arches
      c.fillStyle = '#1e0e1c'; c.fillRect(0, 770, W + 2 * PX, 14);
      for (let x = -20; x < W + 2 * PX; x += 46) { c.beginPath(); c.moveTo(x, 784); c.lineTo(x + 46, 784); c.lineTo(x + 46, 800); c.arc(x + 23, 800, 15, 0, Math.PI, true); c.lineTo(x, 800); c.closePath(); c.fill(); }
      c.fillStyle = PAL.gold; c.fillRect(0, 770, W + 2 * PX, 1.2);
      const hz2 = c.createLinearGradient(0, 790, 0, 900); hz2.addColorStop(0, 'rgba(120,60,100,0)'); hz2.addColorStop(1, 'rgba(120,60,100,0.4)');
      c.fillStyle = hz2; c.fillRect(0, 790, W + 2 * PX, 110);
    }, 8), { px: PX, p: 0.5 });
    b.dyn((c, t, _lt, a) => { // the tower's floors light one per beat from bar 6, bottom to top; the beacon on top blinks on the beat
      if (!tower) return;
      const fl = tower.floors, n = fl.length;
      for (let j = 0; j < n; j++) {
        const k = n - 1 - j, u = clamp((t - floorT[j]!) / 0.08);
        if (u <= 0) continue;
        const [wx, wy, ww, wh] = fl[k]!;
        c.save(); c.shadowColor = 'rgba(255,207,122,0.9)'; c.shadowBlur = 10 * u + 12 * Math.exp(-Math.max(0, t - floorT[j]!) / 0.15);
        c.fillStyle = `rgba(255,214,140,${u})`; c.fillRect(wx - PX, wy, ww, wh); c.restore();
      }
      if (t > floorT[n - 1]!) glowDot(c, tower.cx - PX, tower.top - 36, 14 + 10 * a.kick, 'rgba(255,90,60,A)', 0.9);
    }, { p: 0.5 });
    b.dyn((c, t) => { // a train along the viaduct from bar 6, its windows lit, steam behind it
      const x0 = -760 + (t - A.timeOfBar(6)) * 120;
      for (let k = 0; k < 7; k++) {
        const x = x0 + k * 74;
        c.fillStyle = '#120a12'; c.beginPath(); c.roundRect(x, 752, 70, 18, 3); c.fill();
        c.fillStyle = 'rgba(255,214,140,0.95)'; for (let w = 0; w < 6; w++) c.fillRect(x + 5 + w * 11, 756, 6, 6);
      }
      for (let k = 0; k < 6; k++) glowDot(c, x0 + 7 * 74 + 10 - k * 34, 740 - k * 7, 16 + k * 5, 'rgba(239,228,204,A)', 0.35 - k * 0.05);
    }, { p: 0.5 });
    b.add(layer(W + 2 * PX, H, (c, r) => {
      let x = -30;
      while (x < W + 2 * PX + 40) { // the near rooftops: tiled roofs in ink, gold on the ridges, lit paper windows under the eaves
        const bw = 190 + r() * 170, ridge = 905 + r() * 50, eave = ridge + 46 + r() * 16;
        c.fillStyle = '#1a0f1c'; c.fillRect(x + 8, eave, bw - 16, H - eave);
        for (let wx = x + 30; wx < x + bw - 60; wx += 64) if (r() < 0.75) { c.fillStyle = '#f2c27a'; c.fillRect(wx, eave + 26, 40, 34); c.fillStyle = 'rgba(60,30,20,0.7)'; c.fillRect(wx + 19, eave + 26, 2, 34); c.fillRect(wx, eave + 42, 40, 2); }
        const roof = new Path2D(); roof.moveTo(x - 14, eave); roof.lineTo(x + bw * 0.16, ridge); roof.lineTo(x + bw * 0.84, ridge); roof.lineTo(x + bw + 14, eave); roof.closePath();
        c.fillStyle = PAL.ink; c.fill(roof);
        c.save(); c.clip(roof); c.strokeStyle = 'rgba(201,162,74,0.22)'; c.lineWidth = 1.2;
        for (let tx = x - 30; tx < x + bw + 30; tx += 13) { c.beginPath(); c.moveTo(tx, ridge); c.lineTo(tx + (tx - x - bw / 2) * 0.12, eave); c.stroke(); }
        c.restore();
        c.strokeStyle = PAL.gold; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + bw * 0.16, ridge); c.lineTo(x + bw * 0.84, ridge); c.stroke();
        c.fillStyle = PAL.ink; for (const ex of [x + bw * 0.16, x + bw * 0.84]) { c.beginPath(); c.moveTo(ex - 10, ridge + 2); c.quadraticCurveTo(ex, ridge - 24, ex + 10, ridge + 2); c.fill(); }
        x += bw - 6;
      }
      c.strokeStyle = PAL.ink;
      const poles = [560 + PX, 1180 + PX, 1800 + PX, 2420 + PX];
      for (const px of poles) { c.lineWidth = 7; c.beginPath(); c.moveTo(px, H); c.lineTo(px, 690); c.stroke(); c.lineWidth = 5; c.beginPath(); c.moveTo(px - 42, 712); c.lineTo(px + 42, 712); c.stroke(); }
      c.lineWidth = 1.3;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-20, 760 + k * 6); for (const px of poles) c.quadraticCurveTo(px - 300, 750 + k * 8, px - 38 + k * 38, 714); c.stroke(); }
      sakuraTree(c, PX + 150, H + 20, 330, -Math.PI / 2 + 0.2, r, { ink: '#160c14', glow: 'rgba(247,182,204,0.45)', spread: 1.25, bloom: 1.8, depth: 6 });
    }, 9), { px: PX, p: 1 });
    b.overlay((c, t) => { tramWipe(c, t, T9); decoFrame(c, W, H); });
    b.camera((t) => { // the match cut: from the title's moon (zoomed) back out to the city; then a slow truck to the right
      const zu = ease.outCubic(clamp((t - T5) / 1.5)), z = lerp(Z0, 1, zu);
      return { x: 260 * ease.inOutQuad(clamp((t - T5 - 0.8) / (T9 - T5 - 0.8))), zoom: z, fx: FX, fy: FY };
    });
    b.smear((t) => (t < T5 + 0.55 ? { dx: 0, dy: 0, dz: -0.09 * (1 - clamp((t - T5) / 0.55)), fx: FX, fy: FY, n: 5, a: 0.4 } : null));
    b.wind(gusts([A.timeOfBar(6), A.timeOfBar(7), A.timeOfBar(8)], 2.2, 0.5));
    b.petals(110, { p: 1.25 });
  },

  avenue(b) {
    const A = b.audio, T9 = b.start, T13 = b.end, PX = 300, BASE = 830;
    b.add(layer(W + 120, H + 600, (c, r) => { // the sky (taller than the frame: the tilt at the end looks up into it), a printed night
      const g = c.createLinearGradient(0, 0, 0, H + 600); g.addColorStop(0, PAL.night0); g.addColorStop(0.55, PAL.night0); g.addColorStop(0.82, '#2a1630'); g.addColorStop(1, '#3a1d3c');
      c.fillStyle = g; c.fillRect(0, 0, W + 120, H + 600);
      dotScreen(c, 0, 0, W + 120, H + 600, 0.07, 6);
      for (let i = 0; i < 520; i++) { c.fillStyle = `rgba(255,240,220,${0.2 + 0.6 * r()})`; c.fillRect(r() * (W + 120), r() * (H + 600) * 0.7, 1.4, 1.4); }
      moonDisc(c, 1480 + 60, 200 + 600, 100, r);
    }, 51), { px: 60, py: -600, p: 0.04 });
    b.add(layer(W + 2 * PX, H, (c, r) => skyline(c, W + 2 * PX, 600, r, { fill: '#241229', win: 0.04, scale: 0.6, rim: 'rgba(216,191,136,0.25)' }), 52), { px: PX, p: 0.2 });
    b.add(layer(W + 2 * PX, H, (c, r) => {
      // the street front: building after building, each an elevation in line art; the signboards in period type
      const plan: [Arch, number, number, string | undefined, boolean][] = [
        ['shop', 280, 3, '喫茶', true], ['bank', 386, 3, '銀行', false], ['gable', 234, 4, undefined, false], ['machiya', 280, 2, undefined, false],
        ['tower', 328, 3, '時計', false], ['shop', 258, 3, '帽子', true], ['mansard', 340, 3, '理髪', false], ['dome', 398, 3, '劇場', false],
        ['machiya', 270, 2, undefined, false], ['shop', 280, 3, '書林', true],
      ];
      let x = -20;
      for (const [kind, w, floors, sign, awning] of plan) { elevation(c, x, BASE, { kind, w, floors, fh: 96, sign, awning, lit: 0.3 }, r); x += w; } // (the street's proportions: a lamp ~1.8 storeys, a person ~0.75 of a shop's ground floor)
      // telegraph poles and the wires between them, above the roofs
      const poles = [520, 1290, 2060];
      for (const px of poles) { c.fillStyle = ARCH.ink; c.fillRect(px - 4, 300, 8, BASE - 300); c.strokeStyle = ARCH.dim; c.lineWidth = 1; c.strokeRect(px - 4, 300, 8, BASE - 300); for (const yy of [318, 338]) { c.fillRect(px - 40, yy, 80, 5); c.strokeRect(px - 40, yy, 80, 5); } }
      c.strokeStyle = 'rgba(216,191,136,0.42)'; c.lineWidth = 1;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(-20, 330 + k * 4); let px0 = -20; for (const px of poles.concat([W + 2 * PX + 40])) { c.quadraticCurveTo((px0 + px) / 2, 352 + k * 6, px - 36 + k * 24, 318 + (k % 2) * 20); px0 = px; } c.stroke(); }
      // the pavement (running bond), the kerb, the road with its rails and cobbles
      c.fillStyle = '#120d14'; c.fillRect(0, BASE, W + 2 * PX, 32);
      c.strokeStyle = 'rgba(216,191,136,0.18)'; c.lineWidth = 1;
      for (let yy = BASE + 8, row = 0; yy < BASE + 32; yy += 8, row++) { c.beginPath(); c.moveTo(0, yy); c.lineTo(W + 2 * PX, yy); c.stroke(); for (let xx = (row % 2) * 12; xx < W + 2 * PX; xx += 24) { c.beginPath(); c.moveTo(xx, yy - 8); c.lineTo(xx, yy); c.stroke(); } }
      c.fillStyle = ARCH.line; c.fillRect(0, BASE + 32, W + 2 * PX, 1.6);
      c.fillStyle = '#0f0b11'; c.fillRect(0, BASE + 34, W + 2 * PX, H - BASE - 34);
      c.strokeStyle = 'rgba(216,191,136,0.07)';
      for (let yy = BASE + 46, row = 0; yy < H; yy += 13 + row * 1.5, row++) for (let xx = (row % 2) * 14; xx < W + 2 * PX; xx += 28) { c.beginPath(); c.roundRect(xx + 2, yy, 24, 10 + row, 4); c.stroke(); }
      for (const yy of [972, 996]) { c.fillStyle = 'rgba(216,191,136,0.5)'; c.fillRect(0, yy, W + 2 * PX, 2.4); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, yy + 2.4, W + 2 * PX, 2); } // the tram rails
    }, 53), { px: PX, p: 0.55 });
    // the gas lamps: one lights on each beat; its light is printed as halftone on the fronts and the pavement
    // (pools of light with dark gaps between them, as print: overlapping glows added up into one dotted sheet)
    const LH = 200, lamps = Array.from({ length: 7 }, (_, i) => 170 + i * 380), b0 = Math.ceil(A.beatAt(T9 + 0.4)), ht = halftoneSprite(150, 8, 3.6);
    b.dyn((c, t, _lt, a) => lamps.forEach((lx, i) => {
      const k = clamp((t - A.timeOfBeat(b0 + i)) / 0.06), grow = 0.55 + 0.45 * ease.outCubic(clamp((t - A.timeOfBeat(b0 + i)) / 0.3));
      if (k > 0) {
        c.save(); c.fillStyle = '#e8c878';
        for (let j = 0; j < 10; j++) {
          const y = 878 + j * 15 + j * j * 0.9, wd = (36 - j * 2.7) * (0.72 + 0.28 * Math.sin(t * 2.6 + j * 1.9 + i * 2.3)) * grow;
          c.globalAlpha = k * 0.6 * (1 - j / 11); c.fillRect(lx - wd / 2 + Math.sin(t * 1.7 + j + i) * 2.5, y, wd, 2.2);
        }
        c.restore();
        const hy = 862 - LH + 0.12 * LH, R = 150 * grow * (1 + 0.04 * a.snare);
        c.save();
        c.globalAlpha = 0.72 * k; c.drawImage(ht, lx - R, hy - R, 2 * R, 2 * R);
        c.globalAlpha = 0.55 * k; c.drawImage(ht, lx - R * 1.15, 866 - R * 0.26, 2.3 * R, 0.52 * R); // the pool on the pavement
        c.restore();
      }
      gasLamp(c, lx, 862, LH, k);
    }), { p: 0.55 });
    // the evening crowd: Taisho passers-by in silhouette, traced in gold; some carry paper lanterns
    const kinds = ['gent', 'hakama', 'parasol', 'student', 'gent', 'child', 'hakama', 'student', 'parasol', 'gent', 'child', 'hakama', 'gent', 'student', 'parasol', 'hakama'];
    const people = kinds.map((kind, i) => ({ kind, x0: -260 + i * 170 + 60 * hash(i, 31), v: (hash(i, 32) < 0.5 ? -1 : 1) * (24 + 20 * hash(i, 33)), h: (kind === 'child' ? 52 : 88 + 10 * hash(i, 34)), lantern: hash(i, 35) < 0.35 }));
    people.push({ kind: 'rickshaw', x0: -300, v: 86, h: 92, lantern: false });
    b.dyn((c, t) => people.forEach((q, i) => {
      const d = (t - T9) * q.v, ph = (Math.abs(d) / (0.42 * q.h)) * Math.PI + i;
      walker(c, q.kind, q.x0 + d, 868, q.h, ph, Math.sign(q.v), { lantern: q.lantern });
    }), { p: 0.55 });
    b.dyn((c, t) => { const tx = W + 400 - (t - (T9 + 3.2)) * 360; if (tx > -800 && tx < W + 500) tram(c, tx, 998, 640, mulberry32(9), '上野'); }, { p: 0.55 });
    b.dyn((c, t) => { // a passer-by close to the lens, right to left
      const x = W + 300 - (t - (T9 + 2.0)) * 620;
      if (x > -400 && x < W + 400) walker(c, 'gent', x, 1180, 560, ((W + 300 - x) / (0.42 * 560)) * Math.PI, -1, { px: 2.6 });
    }, { p: 1.5 });
    b.add(layer(W + 1200, H, (c, r) => sakuraTree(c, 1830 + 600, 1100, 260, -Math.PI / 2 - 0.25, r, { ink: '#140b12', glow: 'rgba(247,182,204,0.4)', spread: 1.2, bloom: 1.6, depth: 5 }), 54), { px: 600, p: 1.25 });
    b.overlay((c, t) => { tramWipe(c, t, T9); decoFrame(c, W, H); });
    const tw = 0.42;
    b.camera((t) => ({ x: 420 * ease.inOutQuad(clamp((t - T9 - 0.2) / (T13 - T9 - 0.6))), sy: 0.4 * H * ease.inCubic(clamp((t - (T13 - tw)) / tw)) }));
    b.smear((t) => (t > T13 - tw ? { dx: 0, dy: -0.4 * H * 3 * ease.inQuad(clamp((t - (T13 - tw)) / tw)) / tw / 30 * 1.4, dz: 0, fx: W / 2, fy: H / 2, n: 6, a: 0.5 } : null));
    b.wind(gusts([A.timeOfBar(10), A.timeOfBar(11), A.timeOfBar(12)], 2, 0.5));
    b.petals(80, { p: 1.3 });
    b.post(() => ({ bloom: 0.45, halation: 0.18 }));
  },

  rooftop(b) {
    const A = b.audio, T13 = b.start, T17 = b.end, tL = A.timeOfBar(16), PX = 200;
    const MX = 1010, MY = 470, MR = 370;
    b.add(layer(W, H + 900, (c, r) => { // taller than the frame both ways: the leap rises into it, the whip arrives from below
      const g = c.createLinearGradient(0, 0, 0, H + 400); g.addColorStop(0, PAL.night0); g.addColorStop(0.3, PAL.night0); g.addColorStop(1, PAL.plum);
      c.fillStyle = g; c.fillRect(0, 0, W, H + 400); c.fillStyle = PAL.plum; c.fillRect(0, H + 400, W, 500);
      for (let i = 0; i < 520; i++) { c.fillStyle = `rgba(255,240,220,${0.2 + 0.5 * r()})`; c.fillRect(r() * W, r() * (H + 400) * 0.75, 1.3, 1.3); }
    }, 10), { py: -400, p: 0.04 });
    const moon = layer(2000, 2000, (c, r) => moonDisc(c, 1000, 1000, MR, r, false), 33);
    b.dyn((c, t, _lt, a) => { // the moon, its rings slowly turning, breathing with the kick
      c.save(); c.translate(MX, MY); c.drawImage(moon, -1000, -1000, 2000, 2000);
      c.strokeStyle = PAL.gold;
      ([[1.18, 1.2, 0, 1], [1.32, 0.8, 6, -1], [1.55, 1.6, 0, 1], [1.72, 0.7, 3, 1]] as const).forEach(([k, lw, dash, dir]) => {
        c.lineWidth = lw * (1 + 0.6 * a.kick); c.setLineDash(dash ? [dash, dash * 1.6] : []); c.lineDashOffset = dir * t * 20;
        c.beginPath(); c.arc(0, 0, MR * k * (1 + 0.006 * a.kick), 0, Math.PI * 2); c.stroke();
      });
      c.restore();
    }, { p: 0.06 });
    b.add(layer(W + 2 * PX, H + 500, (c, r) => { skyline(c, W + 2 * PX, 900, r, { fill: '#2a1430', win: 0.35, scale: 0.5 }); c.fillStyle = '#2a1430'; c.fillRect(0, 1290, W + 2 * PX, H + 500 - 1290); }, 11), { px: PX, p: 0.3 });
    b.add(layer(W, H + 500, (c) => { // the roof, running on below the frame (the tilt arrives from below it)
      c.fillStyle = '#140d18'; c.fillRect(0, 846, W, H + 500 - 846);
      for (let x = -300; x < W + 300; x += 30) {
        c.strokeStyle = 'rgba(201,162,74,0.24)'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, 862); c.lineTo(x + (x - W / 2) * 0.55, H + 500); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + 8, 862); c.lineTo(x + 8 + (x + 8 - W / 2) * 0.55, H + 500); c.stroke();
      }
      c.strokeStyle = 'rgba(201,162,74,0.12)'; c.lineWidth = 1;
      for (let y = 880; y < H + 500; y += 26 + (y - 880) * 0.12) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      const fade = c.createLinearGradient(0, 860, 0, H + 500); fade.addColorStop(0, 'rgba(10,5,12,0)'); fade.addColorStop(1, 'rgba(10,5,12,0.85)');
      c.fillStyle = fade; c.fillRect(0, 860, W, H + 500 - 860);
      c.fillStyle = '#0d0910'; c.fillRect(0, 832, 1560, 30);
      c.strokeStyle = PAL.gold; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 832); c.lineTo(1560, 832); c.stroke();
      const oni = new Path2D(); oni.moveTo(1540, 862); oni.lineTo(1540, 790); oni.quadraticCurveTo(1585, 760, 1630, 790); oni.lineTo(1630, 862); oni.closePath();
      c.fillStyle = '#0d0910'; c.fill(oni); c.strokeStyle = PAL.gold; c.stroke(oni); crest(c, 1585, 815, 22, PAL.gold);
    }, 12), { p: 1 });
    // Miku: saluting in the wind (it gusts on the snare roll into bar 15), a crouch, and on bar 16 the leap across the moon
    const roll = A.ev.in(A.timeOfBar(14), A.timeOfBar(15), 'snare').filter((e) => e.s > 0.9).map((e) => e.t);
    b.dyn((c, t) => {
      const wind = 0.78 + roll.reduce((s, k) => s + (t > k ? 0.22 * Math.exp(-(t - k) / 0.5) : 0), 0);
      if (t < tL) {
        const cr = ease.inOutQuad(clamp((t - (tL - 0.34)) / 0.34)); // the crouch before the leap
        c.save(); c.translate(1000, 832); c.scale(1 + 0.05 * cr, 1 - 0.1 * cr); c.translate(-1000, -832);
        mikuStanding(c, 1000, 832, 420, Math.min(1, wind), t * 4.2);
        c.restore();
        return;
      }
      const u = clamp((t - tL) / 1.3), e = ease.inOutQuad(u), q = (a: number, m: number, z: number) => (1 - e) * (1 - e) * a + 2 * (1 - e) * e * m + e * e * z;
      const x = q(1000, 560, -320), y = q(620, 90, 240);
      c.save(); c.translate(x, y); c.rotate(-0.12 - 0.1 * e); c.scale(-(1 + 0.25 * e), 1 + 0.25 * e); c.translate(-x, -y);
      mikuLeap(c, x, y, 420, t * 7);
      c.restore();
    }, { p: 1 });
    const branch = layer(W + 2 * PX, H, (c, r) => sakuraTree(c, W + PX + 30, 120, 190, Math.PI - 0.55, r, { ink: '#1a0e18', glow: 'rgba(247,182,204,0.5)', spread: 1.1, bloom: 1.3, depth: 4 }), 34);
    b.dyn((c, t) => { const sw = 0.01 * Math.sin(t * 1.6) + 0.005 * Math.sin(t * 2.7); c.translate(W + 30, 120); c.rotate(sw); c.translate(-(W + 30), -120); c.drawImage(branch, -PX, 0, W + 2 * PX, H); }, { p: 1.4 });
    b.overlay((c, t) => { petalStorm(c, t, T17); decoFrame(c, W, H); }); // the gust she leaves: the cut to the gate inside it
    const tw = 0.45;
    b.camera((t) => ({ x: 0, sy: -0.4 * H * (1 - ease.outCubic(clamp((t - T13) / tw))) + 90 * ease.inOutQuad(clamp((t - tL) / 1.2)), dolly: 0.1 * ease.inOutQuad(clamp((t - T13 - 0.4) / (tL - T13 - 0.6))), fx: 1000, fy: 640 }));
    b.smear((t) => (t < T13 + tw ? { dx: 0, dy: -0.4 * H * 3 * (1 - clamp((t - T13) / tw)) ** 2 / tw / 30 * 1.4, dz: 0, fx: W / 2, fy: H / 2, n: 6, a: 0.5 } : null));
    b.wind(gusts([...roll, tL, tL + 0.4], 2.4, 0.5));
    b.petals(200, { p: 1.3 });
    b.post(() => ({ bloom: 0.32, halation: 0.12 }));
  },
};
