// Taisho street architecture as line art (docs/TREATMENT.md, Direction v3): near-black masses with every member traced
// in pale gold, lit windows flat gold, light printed as halftone dots, a fine dot screen over the night. A street is
// drawn as an elevation (no perspective), building by building: giyōfū (Western-style) banks, shop houses, mansards,
// stepped gables, corner clock towers, domes, and Japanese machiya in the same language.
import { SCALE } from '../engine/gl';
import { crest, PAL, SERIF900 } from './taisho';

type C = CanvasRenderingContext2D;
export const ARCH: Palette = { ink: '#151019', ink2: '#1c1522', line: '#d8bf88', dim: 'rgba(216,191,136,0.5)', win: '#1d1b33', lit: ['#ecc66c', '#ddb05a', '#f2d48c', '#e6bb62'] };
export type Kind = 'bank' | 'shop' | 'mansard' | 'gable' | 'tower' | 'dome' | 'machiya';
export type Palette = { ink: string; ink2: string; line: string; dim: string; win: string; lit: string[] };
export type Elev = { kind: Kind; w: number; floors: number; fh?: number; sign?: string; awning?: boolean; lit?: number; pal?: Palette };

/** One building's elevation, its left edge at x, standing on y = base. Returns its roofline's highest point. */
export function elevation(c: C, x: number, base: number, e: Elev, rnd: () => number): number {
  const P = e.pal ?? ARCH;
  const fh = e.fh ?? 86, gh = Math.round(fh * 1.3), w = e.w, nf = e.floors, top = base - gh - fh * (nf - 1), lit = e.lit ?? 0.45;
  c.save(); c.lineJoin = 'miter'; c.lineCap = 'butt';
  const stroke = (p: Path2D | null, lw = 1.4, col = P.line) => { c.strokeStyle = col; c.lineWidth = lw; if (p) c.stroke(p); };
  const L = (x1: number, y1: number, x2: number, y2: number, lw = 1.4, col = P.line) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  const box = (bx: number, by: number, bw: number, bh: number, fill = P.ink, lw = 1.4) => { c.fillStyle = fill; c.fillRect(bx, by, bw, bh); c.strokeStyle = P.line; c.lineWidth = lw; c.strokeRect(bx, by, bw, bh); };
  /** A window: arched or square, lit (flat gold, dark glazing bars, now and then a blind or a figure) or dark (gold bars). */
  const win = (wx: number, wy: number, ww: number, wh: number, arch: boolean, head: 'key' | 'ped' | 'seg' | 'lintel' | 'none') => {
    const on = rnd() < lit, p = new Path2D();
    if (arch) { p.moveTo(wx, wy + wh); p.lineTo(wx, wy + ww / 2); p.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); p.lineTo(wx + ww, wy + wh); p.closePath(); }
    else p.rect(wx, wy, ww, wh);
    c.fillStyle = on ? P.lit[Math.floor(rnd() * P.lit.length)]! : P.win; c.fill(p);
    c.save(); c.clip(p);
    if (on && rnd() < 0.25) { c.fillStyle = 'rgba(40,22,16,0.55)'; c.fillRect(wx, wy, ww, wh * (0.2 + 0.25 * rnd())); } // a blind half down
    if (on && rnd() < 0.12) { c.fillStyle = 'rgba(34,18,14,0.75)'; c.beginPath(); c.arc(wx + ww * 0.55, wy + wh * 0.55, ww * 0.13, 0, Math.PI * 2); c.fill(); c.fillRect(wx + ww * 0.36, wy + wh * 0.66, ww * 0.38, wh * 0.4); } // someone at the window
    c.strokeStyle = on ? 'rgba(36,20,16,0.85)' : P.dim; c.lineWidth = 1.2;
    const tr = arch ? wy + ww / 2 : wy + wh * 0.34;
    c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, tr); c.lineTo(wx + ww, tr); c.stroke();
    c.restore();
    stroke(p, 1.5);
    L(wx - 4, wy + wh + 2.5, wx + ww + 4, wy + wh + 2.5, 2.6); // the sill
    if (head === 'key' && arch) { c.fillStyle = P.ink; const k = new Path2D(); k.moveTo(wx + ww / 2 - 5, wy - 3); k.lineTo(wx + ww / 2 + 5, wy - 3); k.lineTo(wx + ww / 2 + 3.5, wy + 7); k.lineTo(wx + ww / 2 - 3.5, wy + 7); k.closePath(); c.fill(k); stroke(k, 1.2); }
    if (head === 'ped') { const k = new Path2D(); k.moveTo(wx - 6, wy - 5); k.lineTo(wx + ww / 2, wy - 17); k.lineTo(wx + ww + 6, wy - 5); k.closePath(); c.fillStyle = P.ink; c.fill(k); stroke(k, 1.3); }
    if (head === 'seg') { c.strokeStyle = P.line; c.lineWidth = 1.3; c.beginPath(); c.ellipse(wx + ww / 2, wy - 3, ww / 2 + 6, 9, 0, Math.PI, 0); c.stroke(); L(wx - 6, wy - 3, wx + ww + 6, wy - 3, 1.3); }
    if (head === 'lintel') L(wx - 5, wy - 5, wx + ww + 5, wy - 5, 2.4);
  };
  /** A band across the front between floors: a double line, the upper one overhanging. */
  const cornice = (y: number, heavy = false) => {
    box(x - (heavy ? 7 : 4), y - (heavy ? 12 : 6), w + (heavy ? 14 : 8), heavy ? 12 : 6, P.ink, 1.3);
    if (heavy) { c.fillStyle = P.dim; for (let dx = x - 3; dx < x + w + 3; dx += 8) c.fillRect(dx, y - 4, 3.5, 4); } // dentils
  };
  /** The shopfront: lit display windows, a door, an awning, the signboard above. */
  const shopfront = (y0: number, h: number, sign?: string, awning?: boolean) => {
    const sh = Math.min(28, h * 0.26), sy = y0 + 6;
    if (sign) { box(x + 10, sy, w - 20, sh, '#120d14', 1.6); c.fillStyle = ARCH.line; /* gold on black lacquer, whatever the palette */ c.font = `${Math.round(sh * 0.66)}px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText([...sign].reverse().join(' '), x + w / 2, sy + sh / 2 + 1); } // horizontal signs of the period read right to left
    const wy = sy + sh + (awning ? 26 : 10), wh = base - wy - 4, dw = Math.min(46, w * 0.18), dx = x + (rnd() < 0.5 ? w * 0.12 : w * 0.88 - dw);
    for (const [ax, aw] of [[x + 8, dx - x - 14], [dx + dw + 6, x + w - 8 - (dx + dw + 6)]] as const) {
      if (aw < 20) continue;
      c.fillStyle = P.lit[Math.floor(rnd() * 4)]!; c.fillRect(ax, wy, aw, wh);
      c.strokeStyle = 'rgba(36,20,16,0.8)'; c.lineWidth = 1.2; for (let mx = ax + aw / Math.ceil(aw / 34); mx < ax + aw - 4; mx += aw / Math.ceil(aw / 34)) { c.beginPath(); c.moveTo(mx, wy); c.lineTo(mx, wy + wh); c.stroke(); }
      c.beginPath(); c.moveTo(ax, wy + wh * 0.3); c.lineTo(ax + aw, wy + wh * 0.3); c.stroke();
      stroke(null); c.strokeRect(ax, wy, aw, wh);
    }
    const door = new Path2D(); door.moveTo(dx, base); door.lineTo(dx, wy + dw / 2); door.arc(dx + dw / 2, wy + dw / 2, dw / 2, Math.PI, 0); door.lineTo(dx + dw, base); c.fillStyle = '#0e0a10'; c.fill(door); stroke(door, 1.5);
    L(dx + dw / 2, wy + dw / 2, dx + dw / 2, base, 1.1, P.dim);
    if (awning) { // striped, scalloped
      const ay = sy + sh + 4, ah = 20;
      for (let ax = x + 6, i = 0; ax < x + w - 6; ax += 16, i++) {
        c.fillStyle = i % 2 ? P.ink2 : '#d8c49a';
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(Math.min(ax + 16, x + w - 6), ay); c.lineTo(Math.min(ax + 16, x + w - 6), ay + ah); c.arc(ax + 8, ay + ah, 8, 0, Math.PI); c.closePath(); c.fill();
      }
      L(x + 4, ay, x + w - 4, ay, 1.6);
    }
  };
  const bays = (n: number, y0: number, h: number, arch: (f: number, b: number) => boolean, head: 'key' | 'ped' | 'seg' | 'lintel', f: number) => {
    const bw = w / n, ww = Math.min(30, bw * 0.48), wh = h * 0.6;
    for (let b = 0; b < n; b++) win(x + bw * b + (bw - ww) / 2, y0 + h * 0.2, ww, wh, arch(f, b), head);
  };
  const pilasters = (n: number, y0: number, y1: number) => {
    const bw = w / n;
    for (let b = 0; b <= n; b++) { const px = x + bw * b; c.fillStyle = P.ink; c.fillRect(px - 4, y0, 8, y1 - y0); L(px - 4, y0, px - 4, y1, 1.2); L(px + 4, y0, px + 4, y1, 1.2); box(px - 6, y0 - 4, 12, 5, P.ink, 1.1); }
  };
  let roofTop = top;
  // ---- the roof (behind the body's outline) and the mass
  if (e.kind === 'mansard') {
    const rh = fh * 0.95, p = new Path2D(); p.moveTo(x - 4, top); p.lineTo(x + 22, top - rh); p.lineTo(x + w - 22, top - rh); p.lineTo(x + w + 4, top); p.closePath();
    c.fillStyle = P.ink2; c.fill(p); stroke(p, 1.8);
    for (let yy = top - rh + 12; yy < top; yy += 9) L(x + 22 - (yy - top + rh) * 0.27, yy, x + w - 22 + (yy - top + rh) * 0.27, yy, 0.9, 'rgba(216,191,136,0.22)'); // slates
    const nd = Math.max(1, Math.round(w / 90));
    for (let d = 0; d < nd; d++) { // dormers
      const dx = x + (w / nd) * (d + 0.5) - 13, dy = top - rh * 0.78;
      const dp = new Path2D(); dp.moveTo(dx - 4, dy + 8); dp.lineTo(dx + 13, dy - 8); dp.lineTo(dx + 30, dy + 8); dp.closePath(); c.fillStyle = P.ink; c.fill(dp); stroke(dp, 1.2);
      win(dx + 2, dy + 8, 22, rh * 0.48, true, 'none');
    }
    for (let k = x + 26; k < x + w - 26; k += 7) L(k, top - rh, k, top - rh - 6, 1, P.dim); // cresting
    if (rnd() < 0.7) box(x + w * 0.75, top - rh - 30, 16, 30, P.ink, 1.3); // a chimney
    roofTop = top - rh - 30;
  } else if (e.kind === 'gable') {
    const steps = 4, sw = w / 2 / (steps + 1), sh = fh * 0.32, p = new Path2D();
    p.moveTo(x, top);
    for (let s = 0; s < steps; s++) { p.lineTo(x + sw * s, top - sh * s); p.lineTo(x + sw * (s + 1), top - sh * s); }
    p.lineTo(x + w / 2 - sw / 2, top - sh * steps); p.lineTo(x + w / 2 + sw / 2, top - sh * steps);
    for (let s = steps - 1; s >= 0; s--) { p.lineTo(x + w - sw * (s + 1), top - sh * s); p.lineTo(x + w - sw * s, top - sh * s); }
    p.lineTo(x + w, top); p.closePath();
    c.fillStyle = P.ink; c.fill(p); stroke(p, 1.8);
    c.beginPath(); c.arc(x + w / 2, top - sh * 1.6, 13, 0, Math.PI * 2); c.fillStyle = rnd() < lit ? P.lit[0]! : P.win; c.fill(); stroke(null, 1.4); c.stroke();
    L(x + w / 2 - 13, top - sh * 1.6, x + w / 2 + 13, top - sh * 1.6, 1, 'rgba(36,20,16,0.8)');
    roofTop = top - sh * steps;
  } else if (e.kind === 'dome') {
    const r = Math.min(w * 0.22, 60), cx = x + w / 2;
    box(cx - r - 6, top - 22, 2 * r + 12, 22, P.ink, 1.4); // the drum
    for (let k = 0; k < 5; k++) win(cx - r + 4 + k * ((2 * r - 8) / 5) + 2, top - 18, (2 * r - 8) / 5 - 6, 12, false, 'none');
    const p = new Path2D(); p.moveTo(cx - r, top - 22); p.quadraticCurveTo(cx - r, top - 22 - r * 1.25, cx, top - 22 - r * 1.25); p.quadraticCurveTo(cx + r, top - 22 - r * 1.25, cx + r, top - 22); p.closePath();
    c.fillStyle = P.ink2; c.fill(p); stroke(p, 1.8);
    for (let k = 1; k < 5; k++) { const fx = cx - r + (2 * r * k) / 5; c.strokeStyle = P.dim; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, top - 22); c.quadraticCurveTo(fx + (cx - fx) * 0.4, top - 22 - r * 1.1, cx, top - 22 - r * 1.25); c.stroke(); }
    box(cx - 7, top - 22 - r * 1.25 - 18, 14, 18, P.ink, 1.2); L(cx, top - 22 - r * 1.25 - 18, cx, top - 22 - r * 1.25 - 46, 1.6);
    roofTop = top - 22 - r * 1.25 - 46;
  } else if (e.kind === 'tower') {
    const tw = Math.min(78, w * 0.3), tx = rnd() < 0.5 ? x : x + w - tw, th = fh * 1.3;
    box(tx, top - th, tw, th, P.ink, 1.8);
    c.beginPath(); c.arc(tx + tw / 2, top - th * 0.55, tw * 0.3, 0, Math.PI * 2); c.fillStyle = '#e9dcb8'; c.fill(); stroke(null, 1.6); c.stroke(); // the clock
    c.strokeStyle = P.ink; c.lineWidth = 1; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.beginPath(); c.moveTo(tx + tw / 2 + Math.cos(a) * tw * 0.24, top - th * 0.55 + Math.sin(a) * tw * 0.24); c.lineTo(tx + tw / 2 + Math.cos(a) * tw * 0.28, top - th * 0.55 + Math.sin(a) * tw * 0.28); c.stroke(); }
    c.lineWidth = 2; c.beginPath(); c.moveTo(tx + tw / 2, top - th * 0.55); c.lineTo(tx + tw / 2 + tw * 0.13, top - th * 0.55 - tw * 0.12); c.moveTo(tx + tw / 2, top - th * 0.55); c.lineTo(tx + tw / 2 - tw * 0.04, top - th * 0.55 + tw * 0.2); c.stroke();
    const sp = new Path2D(); sp.moveTo(tx - 6, top - th); sp.lineTo(tx + tw / 2, top - th - tw * 1.3); sp.lineTo(tx + tw + 6, top - th); sp.closePath(); c.fillStyle = P.ink2; c.fill(sp); stroke(sp, 1.8);
    L(tx + tw / 2, top - th - tw * 1.3, tx + tw / 2, top - th - tw * 1.3 - 22, 1.6);
    box(tx - 4, top - th - 6, tw + 8, 6, P.ink, 1.2);
    roofTop = top - th - tw * 1.3 - 22;
  } else if (e.kind === 'machiya') {
    const rh = fh * 0.42, p = new Path2D(); p.moveTo(x - 10, top + 6); p.lineTo(x + 14, top - rh); p.lineTo(x + w - 14, top - rh); p.lineTo(x + w + 10, top + 6); p.closePath();
    c.fillStyle = P.ink2; c.fill(p); stroke(p, 1.8);
    for (let yy = top - rh + 7; yy < top + 4; yy += 7) L(x + 14 - (yy - top + rh) * 0.5, yy, x + w - 14 + (yy - top + rh) * 0.5, yy, 0.9, 'rgba(216,191,136,0.3)');
    box(x + 10, top - rh - 7, w - 20, 7, P.ink, 1.4); // the ridge
    for (const ox of [x + 6, x + w - 18]) box(ox, top - rh - 15, 12, 15, P.ink, 1.2); // the end tiles
    roofTop = top - rh - 15;
  }
  // the body
  c.fillStyle = P.ink; c.fillRect(x, top, w, base - top); stroke(null, 1.8); c.strokeRect(x, top, w, base - top);
  // ---- the front
  const nb = Math.max(2, Math.round(w / (e.kind === 'gable' ? 64 : 76)));
  if (e.kind === 'machiya') {
    const ey = base - gh; // the eave between the floors: a dark band with tile ends
    box(x - 10, ey - 12, w + 20, 12, P.ink2, 1.4); c.fillStyle = P.dim; for (let tx = x - 6; tx < x + w + 8; tx += 10) { c.beginPath(); c.arc(tx, ey, 3, 0, Math.PI * 2); c.fill(); }
    const lx = x + 10, lw = w * 0.62, ly = ey + 12, lh = base - ly - 4; // the lattice over a lit room
    c.fillStyle = P.lit[1]!; c.fillRect(lx, ly, lw, lh); c.strokeStyle = 'rgba(30,18,14,0.92)'; c.lineWidth = 2.6; for (let bx = lx + 4; bx < lx + lw; bx += 7) { c.beginPath(); c.moveTo(bx, ly); c.lineTo(bx, ly + lh); c.stroke(); }
    stroke(null, 1.4); c.strokeRect(lx, ly, lw, lh);
    const nx = lx + lw + 10, nw = x + w - 8 - nx; // the door, its noren
    c.fillStyle = P.lit[2]!; c.fillRect(nx, ly, nw, lh); for (let k = 0; k < 3; k++) { c.fillStyle = k === 1 ? '#8e2418' : '#a52a1c'; c.fillRect(nx + (k * nw) / 3 + 1, ly, nw / 3 - 2, lh * 0.42); }
    crest(c, nx + nw / 2, ly + lh * 0.22, Math.min(9, nw * 0.16), '#efe4cc'); stroke(null, 1.4); c.strokeRect(nx, ly, nw, lh);
    const my = top + 10, mh = ey - 12 - my - 8; // the upper floor: slatted windows
    for (let k = 0; k < Math.max(1, Math.round(w / 110)); k++) { const mx = x + 14 + k * 110, mw = Math.min(90, w - 28); c.fillStyle = rnd() < lit ? P.lit[3]! : P.win; c.fillRect(mx, my, mw, mh); c.fillStyle = P.ink; for (let sx = mx + 3; sx < mx + mw; sx += 8) c.fillRect(sx, my, 4, mh); stroke(null, 1.3); c.strokeRect(mx, my, mw, mh); }
  } else {
    if (e.kind === 'bank') pilasters(nb, top + 4, base - gh);
    for (let f = 1; f < nf; f++) { // the upper floors, top down
      const y0 = top + fh * (f - 1);
      bays(nb, y0, fh, (ff, b) => e.kind === 'bank' ? ff === 1 && b % 2 === 0 : e.kind === 'gable' ? ff === 1 : e.kind === 'dome' ? ff === 1 : rnd() < 0.15,
        e.kind === 'bank' ? (f === 2 ? 'ped' : 'lintel') : e.kind === 'shop' ? 'lintel' : f === 1 ? 'key' : 'seg', f);
      cornice(y0 + fh, false);
    }
    if (e.kind === 'bank') { // a rusticated ground floor with arched openings
      const y0 = base - gh;
      for (let yy = y0 + 12; yy < base; yy += 12) L(x, yy, x + w, yy, 0.9, 'rgba(216,191,136,0.28)');
      for (let b = 0; b < nb; b++) { const bw = w / nb, ww = Math.min(40, bw * 0.55); win(x + bw * b + (bw - ww) / 2, y0 + 16, ww, gh - 22, true, 'key'); }
      if (e.sign) { const sw2 = Math.min(150, w * 0.5); box(x + w / 2 - sw2 / 2, y0 - 34, sw2, 22, '#120d14', 1.4); c.fillStyle = ARCH.line; c.font = `15px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText([...e.sign].reverse().join(' '), x + w / 2, y0 - 23); }
    } else shopfront(base - gh, gh, e.sign, e.awning);
    cornice(top + 2, true); // the top cornice
    if (e.kind === 'bank' || e.kind === 'shop') { // a balustrade, a pediment with an oculus on a wide bank
      const by = top - 14; L(x - 4, by, x + w + 4, by, 1.6); for (let bx = x + 2; bx < x + w - 2; bx += 9) { c.fillStyle = P.ink; c.fillRect(bx, by, 5, 12); c.strokeStyle = P.dim; c.lineWidth = 1; c.strokeRect(bx, by, 5, 12); }
      roofTop = by;
      if (e.kind === 'bank' && w > 230) { const pw = w * 0.42, p = new Path2D(); p.moveTo(x + w / 2 - pw / 2, by); p.lineTo(x + w / 2, by - 42); p.lineTo(x + w / 2 + pw / 2, by); p.closePath(); c.fillStyle = P.ink; c.fill(p); stroke(p, 1.6); c.beginPath(); c.arc(x + w / 2, by - 15, 8, 0, Math.PI * 2); c.fillStyle = P.win; c.fill(); c.stroke(); roofTop = by - 42; }
    }
  }
  c.restore();
  return roofTop;
}

/** A halftone light (canvas 2R × 2R, centre lit): dots on a 45° screen, their size falling off from the centre. */
export function halftoneSprite(R: number, spacing = 9, maxDot = 4.4, col = '#efc770') {
  const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(2 * R * SCALE);
  const c = cv.getContext('2d')!; c.scale(SCALE, SCALE); c.fillStyle = col;
  const n = Math.ceil((R * 1.5) / spacing);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = R + (i - j) * spacing * 0.7071, y = R + (i + j) * spacing * 0.7071, d = Math.hypot(x - R, y - R) / R;
    if (d >= 1) continue;
    const r = maxDot * Math.pow(1 - d, 1.15);
    if (r < 0.35) continue;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  return cv;
}

/** A fine dot screen over a rectangle (a printed night). */
export function dotScreen(c: C, x: number, y: number, w: number, h: number, alpha = 0.07, spacing = 6) {
  const t = document.createElement('canvas'); t.width = t.height = Math.round(spacing * SCALE);
  const g = t.getContext('2d')!; g.scale(SCALE, SCALE); g.fillStyle = `rgba(232,214,180,${alpha})`; g.beginPath(); g.arc(spacing / 2, spacing / 2, 0.75, 0, Math.PI * 2); g.fill();
  const p = c.createPattern(t, 'repeat')!; p.setTransform(new DOMMatrix().scale(1 / SCALE));
  c.save(); c.fillStyle = p; c.fillRect(x, y, w, h); c.restore();
}

let o1: HTMLCanvasElement | null = null, o2: HTMLCanvasElement | null = null;
/** Draw a figure into a scratch canvas, then onto c with a crisp outline (px wide, in c's units) around the union. */
export function withOutline(c: C, x0: number, y0: number, w: number, h: number, draw: (s: C) => void, color: string, px = 1.6) {
  const m = c.getTransform(), k = Math.hypot(m.a, m.b), W2 = Math.ceil(w * k), H2 = Math.ceil(h * k);
  const fit = (cv: HTMLCanvasElement | null) => { if (!cv || cv.width < W2 || cv.height < H2) { const n = document.createElement('canvas'); n.width = Math.max(W2, cv?.width ?? 0); n.height = Math.max(H2, cv?.height ?? 0); return n; } return cv; };
  o1 = fit(o1); o2 = fit(o2);
  const s = o1.getContext('2d')!; s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, o1.width, o1.height); s.setTransform(k, 0, 0, k, -x0 * k, -y0 * k); draw(s);
  const g = o2.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, o2.width, o2.height);
  const d = px * k;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]] as const) g.drawImage(o1, 0, 0, W2, H2, dx * d, dy * d, W2, H2);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, W2, H2); g.globalCompositeOperation = 'source-over';
  c.drawImage(o2, 0, 0, W2, H2, x0, y0, w, h);
  c.drawImage(o1, 0, 0, W2, H2, x0, y0, w, h);
}
void PAL;
