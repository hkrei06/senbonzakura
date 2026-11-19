// Chorus 1's graphic cards, cut between the Blender shots (timeline: W('card_crest', …) with params.carry, so the line
// being sung across the cut is set on the card): the design system flat and loud, every move on a beat, the phrase
// being sung stamped in as each glyph is sung.
//   card_crest  a gold sakura crest slams in on the downbeat and turns, rings pulse out on every beat; the phrase
//               stamped vertically beside it on plum washi with gold asanoha
//   card_plaque on a vermilion field of gold seigaiha, a black-lacquer plaque (扁額) swings in carrying the phrase in gold
//   card_finale the chorus's end: a huge moon ringed by turning crests, the title seal stamped on the last downbeat, then
//               the camera dives into the moon (into the interlude's city)
import type { Build } from './poster';
import type { Phrase } from './torii';
import { drawColumn } from './torii';
import { W, H } from '../engine/gl';
import { clamp, ease, lerp } from '../engine/util';
import { PAL, SERIF900, layer, washi, decoFrame, crest, sealStamp, moonDisc, asanoha, seigaiha, sakuraFlower, mikuStanding } from './taisho';

type C = CanvasRenderingContext2D;

function phraseAt(ph: Phrase[], t: number) { let p: Phrase | undefined; for (const x of ph) if (x.t <= t + 0.05) p = x; return p; }
const revealOf = (p: Phrase, t: number) => (j: number) => clamp((t - p.ct[j]!) / 0.09);
/** Beats since the entry's start (its first downbeat) at song time t. */
const beatsIn = (b: Build, t: number) => b.audio.beatAt(t) - b.audio.beatAt(b.start);
/** A decaying pulse on every beat (1 on the beat, falling over `rel` beats). */
const pulse = (b: Build, t: number, rel = 0.35) => { const x = beatsIn(b, t); return x < 0 ? 0 : Math.exp(-(x - Math.floor(x)) / rel); };

/** The phrase stamped vertically: cream glyphs with a vermilion outline, each in on its sung time with a small slam. */
function stampColumn(c: C, p: Phrase, t: number, x: number, y: number, size: number) {
  c.save();
  c.font = `${size}px ${SERIF900}`;
  c.fillStyle = PAL.cream; c.strokeStyle = PAL.ver; c.lineWidth = size * 0.08; c.lineJoin = 'round';
  drawColumn(c, p.text, x, y, size, (j) => ease.outBack(revealOf(p, t)(j), 2.4), true);
  c.restore();
}


/** A fox mask from the front (white, vermilion markings, gold in the ears), centred at (x, y), `h` tall; eyes 0..1 lit. */
export function foxMask(c: C, x: number, y: number, h: number, eyes: number) {
  const u = h / 100;
  c.save(); c.translate(x, y); c.scale(u, u);
  c.fillStyle = '#f6efe2'; c.strokeStyle = PAL.ink; c.lineWidth = 1.6;
  c.beginPath(); // the face: brow between the ears, cheeks, down to the muzzle
  c.moveTo(-30, -18); c.lineTo(-40, -62); c.lineTo(-14, -34); c.quadraticCurveTo(0, -38, 14, -34); c.lineTo(40, -62); c.lineTo(30, -18);
  c.quadraticCurveTo(38, 6, 16, 26); c.quadraticCurveTo(6, 44, 0, 46); c.quadraticCurveTo(-6, 44, -16, 26); c.quadraticCurveTo(-38, 6, -30, -18);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = PAL.gold; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 30, -27); c.lineTo(sx * 36, -52); c.lineTo(sx * 19, -34); c.closePath(); c.fill(); }
  c.strokeStyle = PAL.ver; c.lineWidth = 3; c.lineCap = 'round';
  for (const sx of [-1, 1]) { // the flame brows and the eye sweep
    c.beginPath(); c.moveTo(sx * 6, -22); c.quadraticCurveTo(sx * 16, -30, sx * 26, -20); c.stroke();
    c.beginPath(); c.moveTo(sx * 8, -8); c.quadraticCurveTo(sx * 18, -14, sx * 27, -6); c.stroke();
  }
  c.fillStyle = PAL.ver; c.beginPath(); c.moveTo(-3, -30); c.lineTo(0, -22); c.lineTo(3, -30); c.closePath(); c.fill(); // the forehead jewel
  for (const sx of [-1, 1]) { // the eyes: slits that glow blue
    c.fillStyle = PAL.ink; c.beginPath(); c.ellipse(sx * 17, -10, 7, 2.4, sx * -0.25, 0, Math.PI * 2); c.fill();
    if (eyes > 0) { c.save(); c.shadowColor = 'rgba(110,200,255,1)'; c.shadowBlur = 16 * eyes; c.fillStyle = 'rgba(150,220,255,' + eyes + ')'; c.beginPath(); c.ellipse(sx * 17, -10, 6, 1.6, sx * -0.25, 0, Math.PI * 2); c.fill(); c.restore(); }
  }
  c.strokeStyle = PAL.ver; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-9, 32); c.quadraticCurveTo(0, 38, 9, 32); c.stroke(); // the mouth
  c.fillStyle = PAL.ink; c.beginPath(); c.ellipse(0, 40, 4, 3, 0, 0, Math.PI * 2); c.fill(); // the nose
  c.restore();
}

/** A hitodama / foxfire in 2D: a blue-white teardrop flame with a halo, its tail up. */
export function wisp(c: C, x: number, y: number, r: number, t: number, seed: number) {
  const fl = 1 + 0.12 * Math.sin(t * 12 + seed * 5);
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r * 3 * fl);
  g.addColorStop(0, 'rgba(160,220,255,0.55)'); g.addColorStop(1, 'rgba(60,120,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3 * fl, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(200,240,255,0.92)';
  const tip = x + 0.3 * r * Math.sin(t * 7 + seed);
  c.beginPath(); c.moveTo(tip, y - r * 2.1 * fl); c.quadraticCurveTo(x + r, y - r * 0.1, x, y + r * 0.9); c.quadraticCurveTo(x - r, y - r * 0.1, tip, y - r * 2.1 * fl); c.fill();
  c.restore();
}

/** A guardian fox statue in profile, seated (koma-kitsune), facing `dir` (1 right), black lacquer edged in gold. */
function guardian(c: C, x: number, y: number, h: number, dir: number, holds: 'key' | 'jewel') {
  const u = h / 100;
  c.save(); c.translate(x, y); c.scale(dir * u, u);
  c.fillStyle = '#0d0809'; c.strokeStyle = PAL.gold; c.lineWidth = 1.4;
  c.beginPath(); // seated: haunch, chest up to the head, the ears, the snout forward
  c.moveTo(-34, 0); c.quadraticCurveTo(-40, -30, -20, -48); c.quadraticCurveTo(-12, -70, -2, -84); c.lineTo(-6, -100); c.lineTo(4, -90);
  c.lineTo(8, -102); c.lineTo(12, -88); c.quadraticCurveTo(26, -84, 34, -78); c.quadraticCurveTo(22, -72, 12, -70); c.quadraticCurveTo(10, -40, 18, 0); c.closePath();
  c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-34, -6); c.quadraticCurveTo(-60, -20, -52, -62); c.quadraticCurveTo(-48, -40, -30, -22); c.stroke(); // the tail
  c.fillStyle = PAL.ver; c.beginPath(); c.moveTo(-6, -64); c.lineTo(14, -62); c.lineTo(4, -48); c.closePath(); c.fill(); // the red bib
  c.fillStyle = PAL.gold2;
  if (holds === 'key') { c.fillRect(26, -80, 18, 3); c.beginPath(); c.arc(48, -78, 5, 0, Math.PI * 2); c.fill(); }
  else { c.beginPath(); c.arc(38, -76, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = PAL.ver; c.beginPath(); c.arc(38, -76, 3, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#1a1012'; c.fillRect(-44, 0, 70, 14); c.strokeRect(-44, 0, 70, 14); // the plinth
  c.restore();
}

/** The film's worlds as emblems (card_mosaic), each in a square `s` across centred on 0, in gold and cream. */
const EMBLEMS: ((c: C, s: number, t: number) => void)[] = [
  (c, s) => { c.fillStyle = PAL.cream; c.beginPath(); c.arc(0, -s * 0.04, s * 0.3, 0, Math.PI * 2); c.fill(); c.strokeStyle = PAL.gold; c.lineWidth = s * 0.012; for (const k of [1.18, 1.36]) { c.beginPath(); c.arc(0, -s * 0.04, s * 0.3 * k, 0, Math.PI * 2); c.stroke(); } }, // the moon (the intro)
  (c, s) => { // a metal sort, its glyph raised and mirrored (verse 1's press)
    c.fillStyle = '#8f8a9a'; c.fillRect(-s * 0.22, -s * 0.3, s * 0.44, s * 0.6); c.fillStyle = '#5c5868'; c.fillRect(-s * 0.22, s * 0.18, s * 0.44, s * 0.12);
    c.save(); c.scale(-1, 1); c.fillStyle = PAL.ink; c.font = `${Math.round(s * 0.34)}px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('桜', 0, -s * 0.06); c.restore();
  },
  (c, s, t) => { // a festival lantern (the street)
    c.fillStyle = PAL.ver; c.beginPath(); c.ellipse(0, 0, s * 0.2, s * 0.28, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(18,10,16,0.5)'; c.lineWidth = s * 0.012; for (let k = -2; k <= 2; k++) { c.beginPath(); c.ellipse(0, k * s * 0.09, s * 0.2 * Math.cos((k / 3) * 1.2), s * 0.02, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = PAL.ink; c.fillRect(-s * 0.12, -s * 0.33, s * 0.24, s * 0.06); c.fillRect(-s * 0.12, s * 0.27, s * 0.24, s * 0.06);
    c.fillStyle = `rgba(255,214,140,${0.35 + 0.15 * Math.sin(t * 9)})`; c.beginPath(); c.ellipse(0, 0, s * 0.1, s * 0.16, 0, 0, Math.PI * 2); c.fill();
  },
  (c, s) => { c.fillStyle = PAL.ver; c.fillRect(-s * 0.26, -s * 0.18, s * 0.06, s * 0.46); c.fillRect(s * 0.2, -s * 0.18, s * 0.06, s * 0.46); c.fillRect(-s * 0.32, -s * 0.12, s * 0.64, s * 0.05); c.fillStyle = PAL.ink; c.beginPath(); c.moveTo(-s * 0.4, -s * 0.28); c.quadraticCurveTo(0, -s * 0.22, s * 0.4, -s * 0.28); c.lineTo(s * 0.37, -s * 0.2); c.quadraticCurveTo(0, -s * 0.15, -s * 0.37, -s * 0.2); c.closePath(); c.fill(); }, // a torii (the tunnel)
  (c, s) => { // the gramophone (verse 2)
    c.fillStyle = '#5a3a22'; c.fillRect(-s * 0.26, s * 0.08, s * 0.32, s * 0.2); c.fillStyle = PAL.ink; c.beginPath(); c.ellipse(-s * 0.1, s * 0.07, s * 0.18, s * 0.035, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = PAL.gold; c.beginPath(); c.moveTo(-s * 0.02, s * 0.02); c.quadraticCurveTo(s * 0.12, -s * 0.06, s * 0.2, -s * 0.3); c.lineTo(s * 0.34, -s * 0.1); c.quadraticCurveTo(s * 0.12, -s * 0.05, s * 0.02, s * 0.05); c.closePath(); c.fill();
  },
  (c, s, t) => foxMask(c, 0, s * 0.02, s * 0.62, 0.6 + 0.4 * Math.sin(t * 6)), // the fox mask (chorus 2)
  (c, s, t) => { // 桜 in bulbs (the solo's cinema)
    c.font = `${Math.round(s * 0.5)}px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#ffcf5a'; c.shadowBlur = s * 0.06; c.fillStyle = `rgba(255,226,160,${0.85 + 0.15 * Math.sin(t * 12)})`; c.fillText('桜', 0, 0); c.shadowBlur = 0;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, on = (k + Math.floor(t * 8)) % 3 === 0; c.fillStyle = on ? '#fff1c8' : '#5a4a3a'; c.beginPath(); c.arc(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36, s * 0.018, 0, Math.PI * 2); c.fill(); }
  },
  (c, s, t) => { // the clock at midnight (the build)
    c.fillStyle = PAL.gold; c.beginPath(); c.arc(0, 0, s * 0.33, 0, Math.PI * 2); c.fill(); c.fillStyle = PAL.cream; c.beginPath(); c.arc(0, 0, s * 0.29, 0, Math.PI * 2); c.fill();
    c.fillStyle = PAL.ink; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.fillRect(Math.cos(a) * s * 0.25 - s * 0.008, Math.sin(a) * s * 0.25 - s * 0.008, s * 0.016, s * 0.016); }
    c.save(); c.rotate(t * 3); c.fillRect(-s * 0.008, -s * 0.24, s * 0.016, s * 0.24); c.restore(); c.fillRect(-s * 0.012, -s * 0.17, s * 0.024, s * 0.17);
  },
];

export const CARDS: Record<string, (b: Build) => void> = {
  // chorus 3's fourth bar: the film's worlds as a board of emblems, one lit on each eighth in the order they came, the
  // phrase stamped beside them
  card_mosaic(b) {
    const grounds = [PAL.night1, '#1e2c52', PAL.ver, PAL.plum, '#16403f', '#0b0c1e', '#2a1838', '#3a1d10'];
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, PAL.night0);
      asanoha(c, 0, 0, W, H, 90, 'rgba(201,162,74,0.12)', 1.2);
    }, 715));
    b.dyn((c, t) => {
      const e = beatsIn(b, t) * 2, S = 300, G = 26, x0 = 180, y0 = 210;
      EMBLEMS.forEach((draw, i) => {
        const cx = x0 + (i % 4) * (S + G) + S / 2, cy = y0 + Math.floor(i / 4) * (S + G) + S / 2, u = clamp(e - i), slam = ease.outBack(clamp(u / 0.5), 2.2);
        c.save(); c.translate(cx, cy);
        c.strokeStyle = PAL.gold; c.lineWidth = 2; c.strokeRect(-S / 2, -S / 2, S, S);
        if (u > 0) {
          const k = lerp(1.18, 1, slam);
          c.scale(k, k); c.globalAlpha = clamp(u / 0.15);
          c.fillStyle = grounds[i]!; c.fillRect(-S / 2, -S / 2, S, S);
          c.strokeStyle = PAL.gold; c.lineWidth = 4; c.strokeRect(-S / 2 + 10, -S / 2 + 10, S - 20, S - 20);
          draw(c, S, t);
        }
        c.restore();
      });
      const p = phraseAt(b.phrases, t);
      if (p) stampColumn(c, p, t, 1680, 140, Math.min(110, 760 / ([...p.text].length * 1.06)));
    });
    b.camera((_t, lt) => ({ x: 0, zoom: 1 + 0.025 * lt }));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(70);
  },

  // the end: the opening's moon again, Miku saluting before it; 千 本 桜 stamped on the beats of the last bars, the 初音
  // seal on the last hit; black when the band stops dead (the entry's end)
  card_end(b) {
    const A = b.audio, MX = 600, MY = 420, MR = 300, b0 = Math.ceil(A.beatAt(b.start) - 1e-6);
    const glyphT = [0, 1, 2].map((j) => A.timeOfBeat(b0 + j)), hits = A.ev.in(b.start, b.end, 'kick').map((e) => e.t), sealT = hits.length > 1 ? hits[hits.length - 1]! : b.end - 0.6;
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, PAL.night0, 'rgba(255,240,220,0.035)', 0.06);
      const g = c.createRadialGradient(MX, MY, 100, MX, MY, 950); g.addColorStop(0, 'rgba(120,50,90,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#120a10'; c.beginPath(); c.moveTo(0, 900); for (let x = 0; x <= W; x += 60) c.lineTo(x, 900 - 40 * Math.sin(x * 0.004) - 30 * Math.sin(x * 0.011 + 1)); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill(); // the hill
    }, 716));
    const moon = layer(1600, 1600, (c, r) => moonDisc(c, 800, 800, MR, r, false), 717);
    b.dyn((c, t, lt, a) => {
      c.save(); c.translate(MX, MY); const s = 1 + 0.015 * a.kick; c.scale(s, s); c.drawImage(moon, -800, -800, 1600, 1600); c.restore();
      c.save(); c.translate(MX, MY); c.strokeStyle = PAL.gold;
      ([[1.18, 1.2, 0], [1.32, 0.8, 6], [1.55, 1.6, 0]] as const).forEach(([k, lw, dash]) => { c.lineWidth = lw; c.setLineDash(dash ? [dash, dash * 1.6] : []); c.lineDashOffset = -t * 16; c.beginPath(); c.arc(0, 0, MR * k, 0, Math.PI * 2); c.stroke(); });
      c.setLineDash([]); c.restore();
      mikuStanding(c, MX - 40, 905, 420, 0.7, t * 2.2, 'rgba(255,214,150,0.9)');
      c.font = `150px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      [...'千本桜'].forEach((ch, j) => { // stamped on the beats: lit ink, a jolt
        const u = clamp((t - glyphT[j]!) / 0.08);
        if (u <= 0) return;
        const k = lerp(1.3, 1, ease.outBack(u, 2.4));
        c.save(); c.translate(1420, 240 + j * 175); c.scale(k, k); c.fillStyle = PAL.cream; c.strokeStyle = PAL.gold; c.lineWidth = 3; c.fillText(ch, 0, 0); c.strokeText(ch, 0, 0); c.restore();
      });
      if (t >= sealT) { const s = ease.outBack(clamp((t - sealT) / 0.18), 2.2); c.save(); c.translate(1600, 690); c.scale(lerp(2.2, 1, s), lerp(2.2, 1, s)); c.globalAlpha = clamp((t - sealT) / 0.05); sealStamp(c, '初音', 0, 0, 70); c.restore(); }
      void lt;
    });
    b.camera((_t, lt) => ({ x: 0, zoom: 1 + 0.02 * lt }));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(90);
  },

  // after the band's dead stop, over the reverb: black, then 終 small in gold in a thin ring, as an old film ends
  card_fin(b) {
    b.add(layer(W, H, (c) => { c.fillStyle = '#050304'; c.fillRect(0, 0, W, H); }, 718));
    b.dyn((c, t) => {
      const a = clamp((t - b.start - 0.5) / 0.7) * clamp((b.end - t - 0.1) / 1.1);
      if (a <= 0) return;
      c.save(); c.globalAlpha = a; c.translate(W / 2, H / 2);
      c.strokeStyle = PAL.gold; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 62, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 0.8; c.beginPath(); c.arc(0, 0, 70, 0, Math.PI * 2); c.stroke();
      c.fillStyle = PAL.gold2; c.font = `64px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('終', 0, 2);
      c.restore();
    }, { p: -1 });
    b.camera(() => ({ x: 0 }));
    b.petals(0);
  },

  card_fox(b) {
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, '#0b0c1e');
      seigaiha(c, 0, 0, W, H, 110, 'rgba(232,199,122,0.18)', '#0b0c1e');
      const g = c.createRadialGradient(W * 0.45, H / 2, 60, W * 0.45, H / 2, 820);
      g.addColorStop(0, 'rgba(40,70,140,0.45)'); g.addColorStop(1, 'rgba(5,6,16,0.85)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }, 711));
    b.dyn((c, t, lt) => {
      const slam = ease.outBack(clamp(lt / 0.3), 2.0), eyes = pulse(b, t, 0.4);
      for (const [x, y, k] of [[W * 0.45 - 420, H / 2 + 40, 0], [W * 0.45 + 420, H / 2 + 40, 1]] as const) wisp(c, x, y - 20 * Math.sin(t * 2 + k), 30, t, k);
      c.save(); c.globalAlpha = clamp(lt / 0.06);
      foxMask(c, W * 0.45, H / 2 + 20, lerp(1600, 660, slam), 0.4 + 0.6 * eyes);
      c.restore();
      const p = phraseAt(b.phrases, t);
      if (p) stampColumn(c, p, t, 1560, 160, Math.min(118, 740 / ([...p.text].length * 1.06)));
    });
    b.camera((_t, lt) => ({ x: 0, zoom: 1 + 0.03 * lt }));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(60);
  },

  card_guardians(b) {
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, PAL.ver);
      asanoha(c, 0, 0, W, H, 96, 'rgba(18,10,16,0.18)', 1.6);
      const g = c.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H * 0.42, 700);
      g.addColorStop(0, 'rgba(255,214,140,0.5)'); g.addColorStop(1, 'rgba(120,20,10,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#0d0809'; c.fillRect(0, 900, W, 180); c.strokeStyle = PAL.gold; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 900); c.lineTo(W, 900); c.stroke();
    }, 712));
    b.dyn((c, t, lt) => {
      const rise = ease.outCubic(clamp(lt / 0.35));
      guardian(c, W / 2 - 480, lerp(1200, 900, rise), 560, 1, 'key');
      guardian(c, W / 2 + 480, lerp(1200, 900, rise), 560, -1, 'jewel');
      for (let k = 0; k < 3; k++) wisp(c, W / 2 + (k - 1) * 120, 470 - 40 * Math.sin(t * 2.2 + k * 2), 22, t, k + 3);
      const p = phraseAt(b.phrases, t);
      if (p) stampColumn(c, p, t, W / 2, 110, Math.min(100, 520 / ([...p.text].length * 1.06)));
    });
    b.camera((_t, lt) => ({ x: 0, zoom: 1.02 + 0.02 * lt }));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(80);
  },

  card_foxmoon(b) {
    const P = b.audio.periodAt(b.start), last = b.audio.timeOfBar(Math.round(b.audio.barAt(b.end)) - 1);
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, '#080918');
      const g = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1100);
      g.addColorStop(0, '#1d2550'); g.addColorStop(1, '#05060f');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }, 713));
    b.add(layer(W, H, (c, r) => moonDisc(c, W / 2, H / 2 - 40, 270, r), 714));
    b.dyn((c, t, lt) => {
      // foxfires spiralling up round the moon, more of them every beat
      const nb = Math.min(48, 6 + Math.floor(beatsIn(b, t)) * 2);
      for (let k = 0; k < nb; k++) {
        const a = k * 2.399 + lt * (0.5 + 0.02 * k), rr = 330 + 40 * Math.sin(k * 1.7) + 8 * k;
        const x = W / 2 + Math.cos(a) * rr, y = H / 2 - 40 + Math.sin(a) * rr * 0.55 - 6 * k * (lt / 6);
        wisp(c, x, y, 14 + 6 * Math.sin(k), t, k);
      }
      foxMask(c, W / 2, H / 2 - 40, 260, 0.5 + 0.5 * pulse(b, t, 0.45));
      const p = phraseAt(b.phrases, t);
      if (p) {
        const chars = [...p.text], sz = Math.min(80, 1300 / chars.length), wd = chars.length * sz * 1.05;
        c.font = sz + 'px ' + SERIF900; c.textAlign = 'center'; c.textBaseline = 'middle';
        chars.forEach((ch, j) => {
          const a = revealOf(p, t)(j);
          if (a <= 0) return;
          c.save(); c.globalAlpha = a; c.translate(W / 2 - wd / 2 + sz * 0.525 + j * sz * 1.05, 970);
          c.shadowColor = 'rgba(110,200,255,0.9)'; c.shadowBlur = 18; c.fillStyle = 'rgba(225,245,255,0.97)'; c.fillText(ch, 0, 0); c.restore();
        });
      }
      if (t >= last) {
        const s = ease.outBack(clamp((t - last) / 0.18), 2.2);
        c.save(); c.translate(W / 2 + 330, H / 2 - 260); c.scale(lerp(2.2, 1, s), lerp(2.2, 1, s)); c.globalAlpha = clamp((t - last) / 0.05);
        sealStamp(c, '千本桜', 0, 0, 84); c.restore();
      }
    });
    // the last half beat: a whip to the right (the solo's neon is waiting)
    b.camera((t) => ({ x: 2400 * ease.inCubic(clamp((t - (b.end - P * 0.6)) / (P * 0.6))), zoom: 1 + 0.015 * (t - b.start) }));
    b.smear((t) => { const k = clamp((t - (b.end - P * 0.6)) / (P * 0.6)); return k > 0 ? { dx: -260 * k, dy: 0, dz: 0, fx: W / 2, fy: H / 2, n: 8, a: 0.6 } : null; });
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(120);
  },

  card_crest(b) {
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, PAL.plum);
      asanoha(c, 0, 0, W, H, 92, 'rgba(201,162,74,0.16)', 1.4);
      const g = c.createRadialGradient(W * 0.58, H / 2, 80, W * 0.58, H / 2, 900);
      g.addColorStop(0, 'rgba(58,29,60,0)'); g.addColorStop(1, 'rgba(18,10,16,0.75)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }, 701));
    b.dyn((c, t, lt) => {
      const cx = W * 0.6, cy = H / 2, slam = ease.outBack(clamp(lt / 0.32), 1.8);
      // the rings, one out from the crest on every beat
      const x = beatsIn(b, t);
      for (let k = Math.max(0, Math.floor(x) - 2); k <= Math.floor(x); k++) {
        const a = x - k, rr = 300 + a * 520;
        c.strokeStyle = `rgba(232,199,122,${0.55 * (1 - a / 3)})`; c.lineWidth = 6 * (1 - a / 3);
        c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.stroke();
      }
      c.save();
      c.translate(cx, cy);
      c.rotate(-0.9 * (1 - slam) + lt * 0.35);
      c.scale(lerp(1.8, 1, slam) * (1 + 0.03 * pulse(b, t)), lerp(1.8, 1, slam) * (1 + 0.03 * pulse(b, t)));
      c.globalAlpha = clamp(lt / 0.08);
      crest(c, 0, 0, 280, PAL.gold2);
      c.strokeStyle = PAL.gold; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 318, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; sakuraFlower(c, Math.cos(a) * 360, Math.sin(a) * 360, 16, a, PAL.sakura2, PAL.ver); }
      c.restore();
      const p = phraseAt(b.phrases, t);
      if (p) stampColumn(c, p, t, 330, 170, Math.min(132, 760 / ([...p.text].length * 1.06)));
      sealStamp(c, '桜', 1690, 860, 50);
    });
    b.camera((_t, lt) => ({ x: 0, zoom: 1 + 0.03 * lt }));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(140);
  },

  card_plaque(b) {
    b.add(layer(W, H, (c, r) => {
      c.fillStyle = PAL.ver; c.fillRect(0, 0, W, H);
      seigaiha(c, 0, 0, W, H, 120, 'rgba(232,199,122,0.5)', PAL.ver);
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(18,10,16,0.55)'); g.addColorStop(0.5, 'rgba(18,10,16,0)'); g.addColorStop(1, 'rgba(18,10,16,0.65)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      moonDisc(c, 1560, 250, 120, r);
    }, 702));
    b.dyn((c, t, lt) => {
      // the plaque swings in from the top on the downbeat (a damped pendulum), lands, then breathes with the beat
      const sw = lt < 0 ? 1 : Math.exp(-lt / 0.35) * Math.cos(lt * 13), drop = ease.outCubic(clamp(lt / 0.22));
      const p = phraseAt(b.phrases, t);
      const n = p ? [...p.text].length : 4, size = Math.min(118, 700 / (n * 1.06)), ph = n * size * 1.06 + 150;
      c.save();
      c.translate(W / 2 - 120, lerp(-ph, 120, drop));
      c.rotate(0.22 * sw);
      c.fillStyle = '#100a0c'; c.fillRect(-140, 0, 280, ph);
      c.strokeStyle = PAL.gold; c.lineWidth = 8; c.strokeRect(-128, 12, 256, ph - 24);
      c.lineWidth = 2; c.strokeRect(-112, 28, 224, ph - 56);
      for (const [dx, dy] of [[-1, 0], [1, 0]] as const) { c.fillStyle = PAL.gold; c.beginPath(); c.arc(dx * 128, dy + 12, 9, 0, Math.PI * 2); c.fill(); }
      if (p) {
        c.font = `${size}px ${SERIF900}`;
        c.fillStyle = PAL.gold2; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3;
        drawColumn(c, p.text, 0, 75, size, (j) => ease.outCubic(revealOf(p, t)(j)), true);
      }
      c.restore();
      crest(c, 1580, 820, 110 * (1 + 0.04 * pulse(b, t)), PAL.gold2);
    });
    b.camera((_t, lt) => ({ x: 0, zoom: 1.02 + 0.025 * lt }));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(120);
  },

  card_finale(b) {
    const P = b.audio.periodAt(b.start), last = b.audio.timeOfBar(Math.round(b.audio.barAt(b.end)) - 1); // the last bar's downbeat
    b.add(layer(W, H, (c, r) => {
      washi(c, W, H, r, PAL.night0);
      const g = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1100);
      g.addColorStop(0, PAL.plum); g.addColorStop(1, PAL.ink);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }, 703));
    b.add(layer(W, H, (c, r) => moonDisc(c, W / 2, H / 2 - 30, 300, r), 704));
    b.dyn((c, t, lt) => {
      // the crests ringing the moon, turning; they flare on every beat
      const k = pulse(b, t);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + lt * 0.25;
        crest(c, W / 2 + Math.cos(a) * 470, H / 2 - 30 + Math.sin(a) * 430, 34 * (1 + 0.15 * k), i % 2 ? PAL.gold2 : PAL.sakura2, i % 2 === 0);
      }
      // the phrase across the bottom, stamped in cream
      const p = phraseAt(b.phrases, t);
      if (p) {
        const chars = [...p.text], sz = Math.min(84, 1300 / chars.length), wd = chars.length * sz * 1.05;
        c.font = `${sz}px ${SERIF900}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        chars.forEach((ch, j) => {
          const a = revealOf(p, t)(j);
          if (a <= 0) return;
          const x = W / 2 - wd / 2 + sz * 0.525 + j * sz * 1.05;
          c.save(); c.globalAlpha = a; c.translate(x, 960); c.scale(lerp(1.5, 1, ease.outBack(a, 2)), lerp(1.5, 1, ease.outBack(a, 2)));
          c.fillStyle = PAL.cream; c.strokeStyle = PAL.ver; c.lineWidth = sz * 0.08; c.strokeText(ch, 0, 0); c.fillText(ch, 0, 0); c.restore();
        });
      }
      // the title seal slams onto the moon on the last downbeat
      if (t >= last) {
        const s = ease.outBack(clamp((t - last) / 0.18), 2.2);
        c.save(); c.translate(W / 2, H / 2 - 30 - 170); c.scale(lerp(2.2, 1, s), lerp(2.2, 1, s)); c.globalAlpha = clamp((t - last) / 0.05);
        sealStamp(c, '千本桜', 0, 0, 104); c.restore();
      }
    });
    // into the moon in the last half bar (the interlude's city waits beyond it)
    b.camera((t) => ({ x: 0, zoom: 1 + 0.02 * (t - b.start) + 7 * ease.inExpo(clamp((t - (b.end - 2 * P)) / (2 * P))), fx: W / 2, fy: H / 2 - 30 }));
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(200);
  },
};
