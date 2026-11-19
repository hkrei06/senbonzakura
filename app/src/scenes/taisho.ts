// The Taisho-romance design kit (docs/TREATMENT.md, Direction v3): the palette, washi paper, gold Art Deco frames, crests,
// the moon, sakura, the skyline and Miku's silhouette, drawn with Canvas2D in logical px. Shared by the graphic worlds
// (poster.ts) and the 3D card worlds (street.ts). Colours are sRGB hex (Canvas2D); THREE.Color(hex) converts them.
import { SCALE, W, H } from '../engine/gl';
import { hash as hashK, mulberry32 } from '../engine/util';

export const PAL = {
  night0: '#1c0f1e', night1: '#2b1530', plum: '#3a1d3c', gold: '#c9a24a', gold2: '#e8c77a', sakura: '#f2b8c6', sakura2: '#f7d6de',
  sakura3: '#d98aa3', ver: '#c8321e', cream: '#efe4cc', ink: '#120a10', teal: '#16403f', warm: '#ffcf7a', brick: '#4a221d', wood: '#2c1812',
};
export const SERIF900 = '"NotoSerifSC-900"';
export const SERIF600 = '"NotoSerifSC-600"';

type C = CanvasRenderingContext2D;

/** An offscreen canvas of w × h logical px at SCALE × resolution (draw in logical px; drawImage it with an explicit size). */
export function layer(w: number, h: number, draw: (c: C, rnd: () => number) => void, seed = 1) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * SCALE); cv.height = Math.round(h * SCALE);
  const c = cv.getContext('2d')!;
  c.scale(SCALE, SCALE);
  draw(c, mulberry32(seed));
  return cv;
}

/** Washi: the base colour, mottled, with paper fibres. */
export function washi(c: C, w: number, h: number, rnd: () => number, base: string, fibre = 'rgba(255,248,230,0.05)', mottle = 0.05) {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 9000; i++) {
    const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 140;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rnd() < 0.5 ? `rgba(0,0,0,${mottle})` : `rgba(255,240,220,${mottle * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  c.strokeStyle = fibre; c.lineWidth = 0.8;
  for (let i = 0; i < (w * h) / 900; i++) {
    const x = rnd() * w, y = rnd() * h, a = rnd() * Math.PI * 2, l = 6 + rnd() * 26;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
}

/** The gold Art Deco frame: a double rule with stepped corners and a fan at each corner. */
export function decoFrame(c: C, w: number, h: number, m = 34, col = PAL.gold) {
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineJoin = 'miter';
  const rule = (k: number, lw: number) => {
    const s = 22 + k; // the corner step
    c.lineWidth = lw; c.beginPath();
    c.moveTo(m + k + s, m + k); c.lineTo(w - m - k - s, m + k); c.lineTo(w - m - k - s, m + k + s * 0.0); c.lineTo(w - m - k, m + k + s);
    c.lineTo(w - m - k, h - m - k - s); c.lineTo(w - m - k - s, h - m - k); c.lineTo(m + k + s, h - m - k); c.lineTo(m + k, h - m - k - s);
    c.lineTo(m + k, m + k + s); c.closePath(); c.stroke();
  };
  rule(0, 2.2); rule(9, 1);
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]] as const) {
    c.save(); c.translate(x + sx * 4, y + sy * 4); c.scale(sx, sy);
    for (let i = 0; i < 5; i++) { // the fan: rays from the corner
      const a = (i / 4) * (Math.PI / 2);
      c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 26, Math.sin(a) * 26); c.stroke();
    }
    c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, 26, 0, Math.PI / 2); c.stroke();
    c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  c.restore();
}

/** One sakura flower: five notched petals (r = radius). */
export function sakuraFlower(c: C, x: number, y: number, r: number, rot: number, fill: string, centre?: string) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = fill;
  for (let i = 0; i < 5; i++) {
    c.save(); c.rotate((i / 5) * Math.PI * 2);
    c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(-r * 0.55, -r * 0.35, -r * 0.5, -r * 0.95, -r * 0.12, -r * 1.0);
    c.lineTo(0, -r * 0.84); c.lineTo(r * 0.12, -r * 1.0);
    c.bezierCurveTo(r * 0.5, -r * 0.95, r * 0.55, -r * 0.35, 0, 0); c.fill();
    c.restore();
  }
  if (centre) { c.fillStyle = centre; c.beginPath(); c.arc(0, 0, r * 0.16, 0, Math.PI * 2); c.fill(); }
  c.restore();
}

/** A sakura crest (kamon): the flower in a ring. */
export function crest(c: C, x: number, y: number, r: number, col: string, ring = true) {
  if (ring) { c.save(); c.strokeStyle = col; c.lineWidth = r * 0.09; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); c.restore(); }
  sakuraFlower(c, x, y, r * 0.78, 0, col);
}

/** A flat blossom cloud: overlapping clusters of small flowers in three pinks, darker underneath. */
export function blossomCloud(c: C, x: number, y: number, rx: number, ry: number, rnd: () => number, n = 260, cols = [PAL.sakura3, PAL.sakura, PAL.sakura2]) {
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < n / 3; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
      const fx = x + Math.cos(a) * rx * d, fy = y + Math.sin(a) * ry * d * 0.9 - k * ry * 0.12;
      if (k === 0 && fy < y) continue; // the shaded pink only underneath
      sakuraFlower(c, fx, fy, 5 + rnd() * 9, rnd() * 6, cols[k]!);
    }
  }
}

/** The moon: a cream-gold disc with soft maria and Art Deco rings around it. */
export function moonDisc(c: C, x: number, y: number, r: number, rnd: () => number, rings = true) {
  const halo = c.createRadialGradient(x, y, r * 0.9, x, y, r * 2.6);
  halo.addColorStop(0, 'rgba(255,226,170,0.28)'); halo.addColorStop(1, 'rgba(255,226,170,0)');
  c.fillStyle = halo; c.beginPath(); c.arc(x, y, r * 2.6, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff6dc'); g.addColorStop(1, '#efd59a');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  for (let i = 0; i < 9; i++) {
    const mx = x + (rnd() - 0.5) * r * 1.3, my = y + (rnd() - 0.5) * r * 1.3, mr = r * (0.12 + rnd() * 0.3);
    const mg = c.createRadialGradient(mx, my, 0, mx, my, mr);
    mg.addColorStop(0, 'rgba(190,150,90,0.22)'); mg.addColorStop(1, 'rgba(190,150,90,0)');
    c.fillStyle = mg; c.fillRect(mx - mr, my - mr, 2 * mr, 2 * mr);
  }
  c.restore();
  if (rings) {
    c.save(); c.strokeStyle = PAL.gold;
    for (const [k, lw, dash] of [[1.18, 1.2, 0], [1.32, 0.8, 6], [1.55, 1.6, 0]] as const) {
      c.lineWidth = lw; c.setLineDash(dash ? [dash, dash * 1.6] : []); c.beginPath(); c.arc(x, y, r * k, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }
}

/** Seigaiha (overlapping waves): rows of concentric arcs. */
export function seigaiha(c: C, x0: number, y0: number, w: number, h: number, s: number, col: string, bg: string) {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  for (let row = 0; row * s * 0.5 < h + s; row++) {
    const y = y0 + row * s * 0.5, off = row % 2 ? s : 0;
    for (let x = x0 - s * 2 + off; x < x0 + w + s * 2; x += s * 2) {
      for (let k = 4; k >= 1; k--) {
        c.fillStyle = k % 2 ? bg : col; c.beginPath(); c.arc(x, y + s, (s * k) / 4, Math.PI, 0); c.fill();
      }
    }
  }
  c.restore();
}

/** A row of Taisho buildings as one silhouette along baseY: brick blocks with domes, a clock tower, the twelve-storey
 *  octagonal tower, machiya roofs, a pagoda, telegraph poles; lit windows; a gold rim on the roofline. */
export type TowerInfo = { cx: number; top: number; tw: number; floors: [number, number, number, number][] };
export function skyline(c: C, w: number, baseY: number, rnd: () => number, o: { fill: string; win?: number; rim?: string; scale?: number; tower?: number; line?: string; inkWin?: string; towerUnlit?: boolean }): { tower?: TowerInfo } {
  // one closed outline (no moveTo inside it: a second subpath would leave an unfilled wedge under the roofline); spires
  // and finials go in `extra`
  const s = o.scale ?? 1, path = new Path2D(), extra = new Path2D(), wins: [number, number, number, number][] = [];
  let x = -20;
  path.moveTo(-20, baseY + 400);
  let tower = o.tower;
  const info: { tower?: TowerInfo } = {};
  while (x < w + 40) {
    const k = rnd(), bw = (60 + rnd() * 120) * s;
    let top = baseY - (40 + rnd() * 110) * s;
    if (tower !== undefined && x + bw > tower) { // the twelve-storey tower: an octagonal shaft with a spire
      const tw = 46 * s, th = 330 * s, cx = x + bw * 0.5; top = baseY - th;
      path.lineTo(x, baseY - 60 * s); path.lineTo(cx - tw / 2, baseY - 60 * s);
      path.lineTo(cx - tw / 2, top + 34 * s); path.lineTo(cx - tw * 0.3, top + 14 * s); path.lineTo(cx, top);
      path.lineTo(cx + tw * 0.3, top + 14 * s); path.lineTo(cx + tw / 2, top + 34 * s);
      path.lineTo(cx + tw / 2, baseY - 60 * s); path.lineTo(x + bw, baseY - 60 * s);
      extra.rect(cx - 1.5 * s, top - 34 * s, 3 * s, 36 * s);
      const floors: [number, number, number, number][] = [];
      for (let f = 0; f < 11; f++) floors.push([cx - tw * 0.3, top + 44 * s + f * 25 * s, tw * 0.6, 9 * s]);
      if (!o.towerUnlit) wins.push(...floors);
      info.tower = { cx, top, tw, floors };
      tower = undefined;
    } else if (k < 0.22) { // a brick block with a dome
      const dw = bw * 0.36;
      path.lineTo(x, top); path.lineTo(x + bw / 2 - dw / 2, top);
      path.quadraticCurveTo(x + bw / 2, top - dw * 1.3, x + bw / 2 + dw / 2, top); path.lineTo(x + bw, top);
      extra.rect(x + bw / 2 - 1.5 * s, top - dw * 0.95, 3 * s, dw * 0.35);
    } else if (k < 0.34) { // a clock tower
      const tw = bw * 0.3, th = (90 + rnd() * 60) * s;
      path.lineTo(x, top); path.lineTo(x + bw / 2 - tw / 2, top); path.lineTo(x + bw / 2 - tw / 2, top - th);
      path.lineTo(x + bw / 2, top - th - tw * 0.9); path.lineTo(x + bw / 2 + tw / 2, top - th); path.lineTo(x + bw / 2 + tw / 2, top); path.lineTo(x + bw, top);
      wins.push([x + bw / 2 - tw * 0.3, top - th + tw * 0.25, tw * 0.6, tw * 0.6]);
    } else if (k < 0.62) { // machiya / tiled roofs
      const rh = bw * 0.28;
      path.lineTo(x - 6 * s, top + rh); path.lineTo(x + bw * 0.2, top); path.lineTo(x + bw * 0.8, top); path.lineTo(x + bw + 6 * s, top + rh);
      top += rh;
    } else if (k < 0.7) { // a five-storey pagoda: up the left side eave by eave, the spire, down the right side
      const pw = bw * 0.8, cx = x + bw / 2, left: [number, number][] = [];
      let y = baseY - 10 * s;
      left.push([cx - pw * 0.32, baseY]);
      for (let f = 0; f < 5; f++) {
        const fw = pw * (1 - f * 0.13), wall = fw * 0.55;
        left.push([cx - wall / 2, y], [cx - fw / 2 - 8 * s, y], [cx - fw / 2 + 4 * s, y - 16 * s], [cx - wall * 0.42, y - 16 * s]);
        y -= 32 * s;
      }
      top = baseY - 20 * s;
      path.lineTo(x, top);
      for (const [px, py] of left) path.lineTo(px, py);
      path.lineTo(cx, y - 30 * s);
      for (const [px, py] of [...left].reverse()) path.lineTo(2 * cx - px, py);
      path.lineTo(x + bw, top);
      extra.rect(cx - 1.2 * s, y - 60 * s, 2.4 * s, 34 * s);
    } else { // a flat block, its parapet stepped
      path.lineTo(x, top); path.lineTo(x + bw * 0.4, top); path.lineTo(x + bw * 0.4, top - 12 * s); path.lineTo(x + bw * 0.6, top - 12 * s);
      path.lineTo(x + bw * 0.6, top); path.lineTo(x + bw, top);
    }
    if (o.win) for (let yy = top + 16 * s; yy < baseY - 10 * s; yy += 22 * s) for (let xx = x + 8 * s; xx < x + bw - 10 * s; xx += 16 * s) if (rnd() < o.win) wins.push([xx, yy, 6 * s, 9 * s]);
    x += bw;
  }
  path.lineTo(w + 40, baseY + 400); path.closePath();
  c.fillStyle = o.fill; c.fill(path); c.fill(extra);
  if (o.rim) { c.save(); c.strokeStyle = o.rim; c.lineWidth = 1.3; c.stroke(path); c.restore(); }
  if (o.line) { c.save(); c.strokeStyle = o.line; c.fillStyle = o.line; c.lineWidth = 1.6; c.stroke(path); c.fill(extra); c.restore(); }
  if (o.inkWin) { c.strokeStyle = o.inkWin; c.lineWidth = 1.1; for (const [wx, wy, ww, wh] of wins) c.strokeRect(wx, wy, ww, wh); return info; }
  c.fillStyle = PAL.warm;
  for (const [wx, wy, ww, wh] of wins) { c.globalAlpha = 0.55 + 0.45 * rnd(); c.fillRect(wx, wy, ww, wh); }
  c.globalAlpha = 1;
  if (o.towerUnlit && info.tower) { c.fillStyle = '#1a0d14'; for (const [wx, wy, ww, wh] of info.tower.floors) c.fillRect(wx, wy, ww, wh); }
  return info;
}

type Pt = [number, number];

/** A closed path through q, smoothed with quadratic curves through the midpoints. */
function smooth(q: Pt[]) {
  const p = new Path2D(), n = q.length, mid = (i: number): Pt => [(q[i % n]![0] + q[(i + 1) % n]![0]) / 2, (q[i % n]![1] + q[(i + 1) % n]![1]) / 2];
  p.moveTo(...mid(0));
  for (let i = 1; i <= n; i++) p.quadraticCurveTo(q[i % n]![0], q[i % n]![1], ...mid(i));
  p.closePath();
  return p;
}

/** A tapering ribbon along a centreline (figure units, mapped by P), width w0 at the root → w1 at the tip. */
function ribbon(P: (x: number, y: number) => Pt, pts: Pt[], w0: number, w1: number) {
  const n = pts.length, L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(n - 1, i + 1)]!;
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = (w0 + ((w1 - w0) * i) / (n - 1)) / 2;
    L.push(P(pts[i]![0] - dy * w, pts[i]![1] + dx * w)); R.push(P(pts[i]![0] + dy * w, pts[i]![1] - dx * w));
  }
  return smooth([...L, ...R.reverse()]);
}

let scratch: HTMLCanvasElement | null = null;
/** Draw a figure's parts into a scratch canvas, then onto c with a glow around the outline of their union only (no
 *  lines where the parts overlap). The box (x0, y0, w, h) and blur are in c's units. */
export function withGlow(c: C, x0: number, y0: number, w: number, h: number, draw: (s: C) => void, glow: string, blur: number) {
  const m = c.getTransform(), k = Math.hypot(m.a, m.b), W2 = Math.ceil(w * k), H2 = Math.ceil(h * k); // the scale, even mirrored or turned
  if (!scratch || scratch.width < W2 || scratch.height < H2) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(W2, scratch?.width ?? 0); cv.height = Math.max(H2, scratch?.height ?? 0); scratch = cv;
  }
  const s = scratch.getContext('2d')!;
  s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, scratch.width, scratch.height);
  s.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  draw(s);
  c.save();
  if (glow) { c.shadowColor = glow; c.shadowBlur = blur * k; c.drawImage(scratch, 0, 0, W2, H2, x0, y0, w, h); c.shadowBlur = blur * k * 0.3; }
  c.drawImage(scratch, 0, 0, W2, H2, x0, y0, w, h);
  c.restore();
}

/** Miku's silhouette standing side-on (facing left), saluting at her cap's visor: the officer's cap, a side lock, the
 *  capelet, the coat with its flared skirt, a saber at her hip, tall boots; the twin tails streaming back in the wind
 *  (0..1; phase = the flutter). Feet at (x, y), height h. Ink, the hair teal-black, a glow around the outline. */
export function mikuStanding(c: C, x: number, y: number, h: number, wind: number, phase: number, glow: string = PAL.gold) {
  const u = h / 100, P = (px: number, py: number): Pt => [x + px * u, y - py * u];
  const fl = (k: number, a = 1) => Math.sin(phase + k) * a * wind;
  withGlow(c, x - 32 * u, y - 106 * u, 116 * u, 112 * u, (s) => {
    s.fillStyle = PAL.teal;
    for (const [dy, len, wd, ph] of [[0, 82, 6.8, 0], [-2.6, 74, 5.6, 1.1]] as const) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push([3.6 + t * len * (0.25 + 0.7 * wind) + fl(ph + t * 4, 2.2 * t), 91 + dy - t * len * (0.96 - 0.72 * wind) + Math.sin(phase * 1.3 + ph + t * 5) * 3 * wind * t]);
      }
      s.fill(ribbon(P, pts, wd, 1.1));
    }
    s.fillStyle = PAL.ink; s.strokeStyle = PAL.ink; s.lineCap = 'round'; s.lineJoin = 'round';
    s.lineWidth = 1.5 * u; s.beginPath(); s.moveTo(...P(-1, 57)); s.quadraticCurveTo(...P(9, 50), ...P(19.5, 41)); s.stroke(); // the saber
    for (const dx of [3.3, 0]) { // the legs in tall boots
      const q = (px: number, py: number) => P(px + dx, py), L = new Path2D();
      L.moveTo(...q(-5.2, 46)); L.bezierCurveTo(...q(-5.7, 38), ...q(-5.3, 32), ...q(-4.9, 27));
      L.bezierCurveTo(...q(-4.6, 18), ...q(-4.4, 10), ...q(-4.3, 5)); L.bezierCurveTo(...q(-6.5, 3.7), ...q(-10, 2.7), ...q(-10.7, 1.3));
      L.quadraticCurveTo(...q(-10.8, 0), ...q(-9, 0)); L.lineTo(...q(-0.6, 0)); L.lineTo(...q(-0.4, 3.2));
      L.bezierCurveTo(...q(-0.3, 10), ...q(0.5, 18), ...q(-0.6, 27)); L.bezierCurveTo(...q(-0.2, 33), ...q(1.2, 40), ...q(1.3, 46)); L.closePath();
      s.fill(L);
    }
    const sk = new Path2D(); // the coat's flared skirt, the hem waving
    sk.moveTo(...P(-5.6, 59)); sk.bezierCurveTo(...P(-8, 52), ...P(-10.5, 46), ...P(-12, 40.5));
    sk.quadraticCurveTo(...P(-7, 38.5 + fl(0.3, 1.2)), ...P(-1.5, 40)); sk.quadraticCurveTo(...P(4, 38 + fl(1.2, 1.5)), ...P(9.5, 39.5));
    sk.quadraticCurveTo(...P(12 + 3 * wind, 38.5 + fl(2, 2)), ...P(13.5 + 4 * wind, 37.5 + fl(2.4, 2)));
    sk.bezierCurveTo(...P(10, 46), ...P(7, 53), ...P(5.6, 59)); sk.closePath(); s.fill(sk);
    const to = new Path2D(); // the torso
    to.moveTo(...P(-5.4, 59)); to.bezierCurveTo(...P(-7.2, 65), ...P(-6.8, 71), ...P(-5.6, 76.5));
    to.lineTo(...P(-2.6, 79.5)); to.lineTo(...P(2.2, 79.5)); to.lineTo(...P(5.6, 77)); to.bezierCurveTo(...P(6.2, 70), ...P(5.6, 64), ...P(5.4, 59)); to.closePath(); s.fill(to);
    const cp = new Path2D(); // the capelet, flaring back
    cp.moveTo(...P(-6.2, 77.5)); cp.bezierCurveTo(...P(-3, 80.5), ...P(3, 80.5), ...P(6.5, 78));
    cp.bezierCurveTo(...P(11 + 6 * wind, 74 + fl(0.8, 1)), ...P(15 + 9 * wind, 67 + fl(1.4, 2)), ...P(17 + 11 * wind, 61 + fl(1.9, 2.5)));
    cp.quadraticCurveTo(...P(8, 62 + fl(1.1, 1)), ...P(1, 64)); cp.quadraticCurveTo(...P(-4.5, 66), ...P(-7.2, 69)); cp.closePath(); s.fill(cp);
    s.fillRect(...P(-2.3, 84), 4 * u, 6 * u); // the neck
    const hd = new Path2D(); hd.ellipse(...P(-0.4, 87.8), 5.5 * u, 6.3 * u, -0.08, 0, Math.PI * 2); s.fill(hd);
    const chin = new Path2D(); chin.moveTo(...P(-5.4, 85.5)); chin.quadraticCurveTo(...P(-5.6, 82.4), ...P(-2.6, 82)); chin.lineTo(...P(-1, 84)); chin.closePath(); s.fill(chin);
    const cr = new Path2D(); // the cap: its crown, the band, the visor
    cr.moveTo(...P(-6.4, 93.4)); cr.bezierCurveTo(...P(-10.2, 95.2), ...P(-10, 99.6), ...P(-5.4, 100.6));
    cr.lineTo(...P(3.6, 100.9)); cr.bezierCurveTo(...P(8, 100.5), ...P(7.6, 95.6), ...P(5.6, 93.4)); cr.closePath(); s.fill(cr);
    s.fillRect(...P(-6.6, 94.2), 12.3 * u, 2.8 * u);
    const vz = new Path2D(); vz.moveTo(...P(-5.8, 92.6)); vz.quadraticCurveTo(...P(-10.5, 92.8), ...P(-12.4, 90.9)); vz.quadraticCurveTo(...P(-9, 90.8), ...P(-5.8, 91.4)); vz.closePath(); s.fill(vz);
    s.lineWidth = 3.3 * u; s.beginPath(); s.moveTo(...P(-1.5, 75.5)); s.quadraticCurveTo(...P(-10, 78), ...P(-11, 83.5)); s.stroke(); // the saluting arm
    s.lineWidth = 2.8 * u; s.beginPath(); s.moveTo(...P(-11, 83.5)); s.quadraticCurveTo(...P(-11.2, 88.5), ...P(-8.8, 91.8)); s.stroke();
    s.beginPath(); s.ellipse(...P(-8.4, 92.3), 1.9 * u, 1.3 * u, -0.6, 0, Math.PI * 2); s.fill();
    s.lineWidth = 3 * u; s.beginPath(); s.moveTo(...P(2.5, 75.5)); s.quadraticCurveTo(...P(5.2, 66), ...P(3.4, 58)); s.stroke(); // the other hand on the saber
    s.fillStyle = PAL.teal; s.fill(ribbon(P, [[-3.6, 89.5], [-4.8, 83], [-5.6 + fl(0.5, 0.8), 77], [-6.4 + fl(0.9, 1.2), 71.5]], 2.3, 0.8)); // the side lock
  }, glow, 5 * u);
}

/** Miku from behind, running (phase: one stride = 2π; speed 0..1 lengthens it, the tails and capelet stream out). Feet
 *  at (x, y). From behind her twin tails hang over her back: they are drawn last. */
export function mikuRunning(c: C, x: number, y: number, h: number, phase: number, speed: number, glow: string = PAL.gold) {
  const u = h / 100, sw = Math.sin(phase), bob = Math.abs(Math.cos(phase)) * 2.2 * (0.4 + speed);
  const P = (px: number, py: number): Pt => [x + px * u, y - (py + bob) * u];
  c.save(); c.fillStyle = 'rgba(10,4,8,0.38)'; c.beginPath(); c.ellipse(x, y + 1.2 * u, 13 * u, 2.4 * u, 0, 0, Math.PI * 2); c.fill(); c.restore();
  withGlow(c, x - 46 * u, y - 108 * u, 92 * u, 112 * u, (s) => {
    s.fillStyle = PAL.ink; s.strokeStyle = PAL.ink; s.lineCap = 'round'; s.lineJoin = 'round';
    for (const side of [-1, 1]) { // the legs: the foot coming forward lifts (from behind, the boot rises and shortens)
      const lift = Math.max(0, Math.sin(phase + (side < 0 ? 0 : Math.PI))) * (7 + 12 * speed);
      const hip = P(side * 3.8, 44), knee = P(side * 4.4, 25 + lift * 0.55 - bob * 0.5), ank = P(side * 4.0, 4 + lift - bob);
      s.lineWidth = 5.6 * u; s.beginPath(); s.moveTo(...hip); s.lineTo(...knee); s.stroke();
      s.lineWidth = 4.6 * u; s.beginPath(); s.moveTo(...knee); s.lineTo(...ank); s.stroke();
      s.beginPath(); s.ellipse(ank[0], ank[1] + 1.2 * u, 2.8 * u, 1.7 * u, 0, 0, Math.PI * 2); s.fill();
    }
    const tilt = sw * 2.2, sk = new Path2D(); // the skirt, swinging with the stride
    sk.moveTo(...P(-5.6, 59)); sk.bezierCurveTo(...P(-8, 52), ...P(-11 - 3 * speed, 46), ...P(-12.5 - 4 * speed, 40 - tilt));
    sk.quadraticCurveTo(...P(-6, 38.5), ...P(0, 40)); sk.quadraticCurveTo(...P(6, 38.5), ...P(12.5 + 4 * speed, 40 + tilt));
    sk.bezierCurveTo(...P(11 + 3 * speed, 46), ...P(8, 52), ...P(5.6, 59)); sk.closePath(); s.fill(sk);
    for (const side of [-1, 1]) { // the arms swinging
      const a = side * sw * (5 + 6 * speed);
      s.lineWidth = 3 * u; s.beginPath(); s.moveTo(...P(side * 7.2, 75)); s.quadraticCurveTo(...P(side * 11, 66 + a * 0.3), ...P(side * 10, 57 + a)); s.stroke();
    }
    const to = new Path2D(); to.moveTo(...P(-5.6, 59)); to.bezierCurveTo(...P(-6.5, 66), ...P(-7, 72), ...P(-6.4, 78)); to.lineTo(...P(6.4, 78)); to.bezierCurveTo(...P(7, 72), ...P(6.5, 66), ...P(5.6, 59)); to.closePath(); s.fill(to);
    const f = 3 * speed, cp = new Path2D(); // the capelet billowing out
    cp.moveTo(...P(-7, 79)); cp.bezierCurveTo(...P(-3, 81.5), ...P(3, 81.5), ...P(7, 79));
    cp.bezierCurveTo(...P(11 + f, 74), ...P(14 + 2 * f, 66), ...P(15 + 3 * f, 60 + sw * 1.5));
    cp.quadraticCurveTo(...P(0, 62.5), ...P(-15 - 3 * f, 60 - sw * 1.5));
    cp.bezierCurveTo(...P(-14 - 2 * f, 66), ...P(-11 - f, 74), ...P(-7, 79)); cp.closePath(); s.fill(cp);
    s.fillRect(...P(-2.4, 84), 4.8 * u, 4 * u);
    s.beginPath(); s.ellipse(...P(0, 87.2), 5.7 * u, 6.2 * u, 0, 0, Math.PI * 2); s.fill();
    s.fillRect(...P(-6.4, 94), 12.8 * u, 2.8 * u); // the cap from behind: the band, the crown wider than it
    const cr = new Path2D(); cr.moveTo(...P(-6.4, 93.8)); cr.bezierCurveTo(...P(-9.6, 95.5), ...P(-9.4, 99.6), ...P(-4, 100.4)); cr.lineTo(...P(4, 100.4)); cr.bezierCurveTo(...P(9.4, 99.6), ...P(9.6, 95.5), ...P(6.4, 93.8)); cr.closePath(); s.fill(cr);
    s.fillStyle = PAL.teal;
    for (const side of [-1, 1]) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, swy = Math.sin(phase * 0.5 + t * 2.6 + (side > 0 ? 0.7 : 0)) * 4.5 * t;
        pts.push([side * (5.6 + t * (7 + 16 * speed)) + swy, 90 - t * (54 - 26 * speed)]);
      }
      s.fill(ribbon(P, pts, 6.4, 1.6));
    }
  }, glow, 4 * u);
}

/** A sakura tree or branch from (x, y) at angle a (radians, canvas y down: −π/2 = up), first limb len0 long: tapered
 *  limbs forking, blossom clouds at the tips; drawn with a glow around its outline when `glow` is given. */
export function sakuraTree(c: C, x: number, y: number, len0: number, a: number, rnd: () => number,
  o: { ink?: string; glow?: string; spread?: number; bloom?: number; cols?: string[]; depth?: number } = {}) {
  const tips: [number, number, number][] = [], limbs: [number, number, number, number, number, number, number][] = [];
  const br = (bx: number, by: number, an: number, len: number, wd: number, d: number) => {
    const x1 = bx + Math.cos(an) * len, y1 = by + Math.sin(an) * len, bend = (rnd() - 0.5) * 0.7;
    limbs.push([bx, by, bx + Math.cos(an + bend) * len * 0.5, by + Math.sin(an + bend) * len * 0.5, x1, y1, wd]);
    if (d <= 0 || len < 10) { tips.push([x1, y1, len]); return; }
    const n = 2 + (rnd() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) br(x1, y1, an + (i - (n - 1) / 2) * (0.5 + rnd() * 0.35) * (o.spread ?? 1) + (rnd() - 0.5) * 0.3, len * (0.68 + rnd() * 0.14), wd * 0.66, d - 1);
    if (d <= 2) tips.push([x1, y1, len * 0.8]);
  };
  br(x, y, a, len0, len0 * 0.16, o.depth ?? 6);
  const xs = [...limbs.map((l) => l[4]), x], ys = [...limbs.map((l) => l[5]), y];
  const pad = len0 * 0.9, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) + pad - x0, h = Math.max(...ys) + pad - y0;
  withGlow(c, x0, y0, w, h, (s) => {
    s.strokeStyle = o.ink ?? PAL.ink; s.lineCap = 'round';
    for (const [ax, ay, mx, my, bx, by, wd] of limbs) { s.lineWidth = wd; s.beginPath(); s.moveTo(ax, ay); s.quadraticCurveTo(mx, my, bx, by); s.stroke(); }
    for (const [tx, ty, len] of tips) blossomCloud(s, tx, ty, 16 + len * 0.8, 12 + len * 0.55, rnd, Math.round(34 * (o.bloom ?? 1)), o.cols);
  }, o.glow ?? '', 10);
}

/** A red seal stamp with cream characters, set vertically (centre x, top y). */
export function sealStamp(c: C, text: string, x: number, y: number, size: number) {
  const n = [...text].length, w = size * 1.25, h = size * (n * 1.05 + 0.35);
  c.save(); c.fillStyle = PAL.ver; c.fillRect(x - w / 2, y, w, h);
  c.strokeStyle = PAL.cream; c.lineWidth = size * 0.05; c.strokeRect(x - w / 2 + size * 0.1, y + size * 0.1, w - size * 0.2, h - size * 0.2);
  c.fillStyle = PAL.cream; c.font = `${size * 0.82}px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  [...text].forEach((ch, j) => c.fillText(ch, x, y + size * (0.7 + j * 1.05)));
  c.restore();
}

export type Kind = 'brick' | 'machiya' | 'kura' | 'cafe';

/** A shop front w × h m as a canvas (k px per metre), transparent above its roofline: brick, machiya, storehouse, café. */
export function facade(kind: Kind, w: number, h: number, seed: number, k = 96) {
  const W0 = w * k, H0 = h * k;
  return layer(W0, H0, (c, r) => {
    const m = (v: number) => v * k, Y = (v: number) => H0 - v * k; // metres → px (v up from the ground)
    // a window: x, y its bottom left (m); lit warm or dark; arched or square; a cream frame with a gold line
    const win = (x: number, y: number, ww: number, hh: number, lit: boolean, arch: boolean, frame = '#b8a888') => {
      const px = m(x), py = Y(y + hh), pw = m(ww), ph = m(hh);
      const outline = () => {
        c.beginPath();
        if (arch) { c.moveTo(px, py + pw / 2); c.arc(px + pw / 2, py + pw / 2, pw / 2, Math.PI, 0); c.lineTo(px + pw, py + ph); c.lineTo(px, py + ph); c.closePath(); }
        else c.rect(px, py, pw, ph);
      };
      outline();
      if (lit) { const g = c.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#ffe2a6'); g.addColorStop(1, '#e98d3c'); c.fillStyle = g; } else c.fillStyle = '#150c18';
      c.fill();
      c.save(); outline(); c.clip();
      if (lit && r() < 0.55) { c.fillStyle = 'rgba(130,30,40,0.6)'; c.fillRect(px, py, pw * 0.24, ph); c.fillRect(px + pw * 0.76, py, pw * 0.24, ph); }
      c.strokeStyle = lit ? 'rgba(70,30,12,0.85)' : 'rgba(90,70,90,0.5)'; c.lineWidth = m(0.045);
      c.beginPath(); c.moveTo(px + pw / 2, py); c.lineTo(px + pw / 2, py + ph); c.moveTo(px, py + ph * 0.56); c.lineTo(px + pw, py + ph * 0.56); c.stroke();
      c.restore();
      outline(); c.strokeStyle = frame; c.lineWidth = m(0.07); c.stroke();
      c.strokeStyle = PAL.gold; c.lineWidth = 1.2; c.stroke();
    };
    const band = (y: number, hh: number, col = '#b3a385') => { c.fillStyle = col; c.fillRect(0, Y(y + hh), W0, m(hh)); c.fillStyle = PAL.gold; c.fillRect(0, Y(y) - 1.4, W0, 1.4); c.fillRect(0, Y(y + hh), W0, 1.2); };
    const noren = (x: number, ww: number, col: string) => { // the shop curtain: three panels and a crest
      for (let i = 0; i < 3; i++) { c.fillStyle = col; c.fillRect(m(x + (i * ww) / 3 + 0.02), Y(2.35), m(ww / 3 - 0.04), m(0.95)); }
      crest(c, m(x + ww / 2), Y(1.85), m(0.2), PAL.cream);
    };
    if (kind === 'brick') {
      const top = h - 0.9;
      c.fillStyle = '#3d1c18'; c.fillRect(0, Y(top), W0, m(top));
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0, row = 0; y < top; y += 0.075, row++) {
        c.fillRect(0, Y(y), W0, 1);
        for (let x = (row % 2) * 0.11; x < w; x += 0.22) c.fillRect(m(x), Y(y + 0.075), 1, m(0.075));
      }
      for (let i = 0; i < 700; i++) { c.fillStyle = r() < 0.5 ? 'rgba(140,60,45,0.2)' : 'rgba(15,4,4,0.22)'; c.fillRect(m(Math.floor(r() * w / 0.22) * 0.22), Y(Math.floor(r() * top / 0.075) * 0.075 + 0.075), m(0.22), m(0.075)); }
      band(3.15, 0.24); band(6.25, 0.18); band(top - 0.45, 0.45);
      // the ground floor: a lit display either side of the door
      win(0.35, 0.45, w / 2 - 0.95, 2.3, true, false, '#2a1510'); win(w / 2 + 0.6, 0.45, w / 2 - 0.95, 2.3, true, false, '#2a1510');
      c.fillStyle = '#1a0d0c'; c.fillRect(m(w / 2 - 0.5), Y(2.7), m(1.0), m(2.7)); c.strokeStyle = PAL.gold; c.lineWidth = 1.2; c.strokeRect(m(w / 2 - 0.5), Y(2.7), m(1.0), m(2.7));
      const n = Math.max(2, Math.floor(w / 1.7)), sp = w / n;
      for (let i = 0; i < n; i++) {
        win(i * sp + sp * 0.26, 3.85, sp * 0.48, 1.75, r() < 0.62, true);
        if (top > 8.0) win(i * sp + sp * 0.3, 6.85, sp * 0.4, 1.2, r() < 0.5, false);
      }
      // the parapet: a pediment with a crest, or a dome with gold ribs and a flagpole
      if (r() < 0.5) {
        c.fillStyle = '#b3a385'; c.beginPath(); c.moveTo(m(w * 0.3), Y(top)); c.lineTo(m(w * 0.5), Y(h)); c.lineTo(m(w * 0.7), Y(top)); c.closePath(); c.fill();
        c.strokeStyle = PAL.gold; c.lineWidth = 1.4; c.stroke(); crest(c, m(w * 0.5), Y(top + 0.35), m(0.2), PAL.ver);
      } else {
        c.fillStyle = '#262532'; c.beginPath(); c.moveTo(m(w * 0.34), Y(top)); c.quadraticCurveTo(m(w * 0.5), Y(h + 0.2), m(w * 0.66), Y(top)); c.closePath(); c.fill();
        c.strokeStyle = PAL.gold; c.lineWidth = 1.2; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(m(w * (0.34 + 0.32 * i / 5)), Y(top)); c.quadraticCurveTo(m(w * 0.5), Y(h - 0.1), m(w * 0.5), Y(h - 0.05)); c.stroke(); }
      }
    } else if (kind === 'machiya') {
      const g1 = 2.8, e1 = 3.25, up = 5.4;
      c.fillStyle = '#21120d'; c.fillRect(0, Y(g1), W0, m(g1));
      // the lattice over a warm room, the door with its noren
      const lx0 = 0.25, lx1 = w - 1.6;
      const wg = c.createLinearGradient(0, Y(g1), 0, Y(0)); wg.addColorStop(0, '#ffcf88'); wg.addColorStop(1, '#d9762e');
      c.fillStyle = wg; c.fillRect(m(lx0), Y(2.45), m(lx1 - lx0), m(2.1));
      c.fillStyle = '#2a170f'; for (let x = lx0; x < lx1; x += 0.07) c.fillRect(m(x), Y(2.45), m(0.04), m(2.1));
      c.fillRect(m(lx0), Y(1.5), m(lx1 - lx0), m(0.05));
      c.fillStyle = '#ffd796'; c.fillRect(m(w - 1.35), Y(2.4), m(1.1), m(2.4));
      noren(w - 1.4, 1.2, r() < 0.5 ? PAL.ver : '#253556');
      // the eave: tiles with a scalloped edge
      c.fillStyle = '#1d1923'; c.fillRect(0, Y(e1), W0, m(e1 - g1));
      c.fillStyle = '#1d1923'; for (let x = 0; x < w; x += 0.16) { c.beginPath(); c.arc(m(x + 0.08), Y(g1), m(0.08), 0, Math.PI); c.fill(); }
      c.strokeStyle = 'rgba(201,162,74,0.35)'; c.lineWidth = 1; for (let x = 0; x < w; x += 0.16) { c.beginPath(); c.moveTo(m(x), Y(e1)); c.lineTo(m(x), Y(g1)); c.stroke(); }
      // the upper floor: plaster with slatted windows (mushiko)
      c.fillStyle = '#8b7f6b'; c.fillRect(0, Y(up), W0, m(up - e1));
      const nw = Math.max(1, Math.floor(w / 2.6));
      for (let i = 0; i < nw; i++) {
        const x = (w / nw) * (i + 0.5) - 0.7;
        c.fillStyle = r() < 0.6 ? '#f2b56a' : '#1a1016'; c.fillRect(m(x), Y(4.85), m(1.4), m(1.0));
        c.fillStyle = '#e6dcc6'; for (let s = 0; s < 1.4; s += 0.14) c.fillRect(m(x + s), Y(4.85), m(0.08), m(1.0));
      }
      // the roof: tiles falling toward us, the ridge, the end tiles
      c.fillStyle = '#1b1720'; c.beginPath(); c.moveTo(-2, Y(up)); c.lineTo(W0 + 2, Y(up)); c.lineTo(W0 + 2, Y(h - 0.25)); c.lineTo(-2, Y(h - 0.25)); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(201,162,74,0.25)'; for (let x = 0; x < w; x += 0.18) { c.beginPath(); c.moveTo(m(x), Y(h - 0.25)); c.lineTo(m(x), Y(up)); c.stroke(); }
      c.fillStyle = '#0f0c12'; c.fillRect(0, Y(h), W0, m(0.25));
      for (const x of [0.1, w - 0.5]) { c.beginPath(); c.moveTo(m(x), Y(h)); c.lineTo(m(x + 0.2), Y(h + 0.0) - m(0.35)); c.lineTo(m(x + 0.4), Y(h)); c.fill(); }
      c.strokeStyle = PAL.gold; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, Y(h)); c.lineTo(W0, Y(h)); c.stroke();
    } else if (kind === 'kura') {
      const base = 1.7;
      c.fillStyle = '#16141a'; c.fillRect(0, Y(base), W0, m(base));
      c.save(); c.beginPath(); c.rect(0, Y(base), W0, m(base)); c.clip();
      c.strokeStyle = '#cfc2a6'; c.lineWidth = m(0.045);
      for (let x = -base; x < w + base; x += 0.3) { c.beginPath(); c.moveTo(m(x), Y(0)); c.lineTo(m(x + base), Y(base)); c.stroke(); c.beginPath(); c.moveTo(m(x + base), Y(0)); c.lineTo(m(x), Y(base)); c.stroke(); }
      c.restore();
      c.fillStyle = '#a69a83'; c.fillRect(0, Y(h - 1.0), W0, m(h - 1.0 - base));
      c.fillStyle = '#f0b366'; c.fillRect(m(w / 2 - 0.55), Y(4.7), m(1.1), m(0.85));
      c.fillStyle = '#0e0c10'; c.fillRect(m(w / 2 - 1.15), Y(4.75), m(0.55), m(0.95)); c.fillRect(m(w / 2 + 0.6), Y(4.75), m(0.55), m(0.95));
      crest(c, m(w / 2), Y(h - 1.65), m(0.45), PAL.ink);
      c.fillStyle = '#0f0c12'; c.beginPath(); c.moveTo(-m(0.1), Y(h - 1.0)); c.lineTo(W0 + m(0.1), Y(h - 1.0)); c.lineTo(W0 - m(0.2), Y(h - 0.3)); c.lineTo(m(0.2), Y(h - 0.3)); c.closePath(); c.fill();
      c.fillRect(m(0.35), Y(h), W0 - m(0.7), m(0.3));
      c.strokeStyle = PAL.gold; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, Y(h - 1.0)); c.lineTo(W0, Y(h - 1.0)); c.stroke();
    } else {
      c.fillStyle = '#2f3a37'; c.fillRect(0, Y(h - 0.6), W0, m(h - 0.6));
      c.fillStyle = 'rgba(255,255,255,0.06)'; for (let y = 0; y < h - 0.6; y += 0.18) c.fillRect(0, Y(y + 0.18), W0, 1.2);
      win(0.4, 0.5, w - 2.0, 2.0, true, true, '#d8cfb6');
      c.fillStyle = '#1a1210'; c.fillRect(m(w - 1.3), Y(2.6), m(0.95), m(2.6));
      c.fillStyle = '#ffd796'; c.fillRect(m(w - 1.2), Y(2.4), m(0.75), m(1.4));
      // the striped awning with a scalloped edge
      const a0 = 2.75, a1 = 3.35;
      for (let x = 0, i = 0; x < w; x += 0.3, i++) {
        c.fillStyle = i % 2 ? PAL.cream : PAL.ver;
        c.beginPath(); c.moveTo(m(x), Y(a1)); c.lineTo(m(x + 0.3), Y(a1)); c.lineTo(m(x + 0.3), Y(a0)); c.arc(m(x + 0.15), Y(a0), m(0.15), 0, Math.PI); c.closePath(); c.fill();
      }
      const n = Math.max(2, Math.floor(w / 2)); for (let i = 0; i < n; i++) win((w / n) * (i + 0.5) - 0.45, 4.1, 0.9, 1.5, r() < 0.7, false, '#d8cfb6');
      band(h - 0.6, 0.6, '#c4b694');
      c.fillStyle = PAL.gold; for (let x = 0.1; x < w; x += 0.25) c.fillRect(m(x), Y(h - 0.55), m(0.1), m(0.1));
    }
    // night: darker toward the top, warmer near the ground (only where the facade is)
    c.globalCompositeOperation = 'source-atop';
    const ng = c.createLinearGradient(0, 0, 0, H0); ng.addColorStop(0, 'rgba(12,4,20,0.42)'); ng.addColorStop(0.6, 'rgba(12,4,20,0.08)'); ng.addColorStop(1, 'rgba(255,170,80,0.10)');
    c.fillStyle = ng; c.fillRect(0, 0, W0, H0);
    c.globalCompositeOperation = 'source-over';
  }, seed);
}

/** Asanoha (hemp leaf): six-pointed stars on a triangular grid, in lines. */
export function asanoha(c: C, x0: number, y0: number, w: number, h: number, s: number, col: string, lw = 1.2) {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  c.strokeStyle = col; c.lineWidth = lw;
  const hh = s * Math.sqrt(3) / 2;
  for (let row = -1; row * hh < h + hh; row++) {
    for (let col2 = -1; col2 * s < w + s; col2++) {
      const cx = x0 + col2 * s + (row % 2 ? s / 2 : 0), cy = y0 + row * hh;
      // a hexagon's six spokes from its centre to its corners and its edges' midpoints (the hemp-leaf star)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6, r = s / Math.sqrt(3);
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.stroke();
        const a2 = (i / 6) * Math.PI * 2, r2 = s / 2;
        c.beginPath(); c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.lineTo(cx + Math.cos(a2) * r2 * 1.0, cy + Math.sin(a2) * r2 * 1.0); c.stroke();
      }
    }
  }
  c.restore();
}

/** Yagasuri (arrow feathers): in each column a stack of chevrons pointing down, alternating two colours row by row; the
 *  columns offset by half a row, a dark line between them. */
export function yagasuri(c: C, x0: number, y0: number, w: number, h: number, colW: number, a: string, b: string, line = 'rgba(18,10,16,0.55)') {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  const uh = colW * 0.9, d = colW * 0.45;
  for (let i = 0; i * colW < w + colW; i++) {
    const x = x0 + i * colW, off = (i % 2) * (uh / 2);
    for (let j = -2; j * uh < h + uh; j++) {
      const y = y0 + j * uh + off;
      c.fillStyle = j % 2 ? a : b; c.beginPath();
      c.moveTo(x, y); c.lineTo(x + colW / 2, y + d); c.lineTo(x + colW, y); c.lineTo(x + colW, y + uh); c.lineTo(x + colW / 2, y + uh + d); c.lineTo(x, y + uh);
      c.closePath(); c.fill();
    }
    c.strokeStyle = line; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + h); c.stroke();
  }
  c.restore();
}

/** A gear: n teeth around radius r, spokes, a hub; turned by angle a. */
export function gear(c: C, x: number, y: number, r: number, n: number, a: number, fill: string, edge = 'rgba(255,240,200,0.5)') {
  const p = new Path2D(), d = r * 0.12;
  for (let i = 0; i < n; i++) {
    const t0 = a + (i / n) * Math.PI * 2, w = (Math.PI * 2) / n;
    const pts: [number, number][] = [[r - d, t0], [r + d, t0 + w * 0.12], [r + d, t0 + w * 0.42], [r - d, t0 + w * 0.54]];
    for (const [rr, tt] of pts) { if (i === 0 && rr === r - d && tt === t0) p.moveTo(x + Math.cos(tt) * rr, y + Math.sin(tt) * rr); else p.lineTo(x + Math.cos(tt) * rr, y + Math.sin(tt) * rr); }
  }
  p.closePath();
  p.moveTo(x + r * 0.72, y); p.arc(x, y, r * 0.72, 0, Math.PI * 2); // the rim's inner edge: a hole by the even-odd rule
  c.save();
  c.fillStyle = fill; c.fill(p, 'evenodd');
  c.fillStyle = fill; c.strokeStyle = fill; c.lineWidth = r * 0.1;
  for (let i = 0; i < 5; i++) { const t = a + (i / 5) * Math.PI * 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(t) * r * 0.74, y + Math.sin(t) * r * 0.74); c.stroke(); }
  c.beginPath(); c.arc(x, y, r * 0.16, 0, Math.PI * 2); c.fill();
  c.strokeStyle = edge; c.lineWidth = 1.1; c.stroke(p);
  c.restore();
}

/** Miku leaping (side-on, facing right): leaning into the jump, the front knee up, the back leg trailing, one arm
 *  reaching ahead; the cap, the capelet and the twin tails streaming back. The hip at (x, y), h = her standing height. */
export function mikuLeap(c: C, x: number, y: number, h: number, phase: number, glow: string = PAL.gold) {
  const u = h / 100, P = (px: number, py: number): Pt => [x + px * u, y - (py - 50) * u];
  const fl = (k: number, a = 1) => Math.sin(phase + k) * a;
  withGlow(c, x - 95 * u, y - 60 * u, 150 * u, 110 * u, (s) => {
    s.fillStyle = PAL.teal; // the tails, far behind her
    for (const [dy, len, wd, ph] of [[0, 86, 6.6, 0], [-3, 78, 5.4, 1.2]] as const) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([10 - t * len, 88 + dy - t * 14 + fl(ph + t * 5, 3.5 * t)]); }
      s.fill(ribbon(P, pts, wd, 1.2));
    }
    s.strokeStyle = PAL.ink; s.fillStyle = PAL.ink; s.lineCap = 'round'; s.lineJoin = 'round';
    s.lineWidth = 1.5 * u; s.beginPath(); s.moveTo(...P(2, 54)); s.quadraticCurveTo(...P(-8, 50), ...P(-20, 44)); s.stroke(); // the saber trailing
    const limb = (pts: Pt[], w: number) => { s.lineWidth = w * u; s.beginPath(); s.moveTo(...P(...pts[0]!)); for (const q of pts.slice(1)) s.lineTo(...P(...q)); s.stroke(); };
    limb([[0, 50], [-12, 40], [-27, 45]], 5.2); // the back leg, trailing
    s.beginPath(); s.ellipse(...P(-28.5, 46), 3.4 * u, 1.8 * u, -0.5, 0, Math.PI * 2); s.fill();
    limb([[0, 50], [15, 49], [21, 33]], 5.6); // the front leg, the knee up
    s.beginPath(); s.ellipse(...P(23.5, 31.5), 3.6 * u, 1.8 * u, 0.25, 0, Math.PI * 2); s.fill();
    const sk = new Path2D(); // the skirt, blown back
    sk.moveTo(...P(-3, 60)); sk.quadraticCurveTo(...P(-14 + fl(1, 1.5), 54), ...P(-20 + fl(1.4, 2), 44)); sk.quadraticCurveTo(...P(-6, 45), ...P(9, 44)); sk.quadraticCurveTo(...P(8, 52), ...P(7, 60)); sk.closePath(); s.fill(sk);
    const to = new Path2D(); // the torso, leaning in
    to.moveTo(...P(-3, 60)); to.quadraticCurveTo(...P(1, 70), ...P(4.5, 79)); to.lineTo(...P(12, 76)); to.quadraticCurveTo(...P(10, 66), ...P(7, 59)); to.closePath(); s.fill(to);
    const cp = new Path2D(); // the capelet streaming back
    cp.moveTo(...P(3.5, 79.5)); cp.quadraticCurveTo(...P(-8 + fl(0.6), 80 + fl(0.9, 1.5)), ...P(-22 + fl(1.1, 2), 74 + fl(1.5, 2))); cp.quadraticCurveTo(...P(-6, 70), ...P(2, 66)); cp.closePath(); s.fill(cp);
    limb([[10, 76], [21, 78], [31, 81]], 3.1); // the arm reaching ahead
    limb([[6, 75], [-3, 68], [-9, 61]], 3.0); // the other swung back
    s.fillRect(...P(9, 83), 3.8 * u, 4.5 * u);
    const hd = new Path2D(); hd.ellipse(...P(13.5, 86.5), 5.6 * u, 6.2 * u, 0.25, 0, Math.PI * 2); s.fill(hd);
    const cr = new Path2D(); // the cap, its visor ahead
    cr.moveTo(...P(7.5, 92)); cr.bezierCurveTo(...P(6, 96), ...P(9, 99.5), ...P(14, 99.6)); cr.bezierCurveTo(...P(20, 99.5), ...P(22, 95), ...P(19.5, 91.2)); cr.closePath(); s.fill(cr);
    const vz = new Path2D(); vz.moveTo(...P(17.5, 91.6)); vz.quadraticCurveTo(...P(23, 91.6), ...P(25.5, 89.6)); vz.quadraticCurveTo(...P(21.5, 89.7), ...P(17.5, 90.4)); vz.closePath(); s.fill(vz);
  }, glow, 5 * u);
}

/** A storm of petals across the lens, right to left, densest at tCut and gone ~0.5 s after it: a cut hides in it when
 *  the scenes either side of the cut both draw it (screen space, the same song time). */
export function petalStorm(c: C, t: number, tCut: number, dur = 0.8) {
  const u = (t - (tCut - dur)) / dur;
  if (u <= 0 || u > 1.75) return;
  for (let i = 0; i < 700; i++) {
    const h1 = hashK(i, 11), start = hashK(i, 12) * 0.7, v = 0.5 * (0.85 + 0.45 * h1);
    const x = W + 240 - ((u - start) / (1 - start * 0.5)) * (W + 700) * v, y = hashK(i, 13) * (H + 200) - 100 + Math.sin(i * 1.7 + t * 3) * 40;
    if (u < start || x < -160 || x > W + 220) continue;
    sakuraFlower(c, x, y, 8 + 22 * hashK(i, 14) ** 2, t * 6 + i, i % 3 ? PAL.sakura2 : i % 2 ? PAL.sakura : PAL.sakura3);
  }
}
