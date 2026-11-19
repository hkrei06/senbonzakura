// Pre-chorus 2 (lines 14–15): the fox wedding (狐の嫁入り), on the way to the shrine. Fox-masked figures walk a ridge
// path under the moon in procession (dark kimono, the masks white and glowing, paper lanterns on poles; the bride in
// white under a red parasol); foxfires (狐火) light one more along the path on every beat; the lyric is written in
// foxfire over them, each glyph catching as it is sung. Ahead on the ridge a torii stands against the huge moon; over
// the last bar the camera pushes through its opening (chorus 2's tunnel cuts in on the downbeat).
import type { Build } from './poster';
import type { Phrase } from './torii';
import { drawColumn } from './torii';
import { W, H } from '../engine/gl';
import { clamp, ease, hash, lerp } from '../engine/util';
import { PAL, SERIF900, layer, decoFrame, moonDisc } from './taisho';
import { nightSky } from './worlds';

type C = CanvasRenderingContext2D;

function phraseAt(ph: Phrase[], t: number) { let p: Phrase | undefined; for (const x of ph) if (x.t <= t + 0.05) p = x; return p; }
const revealOf = (p: Phrase, t: number) => (j: number) => clamp((t - p.ct[j]!) / 0.09);
const beatsIn = (b: Build, t: number) => b.audio.beatAt(t) - b.audio.beatAt(b.start);

const PW = 4200; // the procession's world: a long ridge the camera trucks along
const RIDGE = (x: number) => 790 - 70 * Math.sin(x / 900) - 30 * Math.sin(x / 310 + 1.3); // the path's height
const TORII_X = 2300; // the torii on the ridge: against the moon when the camera's truck ends

/** One walker of the procession in profile facing right: a fox mask, kimono, a lantern on a pole or (the bride) a
 *  white hood under a red parasol. h = height (px), ph = the walk's phase. */
function foxFigure(c: C, x: number, y: number, h: number, ph: number, o: { lantern?: boolean; bride?: boolean; parasol?: boolean } = {}) {
  const u = h / 100;
  c.save();
  c.translate(x, y - Math.abs(Math.sin(ph)) * 1.2 * u); c.scale(u, u);
  const robe = o.bride ? '#ece4d6' : PAL.ink;
  // the robe: shoulders to hem, the hem swinging with the step
  const sw = Math.sin(ph) * 3;
  c.fillStyle = robe; c.beginPath();
  c.moveTo(-9, -80); c.quadraticCurveTo(-15, -40, -17 + sw, 0); c.lineTo(15 + sw, 0); c.quadraticCurveTo(13, -40, 10, -80); c.closePath(); c.fill();
  // the long sleeve hanging forward, the obi
  c.beginPath(); c.moveTo(2, -76); c.quadraticCurveTo(22, -62, 18, -40); c.lineTo(6, -42); c.closePath(); c.fill();
  c.fillStyle = o.bride ? '#c8a96a' : '#3a1d3c'; c.fillRect(-12, -58, 24, 7);
  // feet in step
  c.fillStyle = PAL.ink; for (const sd of [1, -1]) c.fillRect(-4 + sd * Math.sin(ph) * 6, -2, 9, 3);
  // the head: a fox mask in profile (snout to the right, ears up), white with vermilion markings
  c.save(); c.translate(0, -90);
  if (o.bride) { c.fillStyle = '#f4efe6'; c.beginPath(); c.ellipse(-1, -2, 12, 13, 0, 0, Math.PI * 2); c.fill(); } // the hood
  c.fillStyle = '#f6efe2';
  c.beginPath(); c.moveTo(-8, 6); c.quadraticCurveTo(-10, -6, -4, -9); c.lineTo(-6, -20); c.lineTo(1, -10); c.lineTo(5, -19); c.lineTo(6, -8);
  c.quadraticCurveTo(15, -4, 19, 2); c.quadraticCurveTo(10, 6, -8, 6); c.closePath(); c.fill();
  c.strokeStyle = PAL.ver; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(2, -5); c.quadraticCurveTo(8, -6, 11, -3); c.stroke(); // the eye's sweep
  c.beginPath(); c.moveTo(-3, -12); c.lineTo(-4, -17); c.moveTo(4, -11); c.lineTo(5, -16); c.stroke(); // inside the ears
  c.fillStyle = PAL.ink; c.beginPath(); c.arc(18, 1.5, 1.6, 0, Math.PI * 2); c.fill(); // the nose
  c.restore();
  if (o.lantern) { // a paper lantern on a pole, held forward, swinging
    const sx = Math.sin(ph * 0.5) * 3;
    c.strokeStyle = PAL.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(14, -48); c.lineTo(40, -112); c.lineTo(58, -112); c.stroke();
    c.beginPath(); c.moveTo(58, -112); c.lineTo(58 + sx, -100); c.stroke();
    const g = c.createRadialGradient(58 + sx, -88, 2, 58 + sx, -88, 30);
    g.addColorStop(0, 'rgba(255,214,140,0.55)'); g.addColorStop(1, 'rgba(255,214,140,0)');
    c.fillStyle = g; c.beginPath(); c.arc(58 + sx, -88, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffcf7a'; c.beginPath(); c.ellipse(58 + sx, -88, 8, 11, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = PAL.ver; c.fillRect(52 + sx, -100, 12, 2.5); c.fillRect(52 + sx, -78, 12, 2.5);
  }
  if (o.parasol) { // the red wedding parasol held over the bride (by the walker in front)
    c.strokeStyle = PAL.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(10, -60); c.lineTo(-18, -128); c.stroke();
    c.fillStyle = PAL.ver; c.beginPath(); c.moveTo(-70, -118); c.quadraticCurveTo(-18, -160, 34, -118); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(18,10,16,0.5)'; c.lineWidth = 1.2;
    for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(-18, -142); c.lineTo(-18 + k * 17, -120); c.stroke(); }
  }
  c.restore();
}

/** A foxfire: a teardrop of pale blue fire, flickering (additive). */
function foxfire(c: C, x: number, y: number, r: number, t: number, seed: number) {
  const fl = 1 + 0.15 * Math.sin(t * 11 + seed * 7) + 0.1 * Math.sin(t * 17.3 + seed);
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r * 3.2 * fl);
  g.addColorStop(0, 'rgba(200,240,255,0.75)'); g.addColorStop(0.4, 'rgba(110,190,255,0.28)'); g.addColorStop(1, 'rgba(80,140,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3.2 * fl, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(235,250,255,0.9)';
  c.beginPath(); c.moveTo(x, y - r * 1.9 * fl); c.quadraticCurveTo(x + r * 1.05, y - r * 0.2, x, y + r * 0.85); c.quadraticCurveTo(x - r * 1.05, y - r * 0.2, x, y - r * 1.9 * fl); c.fill();
  c.restore();
}

export const PRE2: Record<string, (b: Build) => void> = {
  foxwed(b) {
    const PB = b.audio.periodAt(b.start), last = b.end - 4 * PB; // the last bar: through the torii
    // the sky and the moon (behind everything, barely moving); the moon stands over the torii's place
    b.add(layer(W, H, (c, r) => { nightSky(c, r, '#3e1f3f', 520, 0.75); }, 1101)); // (nightSky paints W wide: the sky stays put)
    b.add(layer(2000, 2000, (c, r) => moonDisc(c, 1000, 1000, 300, r), 1102), { px: -680, py: -540, drift: 0.12 }); // (wide: the halo fades inside it)
    // far hills, two ranges, plum and darker
    b.add(layer(PW, H, (c) => {
      for (const [y0, amp, col, f] of [[640, 90, '#2a1430', 0.0011], [720, 60, '#1d0e22', 0.0019]] as const) {
        c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= PW; x += 20) c.lineTo(x, y0 - amp * Math.sin(x * f) - amp * 0.4 * Math.sin(x * f * 3.1 + 2));
        c.lineTo(PW, H); c.closePath(); c.fill();
      }
    }, 1103), { px: 300, drift: 0.35 });
    // the ridge with its path, grasses, and the torii against the moon
    b.add(layer(PW, H, (c) => {
      c.fillStyle = '#120a12'; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= PW; x += 10) c.lineTo(x, RIDGE(x));
      c.lineTo(PW, H); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(201,162,74,0.35)'; c.lineWidth = 2; c.beginPath();
      for (let x = 0; x <= PW; x += 10) { if (x) c.lineTo(x, RIDGE(x)); else c.moveTo(x, RIDGE(x)); }
      c.stroke();
      for (let i = 0; i < 900; i++) { // grass blades along the ridge
        const x = hash(i, 1) * PW, y = RIDGE(x) + 2, hh = 8 + 26 * hash(i, 2);
        c.strokeStyle = '#120a12'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 6, y - hh * 0.6, x + 10 * (hash(i, 3) - 0.3), y - hh); c.stroke();
      }
      // the torii
      const tx = TORII_X, ty = RIDGE(TORII_X);
      c.fillStyle = PAL.ver;
      for (const sx of [-1, 1]) c.fillRect(tx + sx * 120 - 14, ty - 330, 28, 330);
      c.fillRect(tx - 160, ty - 285, 320, 20);
      c.fillStyle = PAL.ink; c.beginPath(); c.moveTo(tx - 200, ty - 318); c.quadraticCurveTo(tx, ty - 330, tx + 200, ty - 318); c.lineTo(tx + 190, ty - 350); c.quadraticCurveTo(tx, ty - 358, tx - 190, ty - 350); c.closePath(); c.fill();
      c.fillStyle = PAL.ver; c.fillRect(tx - 170, ty - 318, 340, 14);
      c.strokeStyle = PAL.gold; c.lineWidth = 2; c.strokeRect(tx - 160, ty - 285, 320, 20);
    }, 1104), { drift: 1 });
    // the procession (walking right along the path), the foxfires, the lyric in foxfire
    const N = 14;
    b.dyn((c, t, lt) => {
      for (let i = 0; i < N; i++) {
        const x = -200 + i * 142 + lt * 58 + (i > 6 ? 40 : 0), ph = lt * 5.2 + i * 1.7; // the leader reaches the torii on the last bar
        const bride = i === 7, parasol = i === 8;
        foxFigure(c, x, RIDGE(x) + 4, bride ? 150 : 145 + 10 * hash(i, 5), ph, { lantern: !bride && !parasol && i % 2 === 0, bride, parasol });
      }
      // foxfires: one more lit on every beat, bobbing above the path ahead of and around the procession
      const nb = Math.floor(beatsIn(b, t)) + 1;
      for (let k = 0; k < nb; k++) {
        const fx = 200 + k * 118 + 40 * Math.sin(k * 2.1), age = beatsIn(b, t) - k;
        const fy = RIDGE(fx) - 150 - 70 * hash(k, 9) + 14 * Math.sin(t * 1.6 + k);
        foxfire(c, fx + 10 * Math.sin(t * 0.9 + k), fy - 30, 14 * Math.min(1, 0.3 + age * 2), t, k);
      }
    }, { p: 1 });
    // the phrase written in foxfire, upper left, held in screen space
    b.dyn((c, t) => {
      const p = phraseAt(b.phrases, t);
      if (!p) return;
      const n = [...p.text].length, size = Math.min(96, 620 / (n * 1.06));
      c.save();
      c.font = `${size}px ${SERIF900}`;
      c.shadowColor = 'rgba(120,200,255,0.95)'; c.shadowBlur = 24;
      c.fillStyle = 'rgba(225,245,255,0.96)';
      drawColumn(c, p.text, 230, 130, size, (j) => ease.outCubic(revealOf(p, t)(j)) * (0.85 + 0.15 * Math.sin(t * 13 + j)));
      c.restore();
    }, { p: -1 });
    // truck along with the procession; over the last bar push through the torii's opening
    b.camera((t, lt) => {
      const push = ease.inExpo(clamp((t - last) / (b.end - last)));
      const x = lt * 70, tx = TORII_X - x, ty = RIDGE(TORII_X) - 245; // the opening's upper part: the moon behind it
      return { x, zoom: (1 + 0.01 * lt) * (1 + 9 * push), fx: lerp(W / 2, tx, clamp((t - last + 2 * PB) / (2 * PB))), fy: lerp(H / 2, ty, clamp((t - last + 2 * PB) / (2 * PB))) };
    });
    b.overlay((c) => decoFrame(c, W, H));
    b.petals(40, { p: 1.2 });
  },
};
