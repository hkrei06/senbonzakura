// Pre-chorus 3 (docs/TREATMENT.md): midnight has struck (clockworks.ts). A paper crane folded from washi flies out
// over the sleeping city toward the mountain where the thousand torii glow: a long flight to the right above the tiled
// roofs — near ridges whipping under it, the river shining between the town and the skyline with the twelve-storey
// tower, the moon over the mountain and the lit line of gates zigzagging up it to the shrine. It beats its wings on the
// beats; each phrase inks itself along its near wing as it is sung (and stands in a column at the left). On the last
// bar it climbs away toward the shrine, small against the moon: the next cut is inside the tunnel (chorus 3a).
import type { Build } from './poster';
import { W, H } from '../engine/gl';
import { TAU, clamp, ease, hash, lerp } from '../engine/util';
import { PAL, SERIF900, layer, decoFrame, moonDisc, skyline, sealStamp } from './taisho';
import { drawColumn, type Phrase } from './torii';

type C = CanvasRenderingContext2D;
const phraseAt = (ph: Phrase[], t: number) => { let p: Phrase | undefined; for (const x of ph) if (x.t <= t + 0.05) p = x; return p; };
const revealOf = (p: Phrase, t: number) => (j: number) => clamp((t - p.ct[j]!) / 0.09);

/** An origami crane (orizuru) seen from the side, flying right: the body's kite, the neck and the bent head forward, the
 *  tail back, the far wing behind and the near wing in front, flapping (flap: -1 wings down … 1 up). Faceted washi, lit
 *  from the moon (upper right). write(c): draws on the near wing in its own frame (the phrase). */
function crane(c: C, x: number, y: number, s: number, flap: number, write?: (c: C, len: number) => void) {
  const P = (px: number, py: number): [number, number] => [x + px * s, y + py * s];
  const tri = (a: [number, number], b: [number, number], d: [number, number], col: string) => { c.fillStyle = col; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.closePath(); c.fill(); };
  const edge = 'rgba(80,60,50,0.35)';
  const wingTip = (k: number): [number, number] => [-0.15 + 0.1 * k, -1.05 * flap * k - 0.1]; // the tip rides up and down
  // the far wing (behind, in shadow)
  const [fx, fy] = wingTip(0.85);
  tri(P(-0.28, -0.05), P(0.3, -0.05), P(fx - 0.2, fy + (flap < 0 ? 0.25 : 0)), '#b9b0a2');
  // the tail (back and up), the body's kite, the neck (forward and up) and the head bent down
  tri(P(-0.3, 0.0), P(-0.05, 0.08), P(-1.05, -0.42), '#e9e1d2');
  tri(P(-0.3, 0.0), P(-0.05, 0.08), P(-1.05, -0.42), 'rgba(120,100,90,0.18)');
  tri(P(-0.35, 0.0), P(0.35, 0.0), P(0.0, 0.22), '#d8cfbf');
  tri(P(-0.35, 0.0), P(0.35, 0.0), P(0.0, -0.1), '#f4eee2');
  tri(P(0.05, 0.08), P(0.3, 0.0), P(0.95, -0.52), '#efe8da');
  tri(P(0.95, -0.52), P(0.9, -0.44), P(1.12, -0.38), '#e2dacb');
  c.strokeStyle = edge; c.lineWidth = Math.max(0.8, s * 0.006);
  c.beginPath(); c.moveTo(...P(-0.35, 0.0)); c.lineTo(...P(0.35, 0.0)); c.lineTo(...P(0.0, 0.22)); c.closePath(); c.stroke();
  c.fillStyle = PAL.ver; c.beginPath(); c.arc(...P(1.0, -0.47), s * 0.025, 0, TAU); c.fill(); // a vermilion mark on the head
  // the near wing, lit when raised, shaded when down; the phrase along it
  const [nx, ny] = wingTip(1);
  const root0 = P(-0.3, -0.04), root1 = P(0.32, -0.04), tip = P(nx, ny);
  tri(root0, root1, tip, flap > 0 ? '#fbf7ee' : '#ddd4c4');
  tri(root0, root1, tip, `rgba(255,236,200,${0.12 + 0.12 * Math.max(0, flap)})`);
  c.beginPath(); c.moveTo(...root0); c.lineTo(...root1); c.lineTo(...tip); c.closePath(); c.stroke();
  c.beginPath(); c.moveTo(...P(0.01, -0.04)); c.lineTo(...tip); c.stroke(); // the fold
  if (write) {
    const mx = (root0[0] + root1[0]) / 2, my = (root0[1] + root1[1]) / 2, a = Math.atan2(tip[1] - my, tip[0] - mx), len = Math.hypot(tip[0] - mx, tip[1] - my);
    c.save(); c.translate(mx, my); c.rotate(a); write(c, len); c.restore();
  }
}

export const PRE3: Record<string, (b: Build) => void> = {
  crane(b) {
    const A = b.audio, T0 = b.start, T1 = b.end, bar0 = Math.round(A.barAt(T0)), Tlast = A.timeOfBar(bar0 + 6), V = 260;
    const camX = (t: number) => V * (t - T0) - 90 * Math.max(0, t - Tlast) ** 2; // trucking with the crane; easing as it climbs away
    const XE = camX(T1) + 40;
    // the sky, the moon over the mountain, the mountain with its lit line of gates
    b.add(layer(W, H, (c, r) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#070612'); g.addColorStop(0.55, PAL.night1); g.addColorStop(0.85, '#4a2442'); g.addColorStop(1, '#5a2a46');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 380; i++) { c.fillStyle = `rgba(255,240,220,${0.15 + 0.55 * r()})`; c.fillRect(r() * W, r() * H * 0.55, 1.4, 1.4); }
      const halo = c.createRadialGradient(1480, 230, 60, 1480, 230, 520); halo.addColorStop(0, 'rgba(255,236,200,0.28)'); halo.addColorStop(1, 'rgba(255,236,200,0)');
      c.fillStyle = halo; c.fillRect(0, 0, W, H);
      moonDisc(c, 1480, 230, 150, r);
    }, 1761));
    const MW = Math.ceil(W + 0.08 * XE + 100);
    let line: [number, number][] = [];
    b.add(layer(MW, H, (c, r) => {
      c.fillStyle = '#1c1024'; c.beginPath(); c.moveTo(900, 700); // the mountain, the shrine on its top under the moon
      for (let x = 900; x <= MW; x += 20) c.lineTo(x, 700 - 250 * Math.exp(-(((x - 1560) / 300) ** 2)) - 40 * Math.sin(x * 0.01) * Math.exp(-(((x - 1560) / 600) ** 2)) - 30 * r());
      c.lineTo(MW, H - 2); c.lineTo(900, H - 2); c.closePath(); c.fill(); // (short of the layer's bottom edge: the town hides it)
      c.strokeStyle = 'rgba(232,199,122,0.25)'; c.lineWidth = 1.2; c.stroke();
      const pts: [number, number][] = [[1320, 690], [1420, 640], [1360, 600], [1490, 555], [1440, 520], [1545, 478]];
      line = [];
      for (let k = 0; k + 1 < pts.length; k++) for (let u = 0; u < 1; u += 0.04) line.push([lerp(pts[k]![0], pts[k + 1]![0], u), lerp(pts[k]![1], pts[k + 1]![1], u)]);
      c.fillStyle = '#2a1018'; c.fillRect(1530, 462, 34, 16); c.beginPath(); c.moveTo(1522, 464); c.lineTo(1547, 450); c.lineTo(1572, 464); c.closePath(); c.fill(); // the shrine
    }, 1762), { p: 0.08 });
    b.dyn((c, t) => { // the line of gates, its lamps a chain of light up the mountain, a ripple running up it on the beats
      const bt = A.beatAt(t);
      c.save(); c.globalCompositeOperation = 'lighter';
      line.forEach(([x, y], i) => {
        const run = Math.exp(-(((i / line.length - (bt % 1)) * 6) ** 2));
        c.fillStyle = `rgba(255,${150 + 60 * run},${80 + 60 * run},${0.55 + 0.45 * run})`; c.beginPath(); c.arc(x, y, 1.8 + 1.4 * run, 0, TAU); c.fill();
      });
      const g = c.createRadialGradient(1547, 466, 2, 1547, 466, 40); g.addColorStop(0, 'rgba(255,200,130,0.8)'); g.addColorStop(1, 'rgba(255,200,130,0)'); c.fillStyle = g; c.fillRect(1500, 420, 95, 95);
      c.restore();
    }, { p: 0.08 });
    // the far town and its tower (midnight on its clock), the river under it shining
    const CW = Math.ceil(W + 0.2 * XE + 200);
    b.add(layer(CW, H, (c, r) => {
      skyline(c, CW, 660, r, { fill: '#1a0e1e', win: 0.18, rim: 'rgba(201,162,74,0.32)', scale: 0.62, tower: 520 });
      c.fillStyle = '#0d0912'; c.fillRect(0, 660, CW, 60);
      for (let y = 664; y < 720; y += 3) { c.fillStyle = `rgba(255,214,150,${0.05 + 0.08 * r()})`; for (let x = 0; x < CW; x += 40 + r() * 80) c.fillRect(x, y, 8 + r() * 30, 1.2); } // the town's lights in the water
    }, 1763), { p: 0.2 });
    b.dyn((c, t) => { // the moon's path on the river, glittering
      for (let k = 0; k < 60; k++) { const x = 1480 + 0.2 * camX(t) - 70 + 140 * hash(k, 3) + 6 * Math.sin(t * 3 + k), y = 668 + 48 * hash(k, 4); c.fillStyle = `rgba(255,240,210,${0.25 + 0.5 * Math.abs(Math.sin(t * 4 + k * 1.7))})`; c.fillRect(x - 6, y, 12 + 10 * hash(k, 5), 1.6); }
    }, { p: 0.2 });
    // the town's roofs (drawn once): rows of tiled roofs seen a little from above, their tile courses catching the moon
    // (from the upper right), lit windows under the eaves, white storehouses, a fire-watch tower with its bell
    const RW = Math.ceil(W + 0.6 * XE + 300);
    b.add(layer(RW, H, (c, r) => {
      const towerAt = 1400 + r() * 300;
      for (let row = 0; row < 2; row++) {
        let x = -40 + row * 90;
        const base = 760 + row * 70;
        while (x < RW) {
          const w = 140 + r() * 160, h = 46 + r() * 40, kura = r() < 0.16, top = base - h - 30;
          if (kura) { // a storehouse: a moonlit plaster face, its side in shadow, a namako base (a diagonal lattice), a small window
            const g = c.createLinearGradient(0, base - h, 0, base + 30); g.addColorStop(0, '#8f877a'); g.addColorStop(1, '#3a3330');
            c.fillStyle = g; c.fillRect(x + 8, base - h, w - 40, h + 28);
            c.fillStyle = '#2a2427'; c.fillRect(x + w - 32, base - h, 24, h + 28);
            c.fillStyle = '#120c14'; c.fillRect(x + 8, base + 28, w - 16, 200); // (the lane below it in the dark)
            c.save(); c.beginPath(); c.rect(x + 8, base - h * 0.32, w - 16, h * 0.32 + 60); c.clip(); c.fillStyle = '#1a1619'; c.fill();
            c.strokeStyle = 'rgba(210,200,180,0.3)'; c.lineWidth = 1;
            for (let d = -80; d < w + 80; d += 12) { c.beginPath(); c.moveTo(x + d, base - h * 0.32); c.lineTo(x + d + 60, base + 25); c.moveTo(x + d + 60, base - h * 0.32); c.lineTo(x + d, base + 25); c.stroke(); }
            c.restore();
            c.fillStyle = '#0d0a0c'; c.fillRect(x + w / 2 - 14, base - h + 12, 16, 13);
          } else {
            c.fillStyle = '#120c14'; c.fillRect(x + 8, base - h, w - 16, h + 200);
            for (let k = 0; k < (w - 30) / 28; k++) if (r() < 0.45) { c.fillStyle = PAL.warm; c.globalAlpha = 0.5 + 0.4 * r(); c.fillRect(x + 18 + k * 28, base - h + 14, 14, 18); c.globalAlpha = 1; c.fillStyle = 'rgba(30,18,14,0.8)'; c.fillRect(x + 24 + k * 28, base - h + 14, 2, 18); }
          }
          // the roof's plane, the moon on its upper courses
          const roof = new Path2D(); roof.moveTo(x - 6, base - h + 4); roof.lineTo(x + 18, top); roof.lineTo(x + w - 18, top); roof.lineTo(x + w + 6, base - h + 4); roof.closePath();
          const rg = c.createLinearGradient(0, top, 0, base - h); rg.addColorStop(0, kura ? '#3a3640' : '#2a2430'); rg.addColorStop(1, '#0b080d');
          c.fillStyle = rg; c.fill(roof);
          c.save(); c.clip(roof); c.lineWidth = 1.2;
          for (let k = x - 4; k < x + w + 8; k += 8) { c.strokeStyle = `rgba(214,200,226,${0.1 + 0.1 * r()})`; c.beginPath(); c.moveTo(k + (k - x - w / 2) * 0.1, top); c.lineTo(k + (k - x - w / 2) * 0.24, base - h + 4); c.stroke(); } // tile courses
          c.restore();
          c.strokeStyle = 'rgba(201,162,74,0.35)'; c.lineWidth = 1; c.stroke(roof);
          c.fillStyle = '#0b080d'; c.fillRect(x + 12, top - 6, w - 24, 7); for (const ex of [x + 10, x + w - 22]) c.fillRect(ex, top - 14, 12, 14); // the ridge, its end tiles
          c.fillStyle = 'rgba(214,200,226,0.35)'; c.fillRect(x + 12, top - 6, w - 24, 1.5);
          if (row === 0 && x < towerAt && x + w > towerAt) { // the fire-watch tower: a lattice of legs, a ladder, the bell under its little roof
            const tx = towerAt, tb = top - 4, tt = tb - 260;
            c.strokeStyle = '#0a070c'; c.lineWidth = 4;
            c.beginPath(); c.moveTo(tx - 30, tb); c.lineTo(tx - 12, tt); c.moveTo(tx + 30, tb); c.lineTo(tx + 12, tt); c.stroke();
            c.lineWidth = 1.6; for (let y = tb; y > tt; y -= 32) { const k = (tb - y) / 260; c.beginPath(); c.moveTo(tx - 30 + 18 * k, y); c.lineTo(tx + 30 - 18 * k, y - 32); c.moveTo(tx + 30 - 18 * k, y); c.lineTo(tx - 30 + 18 * k, y - 32); c.stroke(); }
            c.fillStyle = '#0a070c'; c.fillRect(tx - 22, tt - 4, 44, 6); c.beginPath(); c.moveTo(tx - 26, tt - 26); c.lineTo(tx, tt - 46); c.lineTo(tx + 26, tt - 26); c.closePath(); c.fill();
            c.fillStyle = '#b8892e'; c.beginPath(); c.moveTo(tx - 7, tt - 10); c.quadraticCurveTo(tx, tt - 26, tx + 7, tt - 10); c.closePath(); c.fill(); // the bell
          }
          x += w + 4 + r() * 24;
        }
      }
    }, 1764), { p: 0.6 });
    // telegraph wires and poles over the near roofs; the near ridges whipping under the crane
    b.dyn((c, t) => {
      const u0 = 1.1 * camX(t) - 200;
      c.strokeStyle = 'rgba(10,6,12,0.9)'; c.lineWidth = 1.6;
      for (let k = Math.floor(u0 / 900); k <= Math.ceil((u0 + W + 400) / 900); k++) {
        const x = k * 900 + 300;
        c.fillStyle = '#08050a'; c.fillRect(x - 7, 330, 14, H);
        c.fillRect(x - 60, 350, 120, 6);
        for (const dy of [0, 14]) { c.beginPath(); c.moveTo(x - 56, 353 + dy); c.quadraticCurveTo(x + 450, 420 + dy, x + 900 - 56, 353 + dy); c.stroke(); }
      }
    }, { p: 1.1 });
    b.dyn((c, t) => {
      const u0 = 1.5 * camX(t) - 300;
      for (let k = Math.floor(u0 / 1150); k <= Math.ceil((u0 + W + 600) / 1150); k++) {
        const x = k * 1150 + 180 * hash(k, 9), w = 760 + 260 * hash(k, 8), y = 940 + 50 * hash(k, 7);
        c.fillStyle = '#060408'; c.beginPath(); c.moveTo(x, H + 10); c.lineTo(x + 60, y); c.lineTo(x + w - 60, y); c.lineTo(x + w, H + 10); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(201,162,74,0.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 60, y); c.lineTo(x + w - 60, y); c.stroke();
        c.fillStyle = '#060408'; c.fillRect(x + 50, y - 16, w - 100, 16); for (const ex of [x + 44, x + w - 70]) { c.beginPath(); c.arc(ex + 13, y - 18, 16, Math.PI, 0); c.fill(); } // the ridge and its onigawara
      }
    }, { p: 1.5 });
    // the crane: across the frame with the camera, its wings beating on the beats, the phrase inking along its wing;
    // on the last bar it climbs away toward the shrine
    b.dyn((c, t, lt) => {
      const bt = A.beatAt(t), ph = bt - Math.floor(bt), flap = Math.cos(ph * TAU) * (ph < 0.35 ? 1 : 0.85); // up on the off-beat, down hard on the beat
      const away = ease.inOutCubic(clamp((t - Tlast) / (T1 - Tlast)));
      const x = lerp(lerp(560, 860, clamp(lt / (Tlast - T0))), 1547 - 0.08 * camX(T1), away), y = lerp(430 + 22 * Math.sin(lt * 1.9) - 18 * flap, 470, away), s = lerp(270, 30, away); // (to the shrine, where the mountain's parallax leaves it)
      const p = phraseAt(b.phrases, t);
      crane(c, x, y, s, flap, p && away < 0.4 ? (cc, len) => {
        const chars = [...p.text], sz = Math.min(26, (len * 0.82) / chars.length) * (s / 270);
        cc.font = `${sz.toFixed(1)}px ${SERIF900}`; cc.textAlign = 'center'; cc.textBaseline = 'middle'; cc.fillStyle = PAL.ink;
        chars.forEach((ch, j) => { const a = revealOf(p, t)(j); if (a <= 0) return; cc.globalAlpha = a * 0.85; cc.fillText(ch, len * 0.12 + j * sz * 1.05, 0); });
        cc.globalAlpha = 1;
      } : undefined);
    }, { p: -1 });
    // the phrase in a column at the left, as everywhere: cream, a gold edge, stamped as sung; the seal at the end
    b.dyn((c, t) => {
      const p = phraseAt(b.phrases, t);
      if (p) { const n = [...p.text].length, size = Math.min(112, 760 / (n * 1.06)); c.font = `${size}px ${SERIF900}`; c.fillStyle = PAL.cream; c.strokeStyle = PAL.gold; c.lineWidth = 2.5; drawColumn(c, p.text, 200, 120, size, revealOf(p, t), true); }
      if (t > Tlast + 0.6) { const u = ease.outBack(clamp((t - Tlast - 0.6) / 0.2), 2); c.save(); c.translate(1480, 230 + 150 + 40); c.scale(lerp(1.8, 1, u), lerp(1.8, 1, u)); c.globalAlpha = clamp((t - Tlast - 0.6) / 0.05) * 0.95; sealStamp(c, '桜', 0, 0, 44); c.restore(); }
    }, { p: -1 });
    b.camera((t) => ({ x: camX(t), y: -12 * Math.sin((t - T0) * 0.8) }));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(70, { p: 1.3 });
  },
};
