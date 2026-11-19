// The graphic worlds of board batch 2 (docs/TREATMENT.md, Direction v3), composited by poster.ts like batch 1's: pre-drawn
// layers with parallax, plus `dyn` drawings for what moves (lamps lighting on the beat, the tram, posters slapped up,
// handbills in the wind, the flip board, gears). Each world gets the lyric phrases sung in its window (each glyph's
// time) and shows them as objects in the world: posters, handbills, the departure board, a theatre banner, stamps.
import type { AudioData } from '../engine/audio';
import { W, H } from '../engine/gl';
import { CREDIT } from '../config';
import { clamp, ease, hash } from '../engine/util';
import {
  PAL, SERIF900, SERIF600, layer, washi, decoFrame, crest, moonDisc, skyline, sakuraTree, sealStamp, mikuStanding, mikuLeap,
  facade, asanoha, yagasuri, gear, seigaiha, type Kind,
} from './taisho';
import { drawColumn, type Phrase } from './torii';

type C = CanvasRenderingContext2D;
import type { Build } from './poster';
const PAD = 160, WW = W + 2 * PAD;

export function nightSky(c: C, r: () => number, low = '#6a3354', n = 450, maxY = 0.6) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, PAL.night0); g.addColorStop(0.6, PAL.plum); g.addColorStop(1, low);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < n; i++) { c.fillStyle = `rgba(255,240,220,${0.2 + 0.6 * r()})`; c.fillRect(r() * W, r() * H * maxY, 1.4, 1.4); }
}
export function glowDot(c: C, x: number, y: number, r: number, col: string, a: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', String(a))); g.addColorStop(1, col.replace('A', '0'));
  c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
}
/** A gas lamp in line art (height h, foot at x, y), lit 0..1: an ink post traced in gold, the lantern's glass warm when
 *  lit (the light itself is printed separately as halftone: litLamp()). */
export function gasLamp(c: C, x: number, y: number, h: number, lit: number) {
  const u = h / 100, top = y - 100 * u, line = '#d8bf88';
  c.save(); c.lineJoin = 'miter';
  const part = (draw: (p: Path2D) => void) => { const p = new Path2D(); draw(p); c.fillStyle = '#120d14'; c.fill(p); c.strokeStyle = line; c.lineWidth = Math.max(1, 1.1 * u * 0.6); c.stroke(p); };
  part((p) => { p.moveTo(x - 8 * u, y); p.lineTo(x + 8 * u, y); p.lineTo(x + 6 * u, y - 7 * u); p.lineTo(x - 6 * u, y - 7 * u); p.closePath(); }); // the foot
  part((p) => p.rect(x - 2.4 * u, y - 86 * u, 4.8 * u, 79 * u)); // the post
  part((p) => p.rect(x - 6 * u, y - 64 * u, 12 * u, 3 * u)); // the ladder bar
  // the lantern: a tapered glass in a frame, a cap, a finial
  const g = new Path2D(); g.moveTo(x - 8 * u, top + 5 * u); g.lineTo(x + 8 * u, top + 5 * u); g.lineTo(x + 5.5 * u, top + 18 * u); g.lineTo(x - 5.5 * u, top + 18 * u); g.closePath();
  c.fillStyle = lit > 0 ? `rgb(255,${205 + 35 * lit},${130 + 70 * lit})` : '#231c2c'; c.fill(g);
  c.strokeStyle = line; c.lineWidth = Math.max(1, 0.7 * u); c.stroke(g);
  c.beginPath(); c.moveTo(x, top + 5 * u); c.lineTo(x, top + 18 * u); c.strokeStyle = lit > 0 ? 'rgba(60,30,10,0.8)' : line; c.stroke();
  part((p) => { p.moveTo(x - 11 * u, top + 5.5 * u); p.lineTo(x, top - 3.5 * u); p.lineTo(x + 11 * u, top + 5.5 * u); p.closePath(); });
  part((p) => p.rect(x - 1.2 * u, top - 9 * u, 2.4 * u, 6 * u));
  part((p) => p.rect(x - 6.5 * u, top + 17.5 * u, 13 * u, 3 * u));
  c.restore();
}
/** A Taisho tram in line art, side-on (length L px, wheels on y): an ink body traced in gold, a vermilion line, lit
 *  windows with passengers, the destination board, the headlamp. */
export function tram(c: C, x: number, y: number, L: number, rnd: () => number, dest: string) {
  const u = L / 560, top = y - 168 * u, line = '#d8bf88', lw = Math.max(1.2, 1.3 * u * 0.5);
  c.save(); c.lineJoin = 'miter';
  c.strokeStyle = '#120d14'; c.lineWidth = 4 * u; c.beginPath(); c.moveTo(x + 360 * u, top - 4 * u); c.lineTo(x + 470 * u, top - 160 * u); c.stroke(); // the trolley pole
  c.strokeStyle = line; c.lineWidth = lw; c.stroke();
  const body = new Path2D(); body.roundRect(x, top, L, 160 * u, [22 * u, 22 * u, 8 * u, 8 * u]);
  c.fillStyle = '#151019'; c.fill(body);
  c.fillStyle = '#1c1522'; c.beginPath(); c.roundRect(x + 20 * u, top - 14 * u, L - 40 * u, 16 * u, 6 * u); c.fill(); c.strokeStyle = line; c.lineWidth = lw; c.stroke(); // the clerestory roof
  for (let k = 0; k < 8; k++) { c.strokeRect(x + 40 * u + k * 60 * u, top - 10 * u, 30 * u, 8 * u); }
  for (let i = 0; i < 9; i++) { // the windows, lit, with passengers: hats, buns, caps, kimono collars, one or two to a window
    const wx = x + 34 * u + i * 56 * u, wy = top + 14 * u;
    c.fillStyle = ['#ecc66c', '#ddb05a', '#f2d48c'][i % 3]!; c.fillRect(wx, wy, 40 * u, 46 * u);
    c.strokeStyle = 'rgba(36,20,16,0.85)'; c.lineWidth = lw; c.beginPath(); c.moveTo(wx, wy + 13 * u); c.lineTo(wx + 40 * u, wy + 13 * u); c.stroke(); // the transom (behind them)
    c.save(); c.beginPath(); c.rect(wx, wy, 40 * u, 46 * u); c.clip();
    const n = rnd() < 0.78 ? (rnd() < 0.25 ? 2 : 1) : 0;
    for (let q = 0; q < n; q++) {
      const px = wx + (n === 2 ? (q ? 29 : 11) : 14 + 12 * rnd()) * u, py = wy + (26 + 3 * rnd()) * u, hr = (5.6 + 1.2 * rnd()) * u, k = rnd();
      c.fillStyle = '#40291c'; // opaque: a hat over a head merges into one silhouette (translucent shapes stacked into dark bands)
      c.beginPath(); c.roundRect(px - 11 * u, py + hr + 2 * u, 22 * u, 20 * u, [7 * u, 7 * u, 0, 0]); c.fill(); // shoulders
      c.beginPath(); c.ellipse(px, py, hr * 0.9, hr, 0, 0, Math.PI * 2); c.fill(); // the head
      if (k < 0.28) { c.fillRect(px - 8.5 * u, py - hr + 0.6 * u, 17 * u, 2.4 * u); c.beginPath(); c.ellipse(px, py - hr + 0.8 * u, 5.2 * u, 5.4 * u, 0, Math.PI, 0); c.fill(); } // a bowler on the head
      else if (k < 0.5) { c.beginPath(); c.arc(px - hr * 0.5, py - hr * 0.95, 3.4 * u, 0, Math.PI * 2); c.fill(); c.fillStyle = '#c8321e'; c.fillRect(px - hr * 0.5 - 2.5 * u, py - hr * 0.95 - 0.8 * u, 5 * u, 1.6 * u); } // a bun, a red comb
      else if (k < 0.68) { c.fillRect(px - hr, py - hr - 1.2 * u, 2 * hr, 3.6 * u); c.fillRect(px - hr - 2.6 * u, py - hr + 1.8 * u, 2 * hr + 5.2 * u, 1.6 * u); } // a student's cap
      if (k > 0.4) { c.strokeStyle = 'rgba(236,198,108,0.55)'; c.lineWidth = 1.1 * u; c.beginPath(); c.moveTo(px - 6 * u, py + hr + 3 * u); c.lineTo(px, py + hr + 11 * u); c.lineTo(px + 6 * u, py + hr + 3 * u); c.stroke(); } // a kimono collar
    }
    c.restore();
    c.strokeStyle = line; c.lineWidth = lw; c.strokeRect(wx, wy, 40 * u, 46 * u);
  }
  c.fillStyle = '#c8321e'; c.fillRect(x + 4 * u, top + 72 * u, L - 8 * u, 5 * u); // the vermilion line
  c.strokeStyle = line; c.lineWidth = lw;
  for (let k = 0; k < 9; k++) c.strokeRect(x + 34 * u + k * 56 * u, top + 90 * u, 40 * u, 46 * u); // the lower panels
  c.beginPath(); c.moveTo(x, top + 84 * u); c.lineTo(x + L, top + 84 * u); c.stroke();
  c.fillStyle = '#efe4cc'; c.fillRect(x + 8 * u, top + 18 * u, 20 * u, 36 * u); c.strokeRect(x + 8 * u, top + 18 * u, 20 * u, 36 * u); // the destination board
  c.fillStyle = '#120a10'; c.font = `${12 * u}px ${SERIF900}`; drawColumn(c, dest, x + 18 * u, top + 21 * u, 13 * u, () => 1);
  glowDot(c, x + 6 * u, top + 112 * u, 30 * u, 'rgba(255,230,170,A)', 0.85); c.fillStyle = '#fff3d0'; c.beginPath(); c.arc(x + 6 * u, top + 112 * u, 5 * u, 0, Math.PI * 2); c.fill(); // the headlamp
  for (const wx of [70, 130, 430, 490]) { c.fillStyle = '#120d14'; c.beginPath(); c.arc(x + wx * u, y - 6 * u, 15 * u, 0, Math.PI * 2); c.fill(); c.strokeStyle = line; c.stroke(); c.beginPath(); c.arc(x + wx * u, y - 6 * u, 5 * u, 0, Math.PI * 2); c.stroke(); }
  c.strokeStyle = line; c.lineWidth = lw * 1.4; c.stroke(body);
  c.restore();
}
/** The lyric phrase being sung (or the last one sung) at t. */
function phraseAt(ph: Phrase[], t: number) { let p: Phrase | undefined; for (const x of ph) if (x.t <= t + 0.05) p = x; return p; }
const revealOf = (p: Phrase, t: number) => (j: number) => clamp((t - p.ct[j]!) / 0.09);

export const WORLDS: Record<string, (b: Build) => void> = {
  // ---- interlude: the city from above as a gold-line map, the avenues glowing pink, the river, the tower standing up
  citymap(b) {
    const MW = 2600, MH = 1800;
    const map = layer(MW, MH, (c, r) => {
      c.fillStyle = '#1b0f20'; c.fillRect(0, 0, MW, MH);
      for (let y = 0; y < MH; y += 70) for (let x = 0; x < MW; x += 70) { // blocks: rooftops in three tones, lit windows
        const q = r();
        c.fillStyle = q < 0.08 ? '#10161a' : q < 0.5 ? '#2a1730' : '#22122a'; c.fillRect(x + 8, y + 8, 54, 54);
        if (q >= 0.08) for (let k = 0; k < 3; k++) { c.fillStyle = r() < 0.5 ? '#3a2040' : '#1a0d1e'; c.fillRect(x + 10 + r() * 30, y + 10 + r() * 30, 14 + r() * 12, 10 + r() * 12); }
        if (q < 0.08) for (let k = 0; k < 5; k++) { c.fillStyle = PAL.sakura; c.beginPath(); c.arc(x + 14 + r() * 42, y + 14 + r() * 42, 5, 0, Math.PI * 2); c.fill(); } // a small park
        for (let k = 0; k < 6; k++) if (r() < 0.45) { c.fillStyle = `rgba(255,207,122,${0.45 + 0.5 * r()})`; c.fillRect(x + 12 + r() * 44, y + 12 + r() * 44, 3, 3); }
      }
      c.strokeStyle = '#0e1624'; c.lineWidth = 26; c.strokeRect(1860, 220, 420, 420); c.strokeStyle = PAL.gold; c.lineWidth = 2; c.strokeRect(1847, 207, 446, 446); c.strokeRect(1873, 233, 394, 394); // the palace moat
      c.fillStyle = '#0f1814'; c.fillRect(1880, 240, 380, 380); for (let k = 0; k < 40; k++) { c.fillStyle = r() < 0.5 ? PAL.sakura : '#2a4030'; c.beginPath(); c.arc(1890 + r() * 360, 250 + r() * 360, 7, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = 'rgba(201,162,74,0.35)'; c.lineWidth = 1.2;
      for (let x = 0; x <= MW; x += 70) { c.beginPath(); c.moveTo(x + 4, 0); c.lineTo(x + 4, MH); c.stroke(); }
      for (let y = 0; y <= MH; y += 70) { c.beginPath(); c.moveTo(0, y + 4); c.lineTo(MW, y + 4); c.stroke(); }
      for (const x of [420, 980, 1540, 2100]) { // the sakura avenues: glowing pink, trees along both sides, lanterns at the crossings
        c.save(); c.shadowColor = 'rgba(247,182,204,0.9)'; c.shadowBlur = 24; c.strokeStyle = 'rgba(247,182,204,0.9)'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + 4, 0); c.lineTo(x + 4, MH); c.stroke(); c.restore();
        for (let y = 10; y < MH; y += 22) for (const s of [-1, 1]) { c.fillStyle = r() < 0.5 ? PAL.sakura : PAL.sakura2; c.beginPath(); c.arc(x + 4 + s * 16, y + r() * 6, 6 + r() * 4, 0, Math.PI * 2); c.fill(); }
        for (let y = 4; y < MH; y += 280) glowDot(c, x + 4, y, 30, 'rgba(255,214,140,A)', 0.8);
      }
      for (const y of [300, 860, 1560]) { c.save(); c.shadowColor = 'rgba(255,207,122,0.8)'; c.shadowBlur = 16; c.strokeStyle = 'rgba(255,214,150,0.7)'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, y + 4); c.lineTo(MW, y + 4); c.stroke(); c.restore(); } // the cross streets, lamp-lit
      c.fillStyle = '#0c0a18'; c.strokeStyle = PAL.gold; c.lineWidth = 2.4; // the river, meandering across
      const river = new Path2D(); river.moveTo(0, 1180);
      for (let x = 0; x <= MW; x += 50) river.lineTo(x, 1180 + Math.sin(x * 0.004) * 120 + Math.sin(x * 0.011) * 30);
      for (let x = MW; x >= 0; x -= 50) river.lineTo(x, 1300 + Math.sin(x * 0.004) * 120 + Math.sin(x * 0.011) * 30);
      river.closePath(); c.fill(river); c.stroke(river);
      c.strokeStyle = PAL.gold; c.lineWidth = 7; for (const x of [700, 1500, 2200]) { const y = 1180 + Math.sin(x * 0.004) * 120; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x, y + 150); c.stroke(); } // bridges
      c.setLineDash([22, 12]); c.lineWidth = 5; c.strokeStyle = PAL.gold2; c.beginPath(); c.ellipse(1300, 700, 980, 520, 0.08, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); // the loop line
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; c.fillStyle = PAL.cream; c.beginPath(); c.arc(1300 + Math.cos(a) * 980 * Math.cos(0.08) - Math.sin(a) * 520 * Math.sin(0.08), 700 + Math.cos(a) * 980 * Math.sin(0.08) + Math.sin(a) * 520 * Math.cos(0.08), 13, 0, Math.PI * 2); c.fill(); c.strokeStyle = PAL.ink; c.lineWidth = 3; c.stroke(); }
    }, 101);
    // the map drawn tilted (an oblique projection), the sky above its far edge
    const M = (x: number, y: number): [number, number] => [x - 0.3 * y + 60, 150 + 0.6 * y];
    b.add(layer(W, H, (c, r) => {
      nightSky(c, r, PAL.plum, 160, 0.2); moonDisc(c, 1520, 120, 70, r);
      c.save(); c.setTransform(c.getTransform().multiply(new DOMMatrix([1, 0, -0.3, 0.6, 60, 150]))); c.drawImage(map, 0, 0, MW, MH); c.restore();
      const fog = c.createLinearGradient(0, 100, 0, 420); fog.addColorStop(0, 'rgba(58,29,60,1)'); fog.addColorStop(1, 'rgba(58,29,60,0)');
      c.fillStyle = fog; c.fillRect(0, 100, W, 320);
      // the twelve-storey tower standing up from its block, its shadow across the map
      const [tx, ty] = M(1300, 760), th = 470, tw = 74;
      c.fillStyle = 'rgba(8,4,10,0.55)'; c.beginPath(); c.moveTo(tx - tw / 2, ty); c.lineTo(tx + tw / 2, ty); c.lineTo(tx + 420, ty + 170); c.lineTo(tx + 360, ty + 182); c.closePath(); c.fill(); // its shadow
      c.fillStyle = '#2a1416'; c.fillRect(tx - 90, ty - 40, 180, 40); c.fillStyle = '#ffd27a'; for (let k = 0; k < 8; k++) c.fillRect(tx - 80 + k * 21, ty - 28, 10, 12); // the pavilion at its foot
      const faces: [number, number, string][] = [[-0.5, -0.2, '#3c1b18'], [-0.2, 0.2, '#6a3026'], [0.2, 0.5, '#4a2420']]; // three faces of the octagon, lit from the left
      for (const [f0, f1, col] of faces) { c.fillStyle = col; c.fillRect(tx + f0 * tw, ty - 40 - th, (f1 - f0) * tw, th); }
      for (let f = 0; f < 12; f++) { const y = ty - 40 - th + 26 + f * 37; c.fillStyle = f % 3 ? '#ffd27a' : '#e8a050'; c.fillRect(tx - 0.16 * tw, y, 0.32 * tw, 12); c.fillStyle = 'rgba(255,210,122,0.5)'; c.fillRect(tx - 0.45 * tw, y, 0.22 * tw, 10); c.fillRect(tx + 0.25 * tw, y, 0.2 * tw, 10); c.fillStyle = PAL.gold; c.fillRect(tx - 0.52 * tw, y + 22, 1.04 * tw, 2); }
      c.fillStyle = '#2a1416'; c.beginPath(); c.moveTo(tx - tw / 2 - 10, ty - 40 - th); c.lineTo(tx, ty - 40 - th - 90); c.lineTo(tx + tw / 2 + 10, ty - 40 - th); c.closePath(); c.fill();
      c.fillStyle = PAL.ink; c.fillRect(tx - 1.5, ty - 40 - th - 130, 3, 44);
      c.strokeStyle = PAL.gold; c.lineWidth = 1.5; c.strokeRect(tx - tw / 2, ty - 40 - th, tw, th);
      decoFrame(c, W, H);
      c.save(); c.translate(1720, 900); c.strokeStyle = PAL.gold; c.lineWidth = 1.5; // a compass rose
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, L = k % 2 ? 34 : 62; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * L, Math.sin(a) * L); c.stroke(); }
      c.beginPath(); c.arc(0, 0, 44, 0, Math.PI * 2); c.stroke(); c.fillStyle = PAL.gold; c.font = `26px ${SERIF600}`; c.textAlign = 'center'; c.fillText('北', 0, -74); c.restore();
    }, 102));
    b.dyn((c, t) => { // a tram running round the loop line
      const a = (t - b.start) * 0.35, ex = 1300 + Math.cos(a) * 980 * Math.cos(0.08) - Math.sin(a) * 520 * Math.sin(0.08), ey = 700 + Math.cos(a) * 980 * Math.sin(0.08) + Math.sin(a) * 520 * Math.cos(0.08);
      const [x, y] = M(ex, ey);
      glowDot(c, x, y, 34, 'rgba(255,236,190,A)', 0.9); c.fillStyle = '#fff4dc'; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
    });
    b.petals(50);
  },

  // ---- verse 2 (lines 10–11): a station platform at night, the departure board flipping to each sung glyph, a train in
  station(b) {
    b.add(layer(W, H, (c, r) => {
      nightSky(c, r, '#3a1d3c', 260, 0.35);
      skyline(c, W, 520, r, { fill: '#261330', win: 0.1, scale: 0.7 });
      // the train: a locomotive and two carriages along the track behind the platform
      c.fillStyle = '#0e0b10'; c.fillRect(0, 700, W, 30);
      for (let k = 0; k < 2; k++) {
        const x0 = 620 + k * 660;
        c.fillStyle = '#3a1612'; c.beginPath(); c.roundRect(x0, 470, 640, 230, 18); c.fill();
        c.fillStyle = '#1e0c0a'; c.fillRect(x0, 452, 640, 26);
        for (let i = 0; i < 8; i++) { c.fillStyle = r() < 0.85 ? '#ffd798' : '#2a1416'; c.fillRect(x0 + 30 + i * 76, 510, 54, 70); c.fillStyle = 'rgba(40,20,20,0.7)'; if (r() < 0.6) { c.beginPath(); c.arc(x0 + 57 + i * 76, 556, 10, 0, Math.PI * 2); c.fill(); } }
        c.strokeStyle = PAL.gold; c.lineWidth = 1.6; c.strokeRect(x0 + 10, 600, 620, 3);
      }
      c.fillStyle = '#0e0b10'; // the locomotive: the boiler with its bands, the stack, the dome, the cab
      c.beginPath(); c.roundRect(70, 440, 420, 170, 30); c.fill();
      c.beginPath(); c.moveTo(120, 445); c.lineTo(108, 330); c.lineTo(178, 330); c.lineTo(166, 445); c.closePath(); c.fill(); c.fillRect(98, 318, 90, 18);
      c.beginPath(); c.ellipse(300, 440, 46, 30, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.roundRect(440, 360, 190, 260, 8); c.fill(); c.fillRect(430, 350, 210, 18);
      c.fillStyle = '#ffd798'; c.fillRect(470, 392, 56, 64); c.fillRect(548, 392, 56, 64);
      c.fillStyle = '#0e0b10'; c.fillRect(40, 600, 600, 26); c.beginPath(); c.moveTo(40, 626); c.lineTo(10, 690); c.lineTo(110, 690); c.lineTo(110, 626); c.closePath(); c.fill();
      c.strokeStyle = PAL.gold; c.lineWidth = 2; for (const x of [150, 230, 340, 420]) { c.beginPath(); c.moveTo(x, 442); c.lineTo(x, 608); c.stroke(); }
      c.strokeRect(440, 360, 190, 260); c.beginPath(); c.roundRect(70, 440, 420, 170, 30); c.stroke();
      for (const x of [220, 360, 500]) { c.fillStyle = PAL.ver; c.beginPath(); c.arc(x, 690, 52, 0, Math.PI * 2); c.fill(); c.fillStyle = PAL.ink; c.beginPath(); c.arc(x, 690, 14, 0, Math.PI * 2); c.fill(); }
      glowDot(c, 60, 520, 70, 'rgba(255,236,190,A)', 0.9);
      for (let i = 0; i < 9; i++) { const x = 140 + i * 30 + r() * 30, y = 300 - i * 34, rr = 50 + i * 14; glowDot(c, x, y, rr, 'rgba(239,228,204,A)', 0.55 - i * 0.04); } // steam
      // the platform: its floor, the white edge, the canopy with its fretwork valance and iron columns
      c.fillStyle = '#2a2430'; c.fillRect(0, 740, W, 340); c.fillStyle = PAL.cream; c.fillRect(0, 740, W, 10);
      c.fillStyle = 'rgba(255,255,255,0.05)'; for (let x = 0; x < W; x += 90) c.fillRect(x, 750, 2, 330); for (let y = 800; y < H; y += 60) c.fillRect(0, y, W, 2);
      for (const x of [450, 1070, 1690]) { c.save(); c.translate(x, 790); c.scale(1, 0.18); glowDot(c, 0, 0, 260, 'rgba(255,200,120,A)', 0.4); c.restore(); } // the lamps' light on the platform
      c.fillStyle = PAL.ink; for (const x of [300, 980]) { c.fillRect(x, 860, 220, 14); c.fillRect(x, 820, 220, 10); c.fillRect(x + 12, 874, 10, 40); c.fillRect(x + 198, 874, 10, 40); } // benches
      c.fillRect(1500, 880, 120, 80); c.fillStyle = PAL.gold; c.fillRect(1500, 905, 120, 3); c.fillRect(1556, 868, 8, 12); // a trunk
      c.fillStyle = '#140d16'; c.fillRect(0, 0, W, 150);
      for (let x = 0; x < W; x += 40) { c.fillStyle = '#d9cfb2'; c.beginPath(); c.moveTo(x, 150); c.lineTo(x + 40, 150); c.lineTo(x + 40, 168); c.arc(x + 20, 168, 20, 0, Math.PI); c.closePath(); c.fill(); }
      c.fillStyle = PAL.gold; c.fillRect(0, 148, W, 2);
      for (const x of [140, 760, 1380]) { c.fillStyle = PAL.ink; c.fillRect(x - 9, 170, 18, 600); for (const s of [-1, 1]) { c.strokeStyle = PAL.ink; c.lineWidth = 8; c.beginPath(); c.moveTo(x, 280); c.quadraticCurveTo(x + s * 30, 190, x + s * 110, 172); c.stroke(); } }
      for (const x of [450, 1070, 1690]) gasLamp(c, x, 330, 150, 1);
      c.fillStyle = PAL.cream; c.fillRect(1560, 240, 120, 330); c.strokeStyle = PAL.ink; c.lineWidth = 4; c.strokeRect(1568, 248, 104, 314); // the station's name board
      c.fillStyle = PAL.ink; c.font = `70px ${SERIF900}`; drawColumn(c, '千本桜', 1620, 262, 74, () => 1);
      mikuStanding(c, 1280, 742, 330, 0.35, 0.8);
      decoFrame(c, W, H);
    }, 111));
    b.dyn((c, t) => { // the departure board: black, a gold frame, a flip card per glyph turning on its sung time
      const p = phraseAt(b.phrases, t);
      const n = p ? [...p.text].length : 0, cw = 68, bw = Math.max(8, n) * cw + 40, x0 = W / 2 - bw / 2 - 140, y0 = 190;
      c.fillStyle = '#0b080c'; c.fillRect(x0, y0, bw, 110); c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(x0 + 4, y0 + 4, bw - 8, 102);
      c.fillStyle = PAL.ink; c.fillRect(x0 + 40, y0 - 40, 4, 40); c.fillRect(x0 + bw - 44, y0 - 40, 4, 40);
      for (let j = 0; j < Math.max(8, n); j++) {
        const x = x0 + 20 + j * cw, ch = p ? [...p.text][j] : undefined, f = p && ch ? clamp((t - p.ct[j]!) / 0.12) : 0;
        const sy = Math.abs(Math.cos(f * Math.PI)); // the card turns over: closes, then opens on the new glyph
        c.save(); c.translate(x + cw / 2 - 3, y0 + 55); c.scale(1, f > 0 && f < 1 ? Math.max(0.05, sy) : 1);
        c.fillStyle = '#1e1a20'; c.fillRect(-cw / 2 + 4, -42, cw - 8, 84); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(-cw / 2 + 4, -1, cw - 8, 2);
        if (ch && f >= 0.5) { c.fillStyle = PAL.cream; c.font = `56px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 0, 2); }
        c.restore();
      }
    });
    b.petals(50);
  },

  // ---- verse 2 (lines 12–13): a kimono pattern world: yagasuri behind, a gold asanoha moon, Miku cut from the pattern
  kimono(b) {
    b.add(layer(W, H, (c) => {
      yagasuri(c, 0, 0, W, H, 96, PAL.ver, PAL.cream);
      c.fillStyle = 'rgba(28,15,30,0.42)'; c.fillRect(0, 0, W, H);
      c.save(); c.beginPath(); c.arc(760, 520, 410, 0, Math.PI * 2); c.clip();
      const g = c.createRadialGradient(700, 440, 40, 760, 520, 410); g.addColorStop(0, '#f2d58a'); g.addColorStop(1, '#c9a24a'); c.fillStyle = g; c.fillRect(300, 60, 920, 920);
      asanoha(c, 300, 60, 920, 920, 70, 'rgba(120,80,20,0.55)', 1.6); c.restore();
      c.strokeStyle = PAL.ink; c.lineWidth = 3; c.beginPath(); c.arc(760, 520, 410, 0, Math.PI * 2); c.stroke();
      // Miku in front of the moon, her figure cut from asanoha (gold lines on ink)
      const fig = layer(W, H, (s) => mikuStanding(s, 820, 1000, 900, 0.7, 2.1, ''));
      const pat = layer(W, H, (s) => { s.drawImage(fig, 0, 0, W, H); s.globalCompositeOperation = 'source-atop'; asanoha(s, 0, 0, W, H, 46, 'rgba(232,199,122,0.7)', 1.4); });
      c.drawImage(pat, 0, 0, W, H);
      for (const [x, y, rr] of [[1500, 160, 40], [1700, 360, 26], [1580, 880, 34], [220, 820, 30], [160, 220, 22]] as const) crest(c, x, y, rr, PAL.gold);
      c.fillStyle = PAL.cream; c.fillRect(1600, 120, 190, 760); c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(1608, 128, 174, 744);
      decoFrame(c, W, H);
    }, 121));
    b.dyn((c, t) => { // the phrase being sung, inked into the cream panel glyph by glyph
      const p = phraseAt(b.phrases, t);
      if (!p) return;
      const n = [...p.text].length, size = Math.min(110, 700 / (n * 1.06));
      c.font = `${size}px ${SERIF900}`; c.fillStyle = PAL.ink; drawColumn(c, p.text, 1695, 150, size, revealOf(p, t));
      sealStamp(c, '桜', 1695, 880 - 120, 46);
    });
    b.petals(40);
  },

  // ---- pre-chorus 2 (lines 14–15): a Western-style theatre, the velvet curtain opening on the beats, Miku in the light
  theatre(b) {
    const b0 = Math.ceil(b.audio.beatAt(b.start)), nb = Math.floor(b.audio.beatAt(b.end)) - b0;
    b.add(layer(W, H, (c) => {
      c.fillStyle = '#0a060c'; c.fillRect(0, 0, W, H);
      const g = c.createRadialGradient(W / 2, 600, 40, W / 2, 600, 520); g.addColorStop(0, '#fff0cc'); g.addColorStop(0.4, '#d9a35a'); g.addColorStop(1, '#2a1414'); // the lit stage
      c.fillStyle = g; c.fillRect(300, 180, 1320, 700);
      c.fillStyle = 'rgba(255,240,200,0.12)'; c.beginPath(); c.moveTo(W / 2 - 60, 180); c.lineTo(W / 2 + 60, 180); c.lineTo(W / 2 + 300, 880); c.lineTo(W / 2 - 300, 880); c.closePath(); c.fill(); // the spot
      mikuStanding(c, W / 2, 860, 470, 0.15, 0.4, 'rgba(255,230,180,0.9)');
    }, 131));
    b.dyn((c, t) => { // the curtain halves: velvet folds, a gold fringe; they open a step on every beat
      const k = clamp((b.audio.beatAt(t) - b0) / Math.max(1, nb)), open = ease.inOutCubic(k) * 560 + 20;
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? 300 : W / 2 + open / 2, x1 = side < 0 ? W / 2 - open / 2 : 1620;
        for (let x = x0; x < x1; x += 34) {
          const g = c.createLinearGradient(x, 0, x + 34, 0); g.addColorStop(0, '#4a0b0e'); g.addColorStop(0.5, '#a3191e'); g.addColorStop(1, '#3a080b');
          c.fillStyle = g; c.fillRect(x, 170, Math.min(34, x1 - x), 720);
        }
        c.fillStyle = PAL.gold; for (let x = x0; x < x1; x += 14) { c.beginPath(); c.moveTo(x, 880); c.lineTo(x + 7, 905); c.lineTo(x + 14, 880); c.closePath(); c.fill(); }
      }
    });
    b.add(layer(W, H, (c, r) => {
      // the proscenium: gold arch with a sunburst, fluted columns, the valance and the title plaque
      c.fillStyle = '#150b10';
      c.beginPath(); c.rect(0, 0, W, H); c.moveTo(300, 900); c.lineTo(300, 260); c.quadraticCurveTo(W / 2, 40, 1620, 260); c.lineTo(1620, 900); c.closePath(); c.fill('evenodd');
      c.strokeStyle = PAL.gold; c.lineWidth = 10; c.beginPath(); c.moveTo(300, 900); c.lineTo(300, 260); c.quadraticCurveTo(W / 2, 40, 1620, 260); c.lineTo(1620, 900); c.stroke();
      c.lineWidth = 2; for (let k = 0; k < 19; k++) { const a = Math.PI + (k / 18) * Math.PI; c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * 60, 150 + Math.sin(a) * 60); c.lineTo(W / 2 + Math.cos(a) * 130, 150 + Math.sin(a) * 130); c.stroke(); }
      for (const x of [255, 1665]) { c.fillStyle = '#2a1a10'; c.fillRect(x - 36, 240, 72, 660); c.strokeStyle = PAL.gold; c.lineWidth = 2; for (let f = -24; f <= 24; f += 12) { c.beginPath(); c.moveTo(x + f, 250); c.lineTo(x + f, 890); c.stroke(); } c.fillStyle = PAL.gold; c.fillRect(x - 46, 228, 92, 16); c.fillRect(x - 46, 890, 92, 16); }
      c.fillStyle = '#7a1016'; for (let x = 300; x < 1620; x += 110) { c.beginPath(); c.moveTo(x, 190); c.quadraticCurveTo(x + 55, 270, x + 110, 190); c.closePath(); c.fill(); }
      c.fillStyle = '#0d0909'; c.fillRect(W / 2 - 190, 150, 380, 86); c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(W / 2 - 182, 158, 364, 70);
      c.fillStyle = PAL.gold2; c.font = `54px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('千 本 桜', W / 2, 194);
      for (let x = 320; x < 1610; x += 46) glowDot(c, x, 895, 18, 'rgba(255,220,150,A)', 0.85); // footlights
      for (let row = 0; row < 2; row++) for (let x = -20; x < W + 40; x += 92) { // the audience, backlit
        const hx = x + (row ? 46 : 0) + (r() - 0.5) * 20, hy = 960 + row * 70 + (r() - 0.5) * 10;
        c.fillStyle = PAL.ink; c.beginPath(); c.arc(hx, hy, 26, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(hx, hy + 70, 52, 50, 0, 0, Math.PI * 2); c.fill();
        if (r() < 0.3) { c.fillRect(hx - 30, hy - 30, 60, 8); c.beginPath(); c.ellipse(hx, hy - 30, 22, 16, 0, Math.PI, 0); c.fill(); }
        c.strokeStyle = 'rgba(255,214,150,0.5)'; c.lineWidth = 1.6; c.beginPath(); c.arc(hx, hy, 26, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      }
    }, 132));
    b.dyn((c, t) => { // the phrase being sung on a hanging cream banner beside the stage
      const p = phraseAt(b.phrases, t);
      if (!p) return;
      const n = [...p.text].length, size = Math.min(76, 560 / (n * 1.06));
      c.fillStyle = PAL.cream; c.fillRect(1680, 280, 150, 640); c.strokeStyle = PAL.ver; c.lineWidth = 6; c.strokeRect(1686, 286, 138, 628);
      c.font = `${size}px ${SERIF900}`; c.fillStyle = PAL.ink; drawColumn(c, p.text, 1755, 310, size, revealOf(p, t));
    });
    b.petals(30);
  },

  // ---- chorus 2: the stage as a paper diorama: cut-out moon on strings, hills, a row of tiny torii, waves, sakura, Miku
  diorama(b) {
    b.add(layer(W, H, (c, r) => {
      c.fillStyle = '#0a060c'; c.fillRect(0, 0, W, H);
      c.save(); c.translate(W / 2, 520); c.scale(1.28, 1.28); c.translate(-W / 2, -520);
      const g = c.createLinearGradient(0, 180, 0, 880); g.addColorStop(0, '#2b1530'); g.addColorStop(1, '#6a3354'); c.fillStyle = g; c.fillRect(300, 180, 1320, 700);
      const cut = (draw: (c: C) => void, dy = 0) => { // a paper cut-out: a soft shadow behind it, a pale paper edge
        c.save(); c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 18; c.shadowOffsetY = 10 + dy; draw(c); c.restore();
        c.save(); c.globalCompositeOperation = 'source-over'; draw(c); c.restore();
      };
      c.strokeStyle = 'rgba(239,228,204,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(1180, 180); c.lineTo(1180, 270); c.moveTo(1300, 180); c.lineTo(1300, 270); c.stroke();
      cut((c) => { c.fillStyle = '#f3e3b0'; c.beginPath(); c.arc(1240, 330, 95, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fffaf0'; c.lineWidth = 3; c.stroke(); });
      cut((c) => { c.fillStyle = '#3a1d3c'; c.beginPath(); c.moveTo(300, 700); for (let x = 300; x <= 1620; x += 40) c.lineTo(x, 610 - 90 * Math.sin((x - 300) * 0.006) - 40 * Math.sin(x * 0.02)); c.lineTo(1620, 880); c.lineTo(300, 880); c.closePath(); c.fill(); c.strokeStyle = 'rgba(239,228,204,0.5)'; c.lineWidth = 2; c.stroke(); });
      for (let k = 0; k < 6; k++) { // the row of tiny torii, smaller further back
        const s = 1 - k * 0.14, x = 640 + k * 70, y = 740 - k * 22;
        cut((c) => { c.fillStyle = PAL.ver; c.fillRect(x - 46 * s, y - 120 * s, 10 * s, 120 * s); c.fillRect(x + 36 * s, y - 120 * s, 10 * s, 120 * s); c.fillRect(x - 58 * s, y - 128 * s, 116 * s, 12 * s); c.fillStyle = PAL.ink; c.fillRect(x - 64 * s, y - 140 * s, 128 * s, 12 * s); });
      }
      cut((c) => { c.save(); c.beginPath(); c.rect(300, 760, 1320, 120); c.clip(); seigaiha(c, 300, 760, 1320, 120, 40, '#1f3a46', '#d9cfb2'); c.restore(); }, 4);
      cut((c) => { sakuraTree(c, 340, 880, 115, -Math.PI / 2 + 0.25, r, { ink: '#1a0e18', bloom: 1.2, depth: 5 }); sakuraTree(c, 1580, 880, 115, -Math.PI / 2 - 0.25, r, { ink: '#1a0e18', bloom: 1.2, depth: 5 }); });
      c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 14; mikuStanding(c, 1000, 800, 300, 0.4, 0.5, 'rgba(239,228,204,0.9)'); c.restore();
      c.strokeStyle = '#5a3a20'; c.lineWidth = 5; c.beginPath(); c.moveTo(1010, 800); c.lineTo(1010, 900); c.stroke(); // the puppet's rod
      c.fillStyle = 'rgba(255,240,200,0.10)'; c.beginPath(); c.moveTo(500, 180); c.lineTo(640, 180); c.lineTo(1100, 880); c.lineTo(700, 880); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(1300, 180); c.lineTo(1440, 180); c.lineTo(1300, 880); c.lineTo(900, 880); c.closePath(); c.fill();
      // the proscenium again (as the theatre's), the curtains gathered at the sides
      c.fillStyle = '#150b10';
      c.beginPath(); c.rect(0, 0, W, H); c.moveTo(300, 900); c.lineTo(300, 260); c.quadraticCurveTo(W / 2, 40, 1620, 260); c.lineTo(1620, 900); c.closePath(); c.fill('evenodd');
      for (const side of [-1, 1]) { const x0 = side < 0 ? 300 : 1500; for (let x = x0; x < x0 + 120; x += 24) { const gg = c.createLinearGradient(x, 0, x + 24, 0); gg.addColorStop(0, '#4a0b0e'); gg.addColorStop(0.5, '#a3191e'); gg.addColorStop(1, '#3a080b'); c.fillStyle = gg; c.fillRect(x, 170, 24, 730); } }
      c.strokeStyle = PAL.gold; c.lineWidth = 10; c.beginPath(); c.moveTo(300, 900); c.lineTo(300, 260); c.quadraticCurveTo(W / 2, 40, 1620, 260); c.lineTo(1620, 900); c.stroke();
      c.fillStyle = '#2a1a10'; c.fillRect(300, 880, 1320, 40); c.fillStyle = PAL.gold; c.fillRect(300, 880, 1320, 3);
      for (let x = 320; x < 1610; x += 46) glowDot(c, x, 895, 18, 'rgba(255,220,150,A)', 0.85);
      c.restore();
      decoFrame(c, W, H);
    }, 141));
    b.petals(60);
  },

  // ---- the build: the station clock's works: gold gears turning faster and faster, the face, a spiral of petals
  clock(b) {
    b.add(layer(W, H, (c, r) => {
      c.fillStyle = PAL.night0; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(201,162,74,0.12)'; c.lineWidth = 2; for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; c.beginPath(); c.moveTo(1240, 540); c.lineTo(1240 + Math.cos(a) * 1500, 540 + Math.sin(a) * 1500); c.stroke(); }
      void r;
    }, 151));
    const gears: [number, number, number, number, number][] = [[520, 360, 230, 36, 1], [820, 560, 140, 22, -1], [420, 760, 170, 26, -1], [700, 860, 100, 16, 1], [980, 300, 110, 18, 1]];
    b.dyn((c, t) => {
      const sp = clamp((t - b.start) / (b.end - b.start)), ang = (t - b.start) * (0.4 + 2.6 * sp * sp); // they spin up through the build
      for (const [x, y, rr, n, dir] of gears) gear(c, x, y, rr, n, (dir * ang * 230) / rr, '#b8892e');
      c.save(); c.translate(1240, 540); // the clock: a gold bezel, the cream face, the numerals, the hands
      c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(0, 0, 360, 0, Math.PI * 2); c.fill(); c.fillStyle = '#8a6a26'; c.beginPath(); c.arc(0, 0, 330, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#efe4cc'; c.beginPath(); c.arc(0, 0, 318, 0, Math.PI * 2); c.fill();
      c.fillStyle = PAL.ink; c.font = `52px ${SERIF600}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const nums = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      nums.forEach((s, i) => { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; c.save(); c.translate(Math.cos(a) * 250, Math.sin(a) * 250); c.rotate(a + Math.PI / 2); c.fillText(s, 0, 0); c.restore(); });
      for (let k = 0; k < 60; k++) { const a = (k / 60) * Math.PI * 2; c.fillRect(Math.cos(a) * 296 - 1.5, Math.sin(a) * 296 - (k % 5 ? 4 : 10), 3, k % 5 ? 8 : 20); }
      crest(c, 0, 110, 34, PAL.ver);
      const hand = (a: number, L: number, w: number) => { c.save(); c.rotate(a); c.fillStyle = PAL.ink; c.beginPath(); c.moveTo(-w, 20); c.lineTo(0, -L); c.lineTo(w, 20); c.closePath(); c.fill(); c.restore(); };
      hand(ang * 0.6, 180, 12); hand(ang * 7.2, 270, 7);
      c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fill(); c.restore();
      const pa = Math.sin((t - b.start) * Math.PI * 2 * (0.6 + 0.8 * sp)) * 0.35; // the pendulum
      c.save(); c.translate(1240, 900); c.rotate(pa); c.fillStyle = '#b8892e'; c.fillRect(-4, 0, 8, 150); c.beginPath(); c.arc(0, 160, 34, 0, Math.PI * 2); c.fill(); c.restore();
      for (let i = 0; i < 70; i++) { // petals spiralling in toward the centre
        const k = ((i / 70 + (t - b.start) * (0.08 + 0.2 * sp)) % 1 + 1) % 1, a = i * 2.4 + k * 9, rr = 900 * (1 - k);
        c.fillStyle = i % 2 ? PAL.sakura : PAL.sakura2; c.beginPath(); c.ellipse(1240 + Math.cos(a) * rr, 540 + Math.sin(a) * rr * 0.7, 7, 4.5, a, 0, Math.PI * 2); c.fill();
      }
    });
    b.add(layer(W, H, (c) => decoFrame(c, W, H), 1));
    b.petals(0);
  },

  // ---- pre-chorus 3 (lines 20–21): Miku leaping across a gap between the roofs, the moon behind her, the phrase stamped
  roofrun(b) {
    b.add(layer(W, H, (c, r) => { nightSky(c, r); moonDisc(c, 1180, 420, 330, r); }, 161));
    b.add(layer(WW, H, (c, r) => skyline(c, WW, 900, r, { fill: '#2a1430', win: 0.3, scale: 0.6 }), 162), { px: PAD, drift: 0.8 });
    const RW = W + 800; // the near roofs truck 2.2× the camera: their canvas runs on 400 px past both sides
    b.add(layer(RW, H, (c) => {
      for (const [x0, x1, y] of [[-40, 960, 860], [1440, RW + 40, 900]] as const) { // two roofs and the gap between them
        c.fillStyle = '#140d18'; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.lineTo(x1 + 60, H); c.lineTo(x0 - 60, H); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(201,162,74,0.25)'; c.lineWidth = 2; for (let x = x0; x < x1; x += 30) { c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x + (x - (x0 + x1) / 2) * 0.2, H); c.stroke(); }
        c.fillStyle = '#0d0910'; c.fillRect(x0, y - 22, x1 - x0, 24); c.strokeStyle = PAL.gold; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x0, y - 22); c.lineTo(x1, y - 22); c.stroke();
      }
    }, 163), { px: 400, drift: 2.2 });
    b.dyn((c, t, lt) => {
      c.strokeStyle = 'rgba(239,228,204,0.35)'; c.lineWidth = 2; // speed lines
      for (let i = 0; i < 26; i++) { const y = 140 + hash(i, 7) * 820, x = ((hash(i, 8) * W - lt * 1400) % W + W) % W, L = 80 + 200 * hash(i, 9); c.beginPath(); c.moveTo(x, y); c.lineTo(x + L, y); c.stroke(); }
      const arc = ((lt * 0.9) % 1), hx = 620 + arc * 760, hy = 690 - Math.sin(arc * Math.PI) * 170;
      mikuLeap(c, hx, hy, 380, t * 7);
      const p = phraseAt(b.phrases, t);
      if (p) { const n = [...p.text].length, size = Math.min(120, 780 / (n * 1.06)); c.font = `${size}px ${SERIF900}`; c.fillStyle = PAL.cream; c.strokeStyle = PAL.gold; c.lineWidth = 2.5; drawColumn(c, p.text, 190, 110, size, revealOf(p, t), true); sealStamp(c, '桜', 330, 110, 48); }
    });
    b.add(layer(W, H, (c) => decoFrame(c, W, H), 1));
    b.petals(220);
  },

  // ---- the peak chorus: the worlds as a triptych of panels (they cut on the beat in the film), the title stamped across
  montage(b) {
    b.add(layer(W, H, (c, r) => {
      c.fillStyle = PAL.night0; c.fillRect(0, 0, W, H);
      const panel = (x0: number, draw: (c: C) => void) => { c.save(); c.beginPath(); c.rect(x0 + 10, 60, 620, 960); c.clip(); c.translate(x0, 0); draw(c); c.restore(); c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(x0 + 10, 60, 620, 960); };
      panel(0, (c) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, PAL.night0); g.addColorStop(1, '#6a3354'); c.fillStyle = g; c.fillRect(0, 0, 640, H); moonDisc(c, 420, 300, 90, r); skyline(c, 640, 860, r, { fill: '#1d0e22', win: 0.2, rim: 'rgba(201,162,74,0.6)', scale: 1.1, tower: 300 }); sakuraTree(c, 60, 1080, 220, -Math.PI / 2 + 0.25, r, { ink: '#140b12', glow: 'rgba(247,182,204,0.4)', bloom: 1.6, depth: 5 }); });
      panel(640, (c) => { c.fillStyle = PAL.plum; c.fillRect(0, 0, 640, H); moonDisc(c, 320, 470, 250, r); mikuStanding(c, 330, 900, 400, 0.9, 1.4); c.fillStyle = '#140d18'; c.fillRect(0, 900, 640, 200); });
      panel(1280, (c) => { c.fillStyle = '#0e0a1c'; c.fillRect(0, 0, 640, H); for (const [x, y, R, col] of [[220, 260, 170, 'rgba(255,214,140,'], [470, 470, 140, 'rgba(247,182,204,']] as const) for (let i = 0; i < 56; i++) { const a = (i / 56) * Math.PI * 2; for (let k = 1; k < 12; k++) { const d = (k / 11) * R; c.fillStyle = col + `${0.2 + 0.8 * (k / 11) ** 2})`; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + 2.2 * (k / 11), 0, Math.PI * 2); c.fill(); } } skyline(c, 640, 860, r, { fill: PAL.ink, win: 0.1, scale: 0.8 }); c.fillStyle = '#0b0712'; c.fillRect(0, 860, 640, 220); });
      sealStamp(c, '千本桜', W / 2, 60, 88);
    }, 171));
    b.dyn((c, t) => { // the phrase being sung, stamped in cream across the bottom
      const p = phraseAt(b.phrases, t);
      if (!p) return;
      c.font = `76px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const chars = [...p.text], wd = chars.length * 80;
      chars.forEach((ch, j) => { const a = revealOf(p, t)(j); if (a <= 0) return; c.globalAlpha = a; c.fillStyle = PAL.cream; c.strokeStyle = PAL.ver; c.lineWidth = 6; c.strokeText(ch, W / 2 - wd / 2 + 40 + j * 80, 960); c.fillText(ch, W / 2 - wd / 2 + 40 + j * 80, 960); });
      c.globalAlpha = 1;
    });
    b.add(layer(W, H, (c) => decoFrame(c, W, H), 1));
    b.petals(160);
  },

  // ---- the end: a hanging scroll with the credits, an ink sakura branch, the seal
  scroll(b) {
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, '#1a0f1c', 'rgba(255,240,220,0.03)', 0.05);
      const g = c.createRadialGradient(560, 300, 50, 560, 300, 1300); g.addColorStop(0, 'rgba(230,200,150,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.4)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const x0 = W / 2 - 330, x1 = W / 2 + 330;
      c.strokeStyle = PAL.gold; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2, 20); c.lineTo(x0 + 40, 70); c.moveTo(W / 2, 20); c.lineTo(x1 - 40, 70); c.stroke(); // the cord
      c.fillStyle = '#3a1d3c'; c.fillRect(x0, 70, 660, 960); // the brocade mount, a grid of small crests
      for (let y = 90; y < 1020; y += 44) for (let x = x0 + 20; x < x1 - 10; x += 44) crest(c, x, y, 9, 'rgba(201,162,74,0.55)', false);
      c.fillStyle = PAL.cream; c.fillRect(x0 + 70, 150, 520, 780);
      c.save(); c.beginPath(); c.rect(x0 + 70, 150, 520, 780); c.clip(); washi(c, W, H, r, PAL.cream, 'rgba(120,90,60,0.08)', 0.02);
      sakuraTree(c, x0 + 50, 130, 105, 0.38, r, { ink: PAL.ink, bloom: 1.0, depth: 5, cols: ['#c8321e', '#e88aa8', '#f2b8c6'] }); c.restore();
      c.fillStyle = PAL.ink; c.textAlign = 'center';
      c.font = `96px ${SERIF900}`; drawColumn(c, '千本桜', x1 - 180, 300, 96, () => 1);
      c.font = `34px "Cormorant-600", ${SERIF600}`; // the Latin letters from Cormorant, the rest from the CJK subset
      const lines = ['作詞・作曲　黒うさP', '唄　初音ミク', CREDIT ? `映像　${CREDIT}` : '非公式ファン映像'];
      lines.forEach((s, i) => drawColumn(c, s, x1 - 300 - i * 70, 330, 36, () => 1));
      sealStamp(c, '桜', x0 + 150, 760, 52);
      for (const y of [70, 1030]) { c.fillStyle = PAL.ink; c.fillRect(x0 - 30, y - 14, 720, 28); c.fillStyle = PAL.gold; c.fillRect(x0 - 44, y - 16, 22, 32); c.fillRect(x1 + 22, y - 16, 22, 32); } // the rollers
    }, 181));
    b.petals(50);
  },
};
