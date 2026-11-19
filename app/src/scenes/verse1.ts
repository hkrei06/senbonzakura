// Verse 1 (docs/TREATMENT.md, Direction v3): the night's extra edition (號外), from the type to the street — one thread of
// our own through the verse, instead of a picture per word:
//   press   lines 0–1. Shot 1, the composing table from above: line 0 brushed into the manuscript paper glyph by glyph,
//           each glyph's metal sort lifting out of the type case and landing in the composing stick on its sung time;
//           the manuscript stamped proofed, the stick inked. Shot 2 (cut on the next downbeat), the press's delivery from
//           above: the sheet steps out from under the cylinder one glyph of line 1 at a time (right side up, in order);
//           at the end the grippers let go and the run blows up off the press at the lens
//   gougai  lines 2–3. The extras scattered over the night street (a shallow-focus night, the lamps as bokeh): a newsboy
//           with his bell running and throwing them, hands reaching up; each phrase on a sheet that swings round to face
//           the lens while its glyphs ink in; the last one flies into the lens (the paper wipe into the festival street)
import { W, H } from '../engine/gl';
import { clamp, ease, hash, lerp, mulberry32, smoothstep } from '../engine/util';
import { PAL, SERIF900, SERIF600, layer, washi, decoFrame, crest, sealStamp, sakuraFlower, skyline } from './taisho';
import { ARCH, withOutline } from './taisho-arch';
import { glowDot } from './worlds';
import { drawColumn } from './torii';
import type { Build } from './poster';

type C = CanvasRenderingContext2D;
// the characters on the sorts in the case and on the small print: a Taisho newspaper's
const POOL = '日本東京大正帝國新聞號外報社電話番地町丁目市區驛前銀座淺草上野神田橋通商店會社株式銀行郵便局鐵道電車停留場汽車汽船港工場製造販賣廣告特價大賣出御案内開店記念祭禮花見櫻夜會劇場活動寫眞館音樂演奏舞洋服帽子靴時計眼鏡化粧品藥局醫院學校生徒先月火水木金土年時分午前後明治天氣晴曇雨雪風春夏秋冬山川海空星光影色白黑赤青銀銅鐵石竹紙筆墨書畫歌音聲文字言語讀者記のにをはがでとへやかなもてしたりれるらいうえおくけこさすせそつね';
const SW = 50, SP = 54; // a sort's face and its pitch (px)

/** A metal sort seen from above: its face, the glyph raised on it, mirrored (type); `ink` 0..1 inks the glyph black. */
function sortFace(c: C, x: number, y: number, s: number, ch: string, light = 1, ink = 0) {
  const g = c.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, `rgb(${Math.round(92 * light)},${Math.round(88 * light)},${Math.round(104 * light)})`);
  g.addColorStop(1, `rgb(${Math.round(52 * light)},${Math.round(49 * light)},${Math.round(61 * light)})`);
  c.fillStyle = g; c.fillRect(x, y, s, s);
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x, y, s, 1.4); c.fillRect(x, y, 1.4, s);
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x, y + s - 1.4, s, 1.4); c.fillRect(x + s - 1.4, y, 1.4, s);
  c.save(); c.translate(x + s / 2, y + s / 2); c.scale(-1, 1);
  c.font = `${Math.round(s * 0.76)}px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillText(ch, -1.2, 1.6); // the raised glyph's shadow
  const k = 1 - ink;
  c.fillStyle = `rgb(${Math.round((178 * k + 16 * ink) * light)},${Math.round((172 * k + 12 * ink) * light)},${Math.round((190 * k + 18 * ink) * light)})`;
  c.fillText(ch, 0, 0);
  if (ink > 0.5) { c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillText(ch, -0.6, -0.8); } // wet ink catches the lamp
  c.restore();
}

/** A sheet of the extra (blank of its headline): washi, the vermilion masthead, the rules, the small print, a vignette. */
export function extraSheet(w: number, h: number, seed: number, o: { band?: number; name?: string; headX?: number; printTo?: number } = {}) {
  return layer(w, h, (c, r) => {
    washi(c, w, h, r, '#ece3cf', 'rgba(90,70,50,0.07)', 0.035);
    const band = o.band ?? Math.round(h * 0.12);
    c.fillStyle = PAL.ver; c.fillRect(0, 0, w, band);
    c.fillStyle = PAL.cream; c.textBaseline = 'middle';
    // the masthead, right to left as the period printed it: 號外 large at the right, the paper's name small at the left
    c.font = `${Math.round(band * 0.66)}px ${SERIF900}`; c.textAlign = 'right';
    c.fillText('外號', w - band * 0.3, band * 0.54); // (read right to left: 號外)
    c.font = `${Math.round(band * 0.22)}px ${SERIF600}`; c.textAlign = 'left';
    c.fillText([...(o.name ?? '櫻都日報')].reverse().join(' '), band * 0.95, band * 0.54);
    crest(c, band * 0.48, band * 0.5, band * 0.3, PAL.cream);
    c.fillStyle = PAL.ink; c.fillRect(0, band + 6, w, 2.2); c.fillRect(0, band + 11, w, 1);
    // the small print: columns of type, right to left, left of the headline
    const hx = o.headX ?? w * 0.8;
    c.fillStyle = 'rgba(28,18,20,0.42)';
    const yEnd = o.printTo ?? h - 22;
    for (let x = hx - w * 0.14; x > 18; x -= 17) for (let y = band + 26; y < yEnd; y += 13 + (r() < 0.06 ? 13 : 0)) if (r() > 0.04) c.fillRect(x, y, 9, 8.5);
    c.fillStyle = PAL.ink; c.fillRect(hx - w * 0.12, band + 22, 1.4, h - band - 40); // the rule beside the headline
    // a small woodcut vignette: the moon over the roofs, in a box
    const bx = 22, by = band + 26, bw = Math.min(w * 0.34, 230), bh = bw * 0.72;
    c.fillStyle = '#ece3cf'; c.fillRect(bx, by, bw, bh);
    c.fillStyle = '#231a1c'; c.fillRect(bx, by, bw, bh);
    c.fillStyle = '#ece3cf'; c.beginPath(); c.arc(bx + bw * 0.68, by + bh * 0.36, bh * 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#231a1c'; c.beginPath(); c.arc(bx + bw * 0.73, by + bh * 0.32, bh * 0.17, 0, Math.PI * 2); c.fill(); // a crescent
    c.fillStyle = '#ece3cf';
    for (let k = 0; k < 7; k++) { const rx = bx + k * bw / 7, rw = bw / 7 + 2, rh = bh * (0.16 + 0.12 * r()); c.beginPath(); c.moveTo(rx - 3, by + bh - rh); c.lineTo(rx + rw / 2, by + bh - rh - 9); c.lineTo(rx + rw + 3, by + bh - rh); c.lineTo(rx + rw, by + bh); c.lineTo(rx, by + bh); c.closePath(); c.fill(); }
    c.fillStyle = '#231a1c'; for (let k = 0; k < 7; k++) c.fillRect(bx + 6 + k * bw / 7, by + bh - 9, 5, 5);
    c.strokeStyle = PAL.ink; c.lineWidth = 1.6; c.strokeRect(bx, by, bw, bh);
  }, seed);
}

/** The back of an extra: plain washi with the front showing through, mirrored and faint (the same sheet as
 *  extraSheet(w, h, seed, o)). The festival street opens out of it: both scenes draw it from the same call. */
export function sheetBack(w: number, h: number, seed: number, o: Parameters<typeof extraSheet>[3] = {}) {
  const front = extraSheet(w, h, seed, o);
  return layer(w, h, (c, r) => {
    washi(c, w, h, r, '#e9dfca', 'rgba(90,70,50,0.07)', 0.035);
    c.save(); c.globalAlpha = 0.1; c.translate(w, 0); c.scale(-1, 1); c.drawImage(front, 0, 0, w, h); c.restore();
  }, seed + 7);
}
export const HERO_B = { w: 600, h: 800, seed: 152, o: { band: 96, headX: 470, printTo: 600 } };

/** A newsboy (號外屋) running, side-on toward +x: hachimaki and its tails, a happi coat, the bell at his hip, a bundle
 *  of extras under his far arm; his near arm throws (throwU 0..1: the swing up). Feet at (x, y), height h. */
function newsboy(c: C, x: number, y: number, h: number, ph: number, throwU: number) {
  const u = h / 100, bob = Math.abs(Math.cos(ph)) * 3.2;
  withOutline(c, x - 70 * u, y - 140 * u, 150 * u, 150 * u, (s) => {
    s.translate(x, y - bob * u); s.scale(u, u);
    s.fillStyle = PAL.ink; s.strokeStyle = PAL.ink; s.lineCap = 'round'; s.lineJoin = 'round';
    for (const sd of [-1, 1]) { // the legs: thigh, shin (bent back as the leg lifts behind), the sandal
      const f = ph + (sd > 0 ? 0 : Math.PI), th = 0.72 * Math.sin(f), sh = th - (0.25 + 1.15 * Math.max(0, -Math.cos(f)));
      const hx = 0, hy = -48, kx = hx + Math.sin(th) * 24, ky = hy + Math.cos(th) * 24, ax = kx + Math.sin(sh) * 24, ay = ky + Math.cos(sh) * 24;
      s.lineWidth = 7; s.beginPath(); s.moveTo(hx, hy); s.lineTo(kx, ky); s.stroke();
      s.lineWidth = 5.5; s.beginPath(); s.moveTo(kx, ky); s.lineTo(ax, ay); s.stroke();
      s.beginPath(); s.ellipse(ax + 3, ay + 1, 5, 2.2, sh * 0.4, 0, Math.PI * 2); s.fill();
    }
    s.save(); s.rotate(0.22); // the body leans into the run
    s.beginPath(); s.moveTo(-9, -48); s.lineTo(10, -48); s.lineTo(9, -80); s.lineTo(-8, -82); s.closePath(); s.fill(); // the happi
    s.beginPath(); s.moveTo(-10, -50); s.lineTo(-16, -40); s.lineTo(-2, -44); s.closePath(); s.fill(); // its hem flaring back
    s.fillRect(-10, -54, 21, 4); // the sash
    s.beginPath(); s.ellipse(2, -90, 6.5, 7.2, 0, 0, Math.PI * 2); s.fill(); // the head
    s.fillRect(-5, -94, 14, 3); // the hachimaki
    s.beginPath(); s.moveTo(-5, -93); s.quadraticCurveTo(-14, -95 + Math.sin(ph * 2) * 2, -20, -90 + Math.sin(ph * 2 + 1) * 3); s.lineWidth = 2.2; s.stroke(); // its tails in the wind
    s.beginPath(); s.moveTo(-5, -92); s.quadraticCurveTo(-13, -90 + Math.sin(ph * 2 + 2) * 2, -18, -85 + Math.sin(ph * 2 + 3) * 3); s.stroke();
    // the far arm, the bundle under it
    s.lineWidth = 6; s.beginPath(); s.moveTo(-2, -78); s.lineTo(-6, -64); s.lineTo(6, -60); s.stroke();
    s.restore();
    // the near arm: swinging with the stride, thrown up on throwU
    const sw = Math.sin(ph + Math.PI) * 0.9, up = ease.outCubic(throwU), aa = lerp(sw, -2.6, up);
    const shx = 6, shy = -78, ex = shx + Math.sin(aa) * 15, ey = shy + Math.cos(aa) * 15, wx = ex + Math.sin(aa - 0.4 * (1 - up)) * 15, wy = ey + Math.cos(aa - 0.4 * (1 - up)) * 15;
    s.lineWidth = 6; s.beginPath(); s.moveTo(shx, shy); s.lineTo(ex, ey); s.lineTo(wx, wy); s.stroke();
  }, ARCH.line, 1.6);
  // the bundle and the bell, in colour, over the silhouette
  c.save(); c.translate(x, y - bob * u); c.scale(u, u); c.rotate(0.22);
  c.fillStyle = '#e6dcc6'; c.fillRect(-8, -70, 19, 11); c.fillStyle = PAL.ver; c.fillRect(-8, -70, 19, 2.5); // the extras
  c.restore();
  const by = y - (52 - Math.sin(ph * 2) * 2.5) * u - bob * u, bx = x - 4 * u + Math.sin(ph * 2) * 2 * u; // the bell swings
  glowDot(c, bx, by, 9 * u, 'rgba(255,214,140,A)', 0.55);
  c.fillStyle = PAL.gold2; c.beginPath(); c.arc(bx, by, 3.6 * u, 0, Math.PI * 2); c.fill();
  c.fillStyle = PAL.ink; c.fillRect(bx - 2.4 * u, by - 0.4 * u, 4.8 * u, 0.9 * u);
}

/** A hand reaching up out of the crowd from y0 (the frame's bottom): the forearm, the palm, the fingers spread by open. */
function reachingHand(c: C, x: number, y0: number, h: number, open: number, lean: number) {
  const wx = x + lean * h * 0.35, wy = y0 - h * 0.78;
  withOutline(c, x - h * 0.6, y0 - h * 1.25, h * 1.2, h * 1.3, (s) => {
    s.fillStyle = PAL.ink; s.strokeStyle = PAL.ink; s.lineCap = 'round';
    s.beginPath(); s.moveTo(x - h * 0.1, y0 + 4); s.lineTo(wx - h * 0.06, wy); s.lineTo(wx + h * 0.06, wy); s.lineTo(x + h * 0.1, y0 + 4); s.closePath(); s.fill();
    s.beginPath(); s.ellipse(wx, wy - h * 0.07, h * 0.075, h * 0.09, lean * 0.4, 0, Math.PI * 2); s.fill();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + lean * 0.4 + (k - 2) * (0.22 + 0.18 * open) + (k === 0 ? -0.35 * open : 0), L = h * (k === 0 ? 0.1 : 0.15 + 0.03 * (2 - Math.abs(k - 2)));
      s.lineWidth = h * 0.035; s.beginPath(); s.moveTo(wx + Math.cos(a) * h * 0.05, wy - h * 0.1 + Math.sin(a) * h * 0.04); s.lineTo(wx + Math.cos(a) * L, wy - h * 0.1 + Math.sin(a) * L); s.stroke();
    }
  }, ARCH.line, 1.3);
}

/** A glyph inking in on its sung time: a vermilion flash that settles to ink (age in s). */
const inkOf = (age: number) => { const k = smoothstep(0.04, 0.3, age); return `rgb(${Math.round(lerp(214, 26, k))},${Math.round(lerp(64, 16, k))},${Math.round(lerp(38, 20, k))})`; };

export const VERSE1: Record<string, (b: Build) => void> = {
  press(b) {
    const A = b.audio, T0 = b.start, T1 = b.end, p0 = b.phrases[0], p1 = b.phrases[1];
    if (!p0 || !p1) return;
    const g0 = [...p0.text], g1 = [...p1.text], last0 = p0.ct[p0.ct.length - 1]!;
    const tS = A.timeOfBar(Math.ceil(A.barAt(last0 + 0.05) - 1e-6)); // the cut to the press: the downbeat after line 0
    const s1 = (t: number) => (t < tS ? 1 : 0), s2 = (t: number) => (t >= tS ? 1 : 0);
    const R = mulberry32(5);

    // ===== shot 1: the composing table
    const CX0 = -170, CY0 = -140, COMP = 228; // the type case: 5 × 6 compartments of 4 × 4 sorts, past the frame's edges
    const pick = new Map<string, number>(); // "ci,cj,i,j" → index of the glyph of line 0 taken from it
    const at = (ci: number, cj: number, i: number, j: number) => [CX0 + 16 + ci * COMP + i * SP + 2, CY0 + 16 + cj * COMP + j * SP + 2] as const;
    const src: [number, number][] = [];
    for (let k = 0; k < g0.length; k++) {
      let key = '', tries = 0;
      do { const ci = Math.floor(R() * 4), cj = 1 + Math.floor(R() * 4), i = Math.floor(R() * 4), j = Math.floor(R() * 4); key = `${ci},${cj},${i},${j}`; tries++; } while (pick.has(key) && tries < 50);
      pick.set(key, k); const [ci, cj, i, j] = key.split(',').map(Number) as [number, number, number, number]; src.push(at(ci, cj, i, j) as [number, number]);
    }
    b.add(layer(W + 340, H + 280, (c, r) => {
      c.translate(170, 140);
      c.fillStyle = '#1b1317'; c.fillRect(-170, -140, W + 340, H + 280); // the table, its grain
      for (let i = 0; i < 160; i++) {
        const y = -140 + r() * (H + 280), a = 2 + r() * 6, f = 0.002 + r() * 0.006, ph = r() * 6;
        c.strokeStyle = `rgba(216,191,136,${0.02 + 0.03 * r()})`; c.lineWidth = 0.8 + r() * 1.6;
        c.beginPath(); for (let x = -170; x <= W + 170; x += 24) { const yy = y + Math.sin(x * f + ph) * a; if (x === -170) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke();
      }
      // the case: its frame, the dividers, the sorts (a few gone)
      c.fillStyle = '#3a2418'; c.fillRect(CX0, CY0, 5 * COMP + 20, 6 * COMP + 20);
      c.fillStyle = '#0d0a0e'; c.fillRect(CX0 + 10, CY0 + 10, 5 * COMP, 6 * COMP);
      for (let ci = 0; ci < 5; ci++) for (let cj = 0; cj < 6; cj++) {
        const ox = CX0 + 10 + ci * COMP, oy = CY0 + 10 + cj * COMP;
        c.fillStyle = '#2e1d14'; c.fillRect(ox, oy, COMP, 6); c.fillRect(ox, oy, 6, COMP);
        c.strokeStyle = 'rgba(216,191,136,0.28)'; c.lineWidth = 1; c.strokeRect(ox + 6, oy + 6, COMP - 6, COMP - 6);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const key = `${ci},${cj},${i},${j}`, k = pick.get(key);
          if (k === undefined && r() < 0.07) continue; // a gap
          const [x, y] = at(ci, cj, i, j);
          c.save(); c.translate(x + SW / 2, y + SW / 2); c.rotate((r() - 0.5) * 0.05); c.translate(-SW / 2 + (r() - 0.5) * 2, -SW / 2 + (r() - 0.5) * 2);
          sortFace(c, 0, 0, SW, k !== undefined ? g0[k]! : POOL[Math.floor(r() * POOL.length)]!, 0.52 + 0.22 * r());
          c.restore();
        }
        const sx = c.createLinearGradient(ox + 6, 0, ox + 40, 0); sx.addColorStop(0, 'rgba(0,0,0,0.55)'); sx.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sx; c.fillRect(ox + 6, oy + 6, 34, COMP - 6);
        const sy = c.createLinearGradient(0, oy + 6, 0, oy + 40); sy.addColorStop(0, 'rgba(0,0,0,0.55)'); sy.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sy; c.fillRect(ox + 6, oy + 6, COMP - 6, 34);
      }
      const vg = c.createRadialGradient(560, 420, 200, 560, 420, 1100); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); c.fillStyle = vg; c.fillRect(CX0, CY0, 5 * COMP + 20, 6 * COMP + 20);
      c.strokeStyle = PAL.gold; c.lineWidth = 1.6; c.strokeRect(CX0, CY0, 5 * COMP + 20, 6 * COMP + 20);
      // the galley at the right: columns of set type, the rest of the extra, its leads between
      c.fillStyle = '#1e1c24'; c.fillRect(1650, 70, 420, 980); c.strokeStyle = 'rgba(216,191,136,0.5)'; c.lineWidth = 1.4; c.strokeRect(1650, 70, 420, 980);
      for (let x = 1664; x < 2060; x += 28) {
        for (let y = 86; y < 1036; y += 25) { c.save(); c.translate(x, y); sortFace(c, 0, 0, 23, POOL[Math.floor(r() * POOL.length)]!, 0.45); c.restore(); }
        c.fillStyle = '#5a5460'; c.fillRect(x + 23, 80, 4, 960);
      }
    }, 101), { px: 170, py: -140, alpha: s1 });
    // the gaps the picked sorts leave (from the moment each lifts)
    b.dyn((c, t) => {
      if (!s1(t)) return;
      src.forEach(([x, y], k) => { if (t > p0.ct[k]! - 0.3) { c.fillStyle = '#0a080c'; c.fillRect(x - 1, y - 1, SW + 2, SW + 2); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x + SW - 5, y, 5, SW); } });
    });
    // the manuscript paper (genkō yōshi): 5 columns of 12 boxes in vermilion, line 0 in the rightmost
    const MX = 1010, MY = 112, MW = 390, MH = 880, BOX = 58, COLP = 74, MROT = -0.025;
    const mcx = MX + MW / 2, mcy = MY + MH / 2, box = (k: number) => [MX + MW - 30 - BOX, MY + 92 + k * BOX] as const;
    b.add(layer(W, H, (c, r) => {
      c.save(); c.translate(mcx, mcy); c.rotate(MROT); c.translate(-mcx, -mcy);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(MX + 10, MY + 14, MW, MH); // its shadow
      c.save(); c.beginPath(); c.rect(MX, MY, MW, MH); c.clip(); c.translate(MX, MY); washi(c, MW, MH, r, '#ebe1c9', 'rgba(110,80,60,0.07)', 0.03); c.restore();
      c.strokeStyle = 'rgba(200,50,30,0.62)'; c.lineWidth = 1.2;
      for (let col = 0; col < 5; col++) {
        const x = MX + MW - 30 - BOX - col * COLP;
        for (let k = 0; k < 12; k++) c.strokeRect(x, MY + 92 + k * BOX, BOX, BOX);
        c.beginPath(); c.moveTo(x - 16, MY + 92); c.lineTo(x - 16, MY + 92 + 12 * BOX); c.stroke(); // the ruby column's rule
      }
      c.strokeRect(MX + 16, MY + 80, MW - 32, 12 * BOX + 24);
      c.fillStyle = 'rgba(200,50,30,0.75)'; c.font = `18px ${SERIF600}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      drawColumn(c, '號外原稿', MX + MW - 22, MY + 18, 16, () => 1); // the slip's heading, in the top margin
      c.fillText('壹', MX + 40, MY + MH - 40);
      c.restore();
    }, 102), { alpha: s1 });
    b.dyn((c, t) => { // line 0 brushed into the boxes as it is sung (a wipe from the top, a little uneven: by hand)
      if (!s1(t)) return;
      c.translate(mcx, mcy); c.rotate(MROT); c.translate(-mcx, -mcy);
      c.font = `46px ${SERIF600}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1d1214';
      g0.forEach((ch, k) => {
        const u = clamp((t - p0.ct[k]!) / 0.12);
        if (u <= 0 || k > 11) return;
        const [bx, by] = box(k);
        c.save(); c.beginPath(); c.rect(bx, by, BOX, BOX * u); c.clip();
        c.translate(bx + BOX / 2 + (hash(k, 3) - 0.5) * 4, by + BOX / 2 + (hash(k, 4) - 0.5) * 3); c.rotate((hash(k, 5) - 0.5) * 0.08);
        c.fillText(ch, 0, 0); c.restore();
      });
      const su = (t - (last0 + 0.18)) / 0.2; // proofed: the vermilion stamp at the foot
      if (su > 0) { c.save(); const k = ease.outBack(clamp(su), 2.2); c.translate(MX + 70, MY + MH - 150); c.rotate(-0.1 * (1 - clamp(su))); c.scale(lerp(1.6, 1, k), lerp(1.6, 1, k)); c.globalAlpha = clamp(su * 4) * 0.92; sealStamp(c, '校了', 0, 0, 36); c.restore(); }
    });
    // the composing stick: a brass tray, its slots top to bottom
    const STX = 1468, STY = 168, slot = (k: number) => [STX + 35, STY + 44 + k * SP] as const, STL = 44 + g0.length * SP + 70;
    b.add(layer(W, H, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(STX + 10, STY + 14, 120, STL);
      const g = c.createLinearGradient(STX, 0, STX + 120, 0); g.addColorStop(0, '#6e5020'); g.addColorStop(0.35, '#c9a24a'); g.addColorStop(0.6, '#e8c77a'); g.addColorStop(1, '#7a5a24');
      c.fillStyle = g; c.fillRect(STX, STY, 120, STL);
      c.fillStyle = '#2a1f14'; c.fillRect(STX + 30, STY + 36, 60, STL - 60); // the channel
      c.fillStyle = '#b8892e'; c.fillRect(STX, STY + STL - 46, 120, 24); c.strokeStyle = '#3a2a12'; c.lineWidth = 1.5; c.strokeRect(STX, STY + STL - 46, 120, 24); // the knee
      c.fillStyle = '#e8c77a'; c.beginPath(); c.arc(STX + 104, STY + STL - 34, 8, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#3a2a12'; c.stroke(); // its screw
      c.strokeStyle = '#3a2a12'; c.lineWidth = 1.6; c.strokeRect(STX, STY, 120, STL);
      c.strokeStyle = 'rgba(255,240,200,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(STX + 3, STY + 3); c.lineTo(STX + 3, STY + STL - 3); c.stroke();
    }, 103), { alpha: s1 });
    // the sorts in the stick (landed), the ink roller, then the light over everything; the sort in flight above it
    const tR0 = tS - 0.42, tR1 = tS - 0.14;
    b.dyn((c, t) => {
      if (!s1(t)) return;
      const ry = STY + lerp(-30, STL + 20, ease.inOutQuad(clamp((t - tR0) / (tR1 - tR0))));
      g0.forEach((ch, k) => {
        const age = t - p0.ct[k]!;
        if (age < 0) return;
        const [sx, sy] = slot(k), bump = 1 + 0.08 * Math.exp(-age / 0.06), ink = t > tR0 && ry > sy ? 1 : 0;
        c.save(); c.translate(sx + SW / 2, sy + SW / 2); c.scale(bump, bump); sortFace(c, -SW / 2, -SW / 2, SW, ch, 1.05, ink); c.restore();
        if (age < 0.3) { c.strokeStyle = `rgba(232,199,122,${0.8 * (1 - age / 0.3)})`; c.lineWidth = 2; const e = 6 + 26 * ease.outCubic(age / 0.3); c.strokeRect(sx - e / 2, sy - e / 2, SW + e, SW + e); }
      });
      if (t > tR0 - 0.1 && t < tR1 + 0.25) { // the brayer: a rubber roller in its frame, rolled down the stick
        const g = c.createLinearGradient(0, ry - 24, 0, ry + 24); g.addColorStop(0, '#141016'); g.addColorStop(0.45, '#3c3842'); g.addColorStop(1, '#0d0b10');
        c.fillStyle = g; c.beginPath(); c.roundRect(STX - 22, ry - 24, 164, 48, 22); c.fill();
        c.strokeStyle = ARCH.line; c.lineWidth = 1.2; c.stroke();
        c.strokeStyle = '#2a2026'; c.lineWidth = 5; c.beginPath(); c.moveTo(STX + 142, ry); c.lineTo(STX + 190, ry); c.lineTo(STX + 214, ry + 40); c.stroke();
        c.fillStyle = '#5a3a22'; c.beginPath(); c.roundRect(STX + 200, ry + 34, 26, 90, 10); c.fill(); c.strokeStyle = ARCH.line; c.lineWidth = 1; c.stroke();
      }
    });
    const lamp = layer(W, H, (c) => {
      const g = c.createRadialGradient(1300, 500, 40, 1300, 500, 980); g.addColorStop(0, 'rgba(255,196,120,0.30)'); g.addColorStop(0.55, 'rgba(255,170,90,0.10)'); g.addColorStop(1, 'rgba(255,170,90,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    });
    const moonBand = layer(W, H, (c) => { // the window's light across the table, its two mullions in it
      c.save(); c.translate(W * 0.62, H * 0.42); c.rotate(-0.62);
      const g = c.createLinearGradient(0, -260, 0, 260); g.addColorStop(0, 'rgba(170,185,255,0)'); g.addColorStop(0.18, 'rgba(170,185,255,0.24)'); g.addColorStop(0.82, 'rgba(170,185,255,0.24)'); g.addColorStop(1, 'rgba(170,185,255,0)');
      c.fillStyle = g; c.fillRect(-1400, -260, 2800, 520);
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(-1400, -40, 2800, 16); c.fillRect(-1400, 90, 2800, 14);
      c.restore();
    });
    b.dyn((c, t) => { if (!s1(t)) return; c.globalCompositeOperation = 'screen'; c.drawImage(lamp, 0, 0, W, H); c.drawImage(moonBand, 0, 0, W, H); });
    b.dyn((c, t) => { // the sort in flight: lifted toward the lens, its shadow left behind on the table, set down on its sung time
      if (!s1(t)) return;
      g0.forEach((ch, k) => {
        const u = (t - (p0.ct[k]! - 0.3)) / 0.3;
        if (u <= 0 || u >= 1) return;
        const e = ease.inOutQuad(u), [x0, y0] = src[k]!, [x1, y1] = slot(k), lift = Math.sin(Math.PI * e);
        const x = lerp(x0, x1, e), y = lerp(y0, y1, e) - 40 * lift, sc = 1 + 0.9 * lift, rot = 0.5 * lift * (k % 2 ? 1 : -1);
        c.save(); c.fillStyle = `rgba(0,0,0,${0.45 * (1 - 0.5 * lift)})`; c.filter = `blur(${2 + 8 * lift}px)`; c.fillRect(lerp(x0, x1, e) + 14 * lift, lerp(y0, y1, e) + 22 * lift, SW, SW); c.restore();
        c.save(); c.translate(x + SW / 2, y + SW / 2); c.rotate(rot); c.scale(sc, sc); sortFace(c, -SW / 2, -SW / 2, SW, ch, 1.15); c.restore();
      });
    });

    // ===== shot 2: the press's delivery, from above
    const NIP = 868, SX = 610, SWD = 700, SH = 830, BAND = 96, GS = 74, GP = 84, HXL = 590; // HXL: the headline's centre, sheet-local
    const sheet = extraSheet(SWD, SH, 111, { band: BAND, headX: HXL });
    const printed = layer(SWD, SH, (c) => { c.drawImage(sheet, 0, 0, SWD, SH); c.font = `${GS}px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1a1014'; g1.forEach((ch, k) => c.fillText(ch, HXL, BAND + 24 + GP * k + GP / 2)); }, 112);
    const stepAt = (t: number) => { // how far the sheet has come out (px): the masthead on the cut, a glyph's slot on each sung glyph
      let d = (BAND + 24) * ease.outCubic(clamp((t - tS) / 0.22));
      for (const ct of p1.ct) d += GP * ease.outCubic(clamp((t - (ct - 0.05)) / 0.1));
      return d;
    };
    b.add(layer(W, H, (c, r) => {
      c.fillStyle = '#16131a'; c.fillRect(0, 0, W, H); // the press's bed plate, brushed
      for (let y = 0; y < H; y += 3) { c.fillStyle = `rgba(255,255,255,${0.012 + 0.012 * r()})`; c.fillRect(0, y, W, 1); }
      for (const [x0, x1] of [[110, 300], [1620, 1810]] as const) { // the side frames, riveted
        c.fillStyle = '#0f0d12'; c.fillRect(x0, -10, x1 - x0, H + 20);
        c.strokeStyle = ARCH.line; c.lineWidth = 1.6; c.strokeRect(x0, -10, x1 - x0, H + 20);
        c.strokeStyle = 'rgba(216,191,136,0.4)'; c.lineWidth = 1; c.strokeRect(x0 + 12, -10, x1 - x0 - 24, H + 20);
        for (let y = 30; y < H; y += 74) for (const x of [x0 + 26, x1 - 26]) { c.fillStyle = '#2a2630'; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill(); c.strokeStyle = ARCH.dim; c.stroke(); }
      }
      // the delivery pile at the left: the run so far, face up, a brass weight on its headlines
      for (let k = 0; k < 14; k++) { const ox = 332 + k * 1.4 + (r() - 0.5) * 6, oy = 130 + k * 2.2 + (r() - 0.5) * 5; c.save(); c.translate(ox, oy); c.rotate((r() - 0.5) * 0.03); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(6, 8, 250, 300); c.drawImage(extraSheet(250, 300, 300 + k), 0, 0, 250, 300); c.restore(); }
      const bg = c.createLinearGradient(330, 0, 600, 0); bg.addColorStop(0, '#6e5020'); bg.addColorStop(0.5, '#e8c77a'); bg.addColorStop(1, '#7a5a24');
      c.fillStyle = bg; c.fillRect(326, 270, 278, 40); c.strokeStyle = '#3a2a12'; c.lineWidth = 1.5; c.strokeRect(326, 270, 278, 40);
      // the maker's plate on the left frame: a gold oval, the press's name
      c.save(); c.translate(236, 560); c.fillStyle = '#7a5a24'; c.beginPath(); c.ellipse(0, 0, 70, 104, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = PAL.gold2; c.lineWidth = 3; c.stroke(); c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, 60, 94, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#2a1a0c'; c.font = `24px ${SERIF900}`; drawColumn(c, '櫻都印刷', 0, -62, 26, () => 1); crest(c, 0, 76, 12, '#2a1a0c'); c.restore();
      // ink smudges on the plate
      for (let k = 0; k < 9; k++) { const x = 320 + r() * 1280, y = 500 + r() * 340, rr = 20 + r() * 60, g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }
    }, 121), { alpha: s2 });
    b.dyn((c, t) => { // the sheet: only what has come out from under the cylinder; each glyph of line 1 printed on it
      if (!s2(t)) return;
      const d = stepAt(t), yh = NIP - d;
      c.save(); c.beginPath(); c.rect(0, 0, W, NIP); c.clip();
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(SX + 12, yh + 14, SWD, SH);
      c.drawImage(sheet, SX, yh, SWD, SH);
      c.font = `${GS}px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      g1.forEach((ch, k) => { const age = t - p1.ct[k]!; if (age < -0.06) return; c.fillStyle = inkOf(Math.max(0, age)); c.fillText(ch, SX + HXL, yh + BAND + 24 + GP * k + GP / 2); });
      c.restore();
      // the gripper bar at the sheet's head (it lets go at the end), its chains along the frames
      const rel = clamp((t - (T1 - 0.42)) / 0.12);
      c.fillStyle = '#2a2630'; c.fillRect(SX - 60, yh - 14, SWD + 120, 18); c.strokeStyle = ARCH.line; c.lineWidth = 1.2; c.strokeRect(SX - 60, yh - 14, SWD + 120, 18);
      for (let k = 0; k < 7; k++) { c.save(); c.translate(SX + 40 + k * 104, yh + 4); c.rotate(-1.1 * rel); c.fillStyle = '#3a3642'; c.fillRect(-7, -6, 14, 16); c.strokeStyle = ARCH.dim; c.strokeRect(-7, -6, 14, 16); c.restore(); }
      c.strokeStyle = 'rgba(216,191,136,0.55)'; c.lineWidth = 2; c.setLineDash([6, 5]); c.lineDashOffset = d * 0.5;
      for (const x of [SX - 54, SX + SWD + 54]) { c.beginPath(); c.moveTo(x, -10); c.lineTo(x, NIP); c.stroke(); }
      c.setLineDash([]);
    });
    b.dyn((c, t) => { // the impression cylinder across the bottom, turning with each step (its highlights run up into the nip)
      if (!s2(t)) return;
      const d = stepAt(t);
      const g = c.createLinearGradient(0, NIP, 0, H); g.addColorStop(0, '#09070b'); g.addColorStop(0.3, '#3b3846'); g.addColorStop(0.5, '#56535f'); g.addColorStop(0.75, '#2b2833'); g.addColorStop(1, '#09070b');
      c.fillStyle = g; c.fillRect(300, NIP, 1320, H - NIP);
      for (let k = 0; k < 8; k++) { const y = NIP + ((((k * 61 + d * 0.9) % 212) + 212) % 212); c.fillStyle = `rgba(255,240,220,${0.05 + 0.05 * Math.sin((y - NIP) / 212 * Math.PI)})`; c.fillRect(300, H - (y - NIP), 1320, 2); }
      c.strokeStyle = ARCH.line; c.lineWidth = 1.4; c.beginPath(); c.moveTo(300, NIP); c.lineTo(1620, NIP); c.stroke();
      for (const x of [300, 1620]) { // the bearings, their gear teeth turning
        c.fillStyle = '#2a2630'; c.fillRect(x - 24, NIP, 48, H - NIP); c.strokeStyle = ARCH.line; c.strokeRect(x - 24, NIP, 48, H - NIP);
        c.fillStyle = 'rgba(216,191,136,0.55)'; for (let y = NIP + (((-d * 0.9) % 18) + 18) % 18; y < H; y += 18) c.fillRect(x - 24, y, 48, 5); // running up into the nip
      }
    });
    b.dyn((c, t) => { // the impression counter on the right frame: its wheels roll on with each step
      if (!s2(t)) return;
      const n = 4870 + stepAt(t) / GP, x0 = 1400, y0 = 640;
      c.fillStyle = '#0a090c'; c.beginPath(); c.roundRect(x0 - 8, y0 - 14, 128, 74, 8); c.fill(); c.strokeStyle = ARCH.line; c.lineWidth = 1.4; c.stroke();
      c.font = '600 34px "Cormorant-600"'; c.textAlign = 'center'; c.textBaseline = 'middle'; // digits: the CJK subset has none
      for (let k = 0; k < 4; k++) {
        const v = n / 10 ** (3 - k), d = Math.floor(v) % 10, f = k === 3 ? v - Math.floor(v) : Math.max(0, (v % 1) * 10 - 9);
        c.save(); c.beginPath(); c.rect(x0 + k * 28, y0, 26, 44); c.clip(); c.fillStyle = '#e6dcc6'; c.fillRect(x0 + k * 28, y0, 26, 44);
        c.fillStyle = '#1a1014'; c.fillText(String(d), x0 + k * 28 + 13, y0 + 22 - 44 * f); c.fillText(String((d + 1) % 10), x0 + k * 28 + 13, y0 + 66 - 44 * f); c.restore();
      }
      c.fillStyle = ARCH.line; c.font = `14px ${SERIF600}`; c.fillText('印刷數', x0 + 56, y0 + 58);
    });
    b.dyn((c, t) => { if (!s2(t)) return; c.globalCompositeOperation = 'screen'; c.drawImage(lamp, -340, -40, W, H); });
    // the end: the grippers let go; the sheet and the whole run blow up off the press at the lens
    const tB = T1 - 0.36;
    b.dyn((c, t) => {
      if (t < tB) return;
      const u = (t - tB) / (T1 - tB);
      for (let k = 0; k < 26; k++) {
        const a = hash(k, 21) * Math.PI * 2, sp = 0.6 + hash(k, 22), e = ease.inQuad(clamp(u * (0.8 + 0.4 * hash(k, 23))));
        const x = lerp(470 + hash(k, 24) * 900, W / 2 + Math.cos(a) * 1400 * sp, e), y = lerp(280 + hash(k, 25) * 500, H / 2 + Math.sin(a) * 900 * sp, e);
        const sc = lerp(0.5, 3.2 + 2 * hash(k, 26), e), rot = (hash(k, 27) - 0.5) * 4 * e, flip = Math.cos(e * (3 + 4 * hash(k, 28)));
        c.save(); c.translate(x, y); c.rotate(rot); c.scale(sc * Math.max(0.12, Math.abs(flip)), sc);
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-120 + 8, -150 + 10, 240, 300);
        c.drawImage(printed, -120, -150, 240, 300); c.restore();
      }
    });
    b.overlay((c) => decoFrame(c, W, H));
    b.camera((t) => t < tS
      ? { x: 0, zoom: lerp(1, 1.1, ease.inOutQuad(clamp((t - T0) / (tS - T0)))), fx: 1300, fy: 520, rot: lerp(-0.025, 0, ease.outCubic(clamp((t - T0) / (tS - T0)))) }
      : { x: 0, zoom: lerp(1.55, 1.16, ease.inOutCubic(clamp((t - tS) / 1.1))) * lerp(1, 1.04, clamp((t - tS) / (T1 - tS))), fx: SX + SWD / 2, fy: lerp(830, 470, ease.inOutQuad(clamp(stepAt(t) / (BAND + 24 + GP * g1.length)))) }); // tight on the masthead as it emerges, then back as the sheet rises
    b.wind((t) => t);
    b.petals(24, { p: 1.2, alpha: (t) => 0.7 * s1(t) });
    b.post((t) => {
      const land = p0.ct.reduce((s, ct) => s + (t >= ct && t < tS ? Math.exp(-(t - ct) / 0.05) : 0), 0) + p1.ct.reduce((s, ct) => s + (t >= ct ? 0.8 * Math.exp(-(t - ct) / 0.06) : 0), 0);
      return { bloom: 0.42, halation: 0.16, vignette: 0.48, shake: [0.5 * land, 1.1 * land] as [number, number], zoom: 1 + (t >= tS ? 0.025 * Math.exp(-(t - tS) / 0.12) : 0) };
    });
  },

  gougai(b) {
    const A = b.audio, T0 = b.start, T1 = b.end, ph = b.phrases;
    const hA = ph[0], hB = ph[1], hC = ph[2]; // line 2; line 3's two phrases (the second in Latin letters)
    if (!hA || !hB) return;
    // the night street, out of focus: plum sky, a soft moon, the rooftops blurred, the lamps and lanterns as bokeh
    b.add(layer(W, H, (c, r) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120a16'); g.addColorStop(0.55, '#2b1530'); g.addColorStop(1, '#4a2342');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const m = c.createRadialGradient(1500, 210, 0, 1500, 210, 230); m.addColorStop(0, 'rgba(255,240,205,0.9)'); m.addColorStop(0.42, 'rgba(255,236,196,0.75)'); m.addColorStop(0.55, 'rgba(255,226,170,0.2)'); m.addColorStop(1, 'rgba(255,226,170,0)');
      c.fillStyle = m; c.fillRect(1270, -20, 460, 460);
      c.filter = 'blur(7px)'; skyline(c, W, 760, r, { fill: '#1a0d1c', win: 0.16, scale: 1.0 }); c.filter = 'none';
      c.fillStyle = '#120a12'; c.fillRect(0, 760, W, H - 760);
      const cols = ['rgba(255,206,130,A)', 'rgba(255,206,130,A)', 'rgba(255,170,110,A)', 'rgba(220,70,50,A)', 'rgba(247,182,204,A)', 'rgba(235,235,255,A)'];
      for (let i = 0; i < 70; i++) { // bokeh: soft discs with a slightly brighter rim
        const x = r() * W, y = 520 + r() * 520, rr = 18 + r() ** 2 * 110, col = cols[Math.floor(r() * cols.length)]!, a = 0.12 + 0.3 * r();
        const gg = c.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, col.replace('A', String(a * 0.7))); gg.addColorStop(0.82, col.replace('A', String(a))); gg.addColorStop(1, col.replace('A', '0'));
        c.fillStyle = gg; c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill();
      }
    }, 131), { p: 0.05 });
    // the sheets in the air: small far ones (soft), the newsboy's throws, a few near the lens (soft, big)
    const small = { img: extraSheet(160, 220, 141, { band: 26 }), w: 160, h: 220 };
    const soft = { img: layer(200, 260, (c) => { c.filter = 'blur(5px)'; c.drawImage(small.img, 20, 20, 160, 220); }, 142), w: 200, h: 260 };
    /** A sheet fluttering: turned by rot, its width foreshortened by flip (it turns about its long axis). */
    const flutter = (c: C, x: number, y: number, s: number, rot: number, flip: number, sp: { img: HTMLCanvasElement; w: number; h: number }) => {
      c.save(); c.translate(x, y); c.rotate(rot); c.scale(s * Math.max(0.1, Math.abs(flip)), s);
      c.drawImage(sp.img, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
      c.restore();
    };
    b.dyn((c, t) => { // far sheets drifting down across the street
      for (let i = 0; i < 34; i++) {
        const sp = 70 + 60 * hash(i, 1), x = ((hash(i, 2) * (W + 300) + (t - T0) * (40 + 60 * hash(i, 3))) % (W + 300)) - 150, y = ((hash(i, 4) * (H + 300) + (t - T0) * sp) % (H + 300)) - 150;
        flutter(c, x + Math.sin(t * 1.3 + i) * 30, y, 0.22 + 0.2 * hash(i, 5), (hash(i, 6) - 0.5) * 2 + t * (0.8 + hash(i, 7)), Math.cos(t * (2 + 3 * hash(i, 8)) + i), soft);
      }
    }, { p: 0.4 });
    // the newsboy: across the street from left to right, throwing an extra up on every beat
    const x0 = -260, x1 = W + 260, run = (t: number) => lerp(x0, x1, (t - T0) / (T1 - T0));
    const b0 = Math.ceil(A.beatAt(T0 + 0.2)), b1 = Math.floor(A.beatAt(T1 - 0.4)), throws: number[] = [];
    for (let k = b0; k <= b1; k++) throws.push(A.timeOfBeat(k));
    b.dyn((c, t) => {
      throws.forEach((tk, k) => { // the thrown sheets: up out of his hand, fluttering, drifting down
        const u = t - tk;
        if (u < 0 || u > 3.2) return;
        const hx = run(tk) + 20, hy = 880 - 300 * 0.95;
        const x = hx + (60 + 140 * hash(k, 11)) * u + 26 * Math.sin(u * 3 + k), y = hy - 560 * (1 - Math.exp(-u / 0.4)) + 70 * u * u;
        flutter(c, x, y, 0.5 + 0.2 * hash(k, 12), (hash(k, 13) - 0.5) + u * (2 + 2 * hash(k, 14)), Math.cos(u * (5 + 3 * hash(k, 15)) + k), small);
      });
      const tk = throws.reduce((p, x) => (x <= t ? x : p), -1e9), thr = Math.exp(-Math.max(0, t - tk) / 0.16) * (t >= tk ? 1 : 0);
      newsboy(c, run(t), 905, 300, ((run(t) - x0) / 110) * Math.PI, thr);
    }, { p: 0.7 });
    // the hands reaching up out of the crowd, rising on the beats in turn
    const hands = Array.from({ length: 7 }, (_, i) => ({ x: 140 + i * 270 + 60 * hash(i, 31), lean: (hash(i, 32) - 0.5) * 0.9, h: 360 + 110 * hash(i, 33) }));
    b.dyn((c, t) => {
      const bt = A.beatAt(t);
      hands.forEach((hd, i) => {
        const k = Math.floor(bt - i * 0.37), f = bt - i * 0.37 - k, rise = (k + i) % 2 === 0 ? Math.sin(Math.PI * clamp(f * 1.4)) : 0;
        reachingHand(c, hd.x, H + 40, hd.h * (0.55 + 0.45 * rise), 0.4 + 0.6 * rise, hd.lean);
      });
    }, { p: 1.1 });
    // the hero sheets: each phrase on its own extra, swung round to face the lens, its glyphs inking in as they are sung
    const heroA = { img: extraSheet(560, 800, 151, { band: 96, headX: 450 }), w: 560 }, heroB = { img: extraSheet(HERO_B.w, HERO_B.h, HERO_B.seed, HERO_B.o), w: HERO_B.w };
    const backB = { img: sheetBack(HERO_B.w, HERO_B.h, HERO_B.seed, HERO_B.o), w: HERO_B.w };
    const hold = (t: number, tIn: number, tOut: number) => ({ in: clamp((t - tIn) / 0.55), out: clamp((t - tOut) / 0.35) });
    const drawHero = (c: C, hs: { img: HTMLCanvasElement; w: number }, x: number, y: number, s: number, rot: number, flip: number, glyphs: () => void) => {
      c.save(); c.translate(x, y); c.rotate(rot); c.scale(s * Math.max(0.06, flip), s);
      c.fillStyle = 'rgba(0,0,0,0.42)'; c.filter = 'blur(10px)'; c.fillRect(-hs.w / 2 + 22, -400 + 28, hs.w, 800); c.filter = 'none';
      c.drawImage(hs.img, -hs.w / 2, -400, hs.w, 800); c.translate(-hs.w / 2, -400); glyphs(); c.restore();
    };
    const tAout = hB.t - 0.42, tFly = T1 - 0.4;
    b.dyn((c, t) => {
      { // A: line 2
        const k = hold(t, hA.t - 0.6, tAout);
        if (k.in > 0 && k.out < 1) {
          const e = ease.outBack(k.in, 1.2), o = ease.inCubic(k.out);
          const x = lerp(W + 300, 700, e) - 900 * o, y = lerp(-420, 520, ease.outCubic(k.in)) + 8 * Math.sin(t * 1.6) - 300 * o;
          const flip = Math.cos(lerp(1.3, 0, ease.outCubic(k.in)) + o * 1.5), rot = lerp(0.6, -0.05, e) + 0.02 * Math.sin(t * 1.3) - 0.7 * o;
          drawHero(c, heroA, x, y, 0.82 * (1 - 0.3 * o), rot, flip, () => {
            c.font = `56px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
            [...hA.text].forEach((ch, j) => { const age = t - hA.ct[j]!; if (age < 0) return; c.fillStyle = inkOf(age); c.fillText(ch, 450, 96 + 34 + j * 58 + 29); });
          });
        }
      }
    }, { p: 1 });
    b.overlay((c, t) => { // B: line 3 (a vertical phrase, then a headline in Latin wood type); in screen space
      {
        const k = hold(t, hB.t - 0.55, 1e9);
        if (k.in > 0) {
          const e = ease.outBack(k.in, 1.2), fl = ease.inCubic(clamp((t - tFly) / (T1 - 1 / 30 - tFly))); // full frame on the last frame before the cut
          const x = lerp(lerp(-300, 1220, e), W / 2, fl), y = lerp(lerp(-420, 520, ease.outCubic(k.in)) + 8 * Math.sin(t * 1.5 + 1), H / 2, fl);
          const turn = Math.cos(lerp(-1.2, 0, ease.outCubic(k.in)) + Math.PI * fl), rot = lerp(lerp(-0.5, 0.05, e) + 0.02 * Math.sin(t * 1.2), 0, fl);
          if (turn < 0) { drawHero(c, backB, x, y, lerp(0.82, 3.6, fl), rot, -turn, () => {}); return; } // over onto its back as it hits the lens
          drawHero(c, heroB, x, y, lerp(0.82, 3.6, fl), rot, turn, () => {
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.font = `104px ${SERIF900}`;
            [...hB.text].forEach((ch, j) => { const age = t - hB.ct[j]!; if (age < 0) return; c.fillStyle = inkOf(age); c.fillText(ch, 470, 96 + 40 + j * 108 + 54); });
            if (hC) {
              const lat = [...hC.text], fs = Math.min(110, 520 / (lat.length * 0.86)), w0 = lat.length * fs * 0.86;
              c.font = `${fs}px "Archivo-1250-900"`;
              lat.forEach((ch, j) => { const age = t - hC.ct[j]!; if (age < 0) return; c.fillStyle = inkOf(age); c.fillText(ch, 300 - w0 / 2 + fs * 0.43 + j * fs * 0.86, 690); });
              c.fillStyle = PAL.ink; c.fillRect(300 - w0 / 2, 744, w0 * clamp((t - hC.t) / 0.4), 4);
            }
          });
        }
      }
    });
    b.dyn((c, t) => { // near sheets crossing the lens, soft and big
      for (let i = 0; i < 6; i++) {
        const tt = T0 + 0.6 + i * 1.05, u = (t - tt) / 0.9;
        if (u < 0 || u > 1) continue;
        flutter(c, lerp(-300, W + 300, u) * (i % 2 ? 1 : -1) + (i % 2 ? 0 : W), lerp(200 + 500 * hash(i, 41), 300 + 500 * hash(i, 42), u), 2.6 + hash(i, 43), (hash(i, 44) - 0.5) * 2 + u * 2, Math.cos(u * 6 + i), soft);
      }
      const u0 = (t - T0) / 0.38; // the burst from the press carrying on past the lens at the cut
      if (u0 < 1) for (let k = 0; k < 9; k++) { const a = hash(k, 51) * Math.PI * 2, e = ease.outCubic(u0); flutter(c, W / 2 + Math.cos(a) * lerp(500, 1500, e), H / 2 + Math.sin(a) * lerp(320, 950, e), lerp(3.6, 5.5, e), hash(k, 52) * 4, Math.cos(e * 4 + k), soft); }
    }, { p: 1.6 });
    b.overlay((c) => decoFrame(c, W, H));
    b.camera((t) => ({ x: 120 * ease.inOutQuad(clamp((t - T0) / (T1 - T0))), zoom: lerp(1, 1.04, clamp((t - T0) / (T1 - T0))), rot: 0.015 * Math.sin((t - T0) * 0.7) }));
    b.wind((t) => t);
    b.petals(70, { p: 1.3 });
    b.post(() => ({ bloom: 0.5, halation: 0.2, vignette: 0.42 }));
    void sakuraFlower; void washi;
  },
};
