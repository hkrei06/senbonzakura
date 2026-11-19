// Verse 2 (lines 10–13): the song on a record, then the kimono.
//   record  a Taisho gramophone in the dark: a 78 on the turntable (its grooves catching a fixed gold glint as it
//           turns, the vermilion 櫻都蓄音器 label printed with the title), a gold line-art tonearm off a morning-glory
//           horn. The needle drops on the downbeat (the camera starts close on it and pulls back to the whole machine);
//           each glyph sung sends a spark up from the needle and stamps into the cream column; the horn bursts petals
//           on every downbeat; the last bar pushes into the horn's mouth.
//   kimono  the board's Miku cut from asanoha before a gold moon, now alive: fusuma-like panels of kimono patterns
//           slide on to the next pattern every downbeat, the moon's asanoha turns, her sleeves and hair in the wind; the
//           panels slam shut on the last beat (into the pre-chorus's fox wedding).
import type { Build } from './poster';
import type { Phrase } from './torii';
import { drawColumn } from './torii';
import { W, H, SCALE } from '../engine/gl';
import { clamp, ease, hash, lerp, smoothstep } from '../engine/util';
import { PAL, SERIF900, SERIF600, layer, washi, decoFrame, crest, sealStamp, asanoha, seigaiha, yagasuri, mikuStanding, sakuraFlower } from './taisho';

type C = CanvasRenderingContext2D;

function phraseAt(ph: Phrase[], t: number) { let p: Phrase | undefined; for (const x of ph) if (x.t <= t + 0.05) p = x; return p; }
const revealOf = (p: Phrase, t: number) => (j: number) => clamp((t - p.ct[j]!) / 0.09);
const beatsIn = (b: Build, t: number) => b.audio.beatAt(t) - b.audio.beatAt(b.start);
const barsIn = (b: Build, t: number) => beatsIn(b, t) / 4;

// ------------------------------------------------------------------ the gramophone
const RX = 800, RY = 610, RR = 455; // the record's centre and radius
const PIVOT = [1560, 600] as const; // the tonearm's pivot (where the horn's neck comes down beside the record)

/** The 78's grooves: a black disc ringed with grooves, and the two fixed sectors where they catch the lamp. */
function recordDisc(c: C) {
  c.save();
  c.fillStyle = '#060406'; c.beginPath(); c.arc(RX, RY, RR + 26, 0, Math.PI * 2); c.fill(); // the platter
  c.strokeStyle = PAL.gold; c.lineWidth = 3; c.beginPath(); c.arc(RX, RY, RR + 26, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#0b080b'; c.beginPath(); c.arc(RX, RY, RR, 0, Math.PI * 2); c.fill();
  for (let r = 175; r < RR - 6; r += 2.2) { // the grooves, a little uneven
    c.strokeStyle = `rgba(255,255,255,${0.025 + 0.02 * hash(r, 3)})`; c.lineWidth = 1;
    c.beginPath(); c.arc(RX, RY, r, 0, Math.PI * 2); c.stroke();
  }
  // the lamp's glint on the grooves: two opposite soft sectors (they stay put while the disc turns)
  for (const a0 of [-0.95, Math.PI - 0.95]) {
    const g = c.createRadialGradient(RX, RY, 170, RX, RY, RR);
    g.addColorStop(0, 'rgba(232,199,122,0)'); g.addColorStop(0.35, 'rgba(232,199,122,0.2)'); g.addColorStop(1, 'rgba(232,199,122,0.06)');
    for (let k = 0; k < 7; k++) {
      const w = 0.07 + 0.05 * k;
      c.globalAlpha = 0.22;
      c.fillStyle = g; c.beginPath(); c.moveTo(RX, RY); c.arc(RX, RY, RR, a0 - w, a0 + w); c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
  }
  c.restore();
}

/** The label (turning with the disc by `a`): vermilion, a gold ring, the maker's name round the top, the title. */
function recordLabel(c: C, a: number) {
  c.save();
  c.translate(RX, RY); c.rotate(a);
  c.fillStyle = PAL.ver; c.beginPath(); c.arc(0, 0, 160, 0, Math.PI * 2); c.fill();
  c.strokeStyle = PAL.gold2; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 150, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 142, 0, Math.PI * 2); c.stroke();
  c.fillStyle = PAL.gold2; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `30px ${SERIF900}`;
  const name = [...'櫻都蓄音器'];
  name.forEach((ch, i) => { c.save(); c.rotate(-0.62 + (i / (name.length - 1)) * 1.24); c.fillText(ch, 0, -112); c.restore(); });
  c.font = `54px ${SERIF900}`; c.fillText('千本桜', 0, 8);
  c.font = `600 17px "Cormorant-600", ${SERIF600}`; c.fillText('SAKURATO RECORDS · 78', 0, 62);
  crest(c, 0, -52, 16, PAL.gold2, false);
  c.fillStyle = '#0b080b'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill(); // the spindle
  c.fillStyle = PAL.gold; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill();
  c.restore();
}

/** The morning-glory horn in profile, upper right, its bell turned toward the record: the flare tapering back into
 *  the throat, gold seams along it, a scalloped rim; the neck drops from the throat to the tonearm's pivot. */
const MOUTH = [1300, 262] as const; // the bell's mouth (the camera pushes into it at the end)
function horn(c: C) {
  c.save();
  const [mx, my] = MOUTH, ry = 205, rx = 80, rot = 0.12, K = [1710, 380] as const, kr = 24;
  const rim = (u: number) => { // u -1 top … +1 bottom of the rim
    const a = (u * Math.PI) / 2;
    return [mx + Math.sin(a) * 0 - Math.sin(rot) * ry * u + Math.cos(rot) * rx * Math.cos(a) * 0.15, my + Math.cos(rot) * ry * u] as const;
  };
  const [tx, ty] = rim(-1), [bx, by] = rim(1);
  // the flare: two concave edges from the rim to the throat
  const g = c.createLinearGradient(mx, my, K[0], K[1]);
  g.addColorStop(0, '#5a2c56'); g.addColorStop(0.45, '#2d1630'); g.addColorStop(1, '#140a12');
  c.fillStyle = g; c.beginPath(); c.moveTo(tx, ty);
  c.quadraticCurveTo(mx + 120, my - 40, K[0], K[1] - kr);
  c.lineTo(K[0], K[1] + kr);
  c.quadraticCurveTo(mx + 140, my + 120, bx, by);
  c.closePath(); c.fill();
  for (let k = 1; k < 8; k++) { // seams along the flare
    const u = -1 + (2 * k) / 8, [x, y] = rim(u);
    c.strokeStyle = 'rgba(232,199,122,0.45)'; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx + 130, my + u * 50 + 40, K[0], K[1] + u * kr); c.stroke();
  }
  c.strokeStyle = PAL.gold2; c.lineWidth = 3;
  c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(mx + 120, my - 40, K[0], K[1] - kr); c.stroke();
  c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(mx + 140, my + 120, K[0], K[1] + kr); c.stroke();
  // the bell's open mouth (foreshortened) with its scalloped, rolled rim
  c.fillStyle = '#080408'; c.beginPath(); c.ellipse(mx, my, rx, ry, rot, 0, Math.PI * 2); c.fill();
  c.strokeStyle = PAL.gold2; c.lineWidth = 6;
  c.beginPath();
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2, sc = 1 + 0.045 * Math.cos(a * 8);
    const x = mx + (Math.cos(a) * rx * Math.cos(rot) - Math.sin(a) * ry * Math.sin(rot)) * sc, y = my + (Math.cos(a) * rx * Math.sin(rot) + Math.sin(a) * ry * Math.cos(rot)) * sc;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.stroke();
  c.strokeStyle = 'rgba(232,199,122,0.35)'; c.lineWidth = 1.5;
  for (const k of [0.75, 0.5]) { c.beginPath(); c.ellipse(mx + (1 - k) * 30, my, rx * k, ry * k, rot, 0, Math.PI * 2); c.stroke(); }
  // the neck down to the pivot
  c.strokeStyle = PAL.gold; c.lineWidth = 30; c.lineCap = 'round';
  c.beginPath(); c.moveTo(K[0], K[1]); c.quadraticCurveTo(K[0] + 60, K[1] + 120, PIVOT[0], PIVOT[1]); c.stroke();
  c.strokeStyle = '#24131c'; c.lineWidth = 20; c.stroke();
  c.restore();
}

/** The needle's point on the record (it creeps inward along the groove over the shot). */
function needlePoint(u: number): [number, number] {
  const r = lerp(405, 365, u), a = -0.62;
  return [RX + Math.cos(a) * r, RY + Math.sin(a) * r];
}

/** The tonearm from the pivot to the soundbox at the needle; `lift` 0..1 raised off the record (before the drop). */
function tonearm(c: C, nx: number, ny: number, lift: number) {
  c.save();
  const sx = nx + 18 * lift, sy = ny - 70 * lift;
  // the shadow on the record while it is up
  if (lift > 0) { c.fillStyle = `rgba(0,0,0,${0.35 * lift})`; c.beginPath(); c.ellipse(nx + 30 * lift, ny + 20 * lift, 70, 28, 0.4, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = PAL.gold2; c.lineWidth = 16; c.lineCap = 'round';
  c.beginPath(); c.moveTo(PIVOT[0], PIVOT[1]); c.quadraticCurveTo(PIVOT[0] - 120, PIVOT[1] - 160, sx + 40, sy - 70); c.stroke();
  c.strokeStyle = '#2a1812'; c.lineWidth = 8; c.stroke();
  c.fillStyle = PAL.gold; c.beginPath(); c.arc(PIVOT[0], PIVOT[1], 30, 0, Math.PI * 2); c.fill();
  c.strokeStyle = PAL.ink; c.lineWidth = 3; c.beginPath(); c.arc(PIVOT[0], PIVOT[1], 18, 0, Math.PI * 2); c.stroke();
  // the soundbox: a gold drum with its mica diaphragm, the needle under it
  c.save(); c.translate(sx + 40, sy - 70); c.rotate(-0.6);
  c.fillStyle = '#1a0f12'; c.beginPath(); c.ellipse(0, 0, 62, 54, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = PAL.gold2; c.lineWidth = 5; c.stroke();
  c.lineWidth = 1.5; for (const rr of [44, 34, 22]) { c.beginPath(); c.ellipse(0, 0, rr, rr * 0.87, 0, 0, Math.PI * 2); c.stroke(); }
  c.restore();
  c.strokeStyle = PAL.gold2; c.lineWidth = 4; c.beginPath(); c.moveTo(sx + 26, sy - 34); c.lineTo(sx, sy); c.stroke();
  c.restore();
}

export const VERSE2: Record<string, (b: Build) => void> = {
  record(b) {
    const P = b.audio.periodAt(b.start), drop = b.start + 0.18; // the needle lands just after the downbeat
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, '#140a14', 'rgba(255,240,220,0.035)', 0.04);
      asanoha(c, 0, 0, W, H, 110, 'rgba(201,162,74,0.07)', 1.2);
      const g = c.createRadialGradient(RX, RY - 80, 100, RX, RY, 1000); // the lamp over the machine
      g.addColorStop(0, 'rgba(255,207,122,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }, 801));
    b.add(layer(W, H, (c) => recordDisc(c), 802));
    b.dyn((c, t, lt) => {
      const spin = t < drop ? 0 : (t - drop) * 2 * Math.PI * 1.3; // 78 rpm
      recordLabel(c, spin);
      const u = clamp(lt / (b.end - b.start)), [nx, ny] = needlePoint(u);
      // the sparks the voice sends up out of the groove, one per glyph sung, floating toward the horn
      const p = phraseAt(b.phrases, t);
      for (const ph of b.phrases) ph.ct.forEach((ct, j) => {
        const age = t - ct;
        if (age < 0 || age > 1.6) return;
        const k = age / 1.6, x = lerp(nx, 1520, ease.outQuad(k)) + 40 * Math.sin(ct * 9 + age * 3), y = lerp(ny, 260, ease.inOutQuad(k)) - 80 * Math.sin(Math.PI * k);
        c.fillStyle = `rgba(255,224,150,${(1 - k) * 0.9})`;
        sakuraFlower(c, x, y, 7 + 5 * (1 - k), age * 4 + j, `rgba(255,224,150,${(1 - k) * 0.9})`);
      });
      horn(c);
      tonearm(c, nx, ny, 1 - smoothstep(b.start, drop, t));
      if (t >= drop && t < drop + 0.3) { // the needle lands: a ring
        const k = (t - drop) / 0.3; c.strokeStyle = `rgba(255,224,150,${1 - k})`; c.lineWidth = 3;
        c.beginPath(); c.arc(nx, ny, 10 + 90 * k, 0, Math.PI * 2); c.stroke();
      }
      // petals out of the horn's mouth on every downbeat
      const bars = barsIn(b, t);
      for (let k = Math.max(0, Math.floor(bars) - 1); k <= Math.floor(bars); k++) {
        const age = (bars - k) * 4 * P;
        if (age > 2.2) continue;
        for (let i = 0; i < 26; i++) {
          const a = Math.PI - 0.9 + 1.5 * hash(i, k + 7), sp = 260 + 380 * hash(i, k + 9);
          const x = MOUTH[0] + Math.cos(a) * sp * age, y = MOUTH[1] + Math.sin(a) * sp * age + 90 * age * age;
          sakuraFlower(c, x, y, 8 + 6 * hash(i, 3), age * 5 + i, i % 3 ? PAL.sakura2 : PAL.sakura);
        }
      }
      // the phrase, stamped down a cream column at the left as it is sung
      if (p) {
        const n = [...p.text].length, size = Math.min(104, 720 / (n * 1.06));
        c.save();
        c.fillStyle = 'rgba(239,228,204,0.94)'; c.fillRect(70, 110, size * 1.5, n * size * 1.06 + 70);
        c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(78, 118, size * 1.5 - 16, n * size * 1.06 + 54);
        c.font = `${size}px ${SERIF900}`; c.fillStyle = PAL.ink;
        drawColumn(c, p.text, 70 + size * 0.75, 145, size, (j) => ease.outBack(revealOf(p, t)(j), 2.2));
        c.restore();
      }
    });
    // close on the needle, pull back over the first bar; drift; push into the horn's mouth over the last bar
    b.camera((t) => {
      const bars = barsIn(b, t), [nx, ny] = needlePoint(0);
      const back = ease.inOutCubic(clamp(bars)), push = ease.inExpo(clamp(bars - 3));
      return { x: 0, zoom: lerp(2.3, 1, back) * (1 + 0.04 * clamp(bars - 1)) + 2.6 * push, fx: lerp(nx, W / 2, back) + (MOUTH[0] - W / 2) * push, fy: lerp(ny, H / 2, back) + (MOUTH[1] - H / 2) * push };
    });
    b.smear((t) => { const k = clamp(barsIn(b, t) - 3.6) * 2.5; return k > 0 ? { dx: 0, dy: 0, dz: 0.05 * k, fx: MOUTH[0], fy: MOUTH[1], n: 6, a: 0.5 } : null; });
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(30);
  },

  kimono(b) {
    // the patterns the panels cycle through (fusuma of kimono cloth)
    const pats: ((c: C, w: number) => void)[] = [
      (c, w) => yagasuri(c, 0, 0, w, H, 96, PAL.ver, PAL.cream),
      (c, w) => { c.fillStyle = PAL.plum; c.fillRect(0, 0, w, H); asanoha(c, 0, 0, w, H, 64, 'rgba(232,199,122,0.75)', 1.6); },
      (c, w) => seigaiha(c, 0, 0, w, H, 96, 'rgba(232,199,122,0.6)', PAL.ink),
      (c, w) => { c.fillStyle = PAL.cream; c.fillRect(0, 0, w, H); for (let y = 40; y < H; y += 120) for (let x = (y / 120) % 2 ? 60 : 0; x < w; x += 120) sakuraFlower(c, x, y, 34, 0.3, PAL.sakura, PAL.ver); },
      (c, w) => { c.fillStyle = PAL.ver; c.fillRect(0, 0, w, H); asanoha(c, 0, 0, w, H, 80, 'rgba(18,10,16,0.45)', 2); },
    ];
    const NP = 6, PW = W / NP, NPAT = pats.length;
    const tiles = pats.map((f, i) => layer(PW, H, (c) => f(c, PW), 900 + i));
    const moon = layer(920, 920, (c) => {
      c.save(); c.beginPath(); c.arc(460, 460, 410, 0, Math.PI * 2); c.clip();
      const g = c.createRadialGradient(400, 380, 40, 460, 460, 410); g.addColorStop(0, '#f2d58a'); g.addColorStop(1, '#c9a24a');
      c.fillStyle = g; c.fillRect(0, 0, 920, 920); asanoha(c, 0, 0, 920, 920, 70, 'rgba(120,80,20,0.55)', 1.6); c.restore();
      c.strokeStyle = PAL.ink; c.lineWidth = 3; c.beginPath(); c.arc(460, 460, 410, 0, Math.PI * 2); c.stroke();
    }, 905);
    // Miku cut from asanoha: her moving silhouette redrawn each frame into a scratch canvas, the pattern laid into it
    const pattern = layer(W, H, (c) => { c.fillStyle = PAL.ink; c.fillRect(0, 0, W, H); asanoha(c, 0, 0, W, H, 46, 'rgba(232,199,122,0.75)', 1.4); }, 906);
    const fig = layer(W, H, () => {}, 907), fc = fig.getContext('2d')!;
    b.dyn((c, t) => {
      const bars = barsIn(b, t), k = Math.floor(bars);
      const s = k === 0 ? 1 : ease.inOutCubic(clamp(((bars - k) * 4) / 0.45)); // each downbeat: 0.45 beat to slide over
      for (let i = 0; i < NP; i++) {
        const dir = i % 2 ? 1 : -1, cur = (k + i) % NPAT, prev = (k - 1 + i + NPAT) % NPAT, y = dir * (1 - s) * H;
        if (s < 1) c.drawImage(tiles[prev]!, i * PW, y - dir * H, PW, H);
        c.drawImage(tiles[cur]!, i * PW, y, PW, H);
        c.strokeStyle = 'rgba(18,10,16,0.85)'; c.lineWidth = 6; c.beginPath(); c.moveTo(i * PW, 0); c.lineTo(i * PW, H); c.stroke();
      }
      c.fillStyle = 'rgba(28,15,30,0.42)'; c.fillRect(0, 0, W, H);
      c.save(); c.translate(760, 520); c.rotate(t * 0.05); c.drawImage(moon, -460, -460, 920, 920); c.restore();
    }, { p: 0 });
    b.dyn((c, t) => {
      fc.save(); fc.setTransform(SCALE, 0, 0, SCALE, 0, 0); fc.clearRect(0, 0, W, H);
      mikuStanding(fc, 820, 1000, 900, 0.7 + 0.25 * Math.sin(t * 2.3), 2.1 + t * 1.7, '');
      fc.globalCompositeOperation = 'source-atop'; fc.drawImage(pattern, 0, 0, W, H); fc.restore();
      c.save(); c.shadowColor = 'rgba(232,199,122,0.55)'; c.shadowBlur = 16; c.drawImage(fig, 0, 0, W, H); c.restore();
      for (const [x, y, rr] of [[1500, 160, 40], [1700, 360, 26], [1580, 880, 34], [220, 820, 30], [160, 220, 22]] as const) {
        c.save(); c.translate(x, y); c.rotate(t * 0.4 + x); crest(c, 0, 0, rr * (1 + 0.08 * Math.sin(t * 3 + y)), PAL.gold); c.restore();
      }
      c.fillStyle = PAL.cream; c.fillRect(1600, 120, 190, 760); c.strokeStyle = PAL.gold; c.lineWidth = 3; c.strokeRect(1608, 128, 174, 744);
      const p = phraseAt(b.phrases, t);
      if (p) {
        const n = [...p.text].length, size = Math.min(110, 700 / (n * 1.06));
        c.font = `${size}px ${SERIF900}`; c.fillStyle = PAL.ink; drawColumn(c, p.text, 1695, 150, size, (j) => ease.outBack(revealOf(p, t)(j), 2));
      }
      sealStamp(c, '桜', 1695, 760, 46);
      // the last beat: the panels slam shut (ink closing in from both sides)
      const shut = smoothstep(b.end - 0.32, b.end - 0.02, t);
      if (shut > 0) { c.fillStyle = PAL.ink; c.fillRect(0, 0, (W / 2) * shut, H); c.fillRect(W - (W / 2) * shut, 0, (W / 2) * shut, H); }
    }, { p: 1 });
    b.camera((_t, lt) => ({ x: -6 * lt, zoom: 1 + 0.012 * lt }));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(50);
  },
};
