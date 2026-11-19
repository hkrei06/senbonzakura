// 剪辑表：哪个场景模块在哪段歌曲时间里（歌曲秒）。场景文件放在 src/scenes/<name>.ts，默认导出 Scene 子类。
// 窗口首尾相接就是硬切；重叠就是转场（默认交叉淡化，场景设 handlesTransition 可自己合成）。
// 时间尽量从数据推出来（lyrics.get(...).start、audio.timeOfBar(k)），少写死数字。
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

// src/library/scenes/ 是效果库（只在基础引擎里有）；从效果库按原路径复制过来的场景也能直接用名字载入
const modules = import.meta.glob<{ default: SceneClass }>(['./scenes/*.ts', './library/scenes/*.ts']);
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`] ?? modules[`./library/scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};
// 效果库的示例入口（?ref= ?sfx= ?sky ?voxel，src/library/demos.ts）；新项目没有这个文件，这里什么都不做
type Entry = (id: string, file: string, start: number, end: number, extra?: Partial<TimelineEntry>) => TimelineEntry;
type Demos = { demos: (E: Entry, au: AudioData) => TimelineEntry[] | null };
const library = Object.values(import.meta.glob<Demos>('./library/demos.ts', { eager: true }))[0];

export function makeTimeline(_ly: Lyrics, au: AudioData): TimelineEntry[] {
  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });
  const demo = library?.demos(E, au);
  if (demo) return demo;
  // Direction v3 (docs/TREATMENT.md): the world board, batch 1 — each world in its planned slot, one still each.
  // (v2, the single flight: E('film', 'torii', 0, au.duration, { params: { fade: true } }); its final is out/final/.)
  const S = (n: string) => au.sections.find((s) => s.name === n)!;
  const W = (id: string, a: number, b: number) => E(id, 'poster', a, b, { params: { world: id } });
  const v1 = S('verse1').start, l2 = _ly.lines[2]!.start, v2 = S('verse2').start, l12 = _ly.lines[12]!.start;
  const c1 = (k: number) => au.timeOfBar(Math.round(au.barAt(S('chorus1').start)) + k); // chorus 1's bars
  const Wc = (id: string, a: number, b: number) => E(id, 'poster', a, b, { params: { world: id, carry: true } }); // a card mid-line
  const c2 = (k: number) => au.timeOfBar(Math.round(au.barAt(S('chorus2').start)) + k); // chorus 2's bars
  const c3 = (k: number) => au.timeOfBar(Math.round(au.barAt(S('chorus3').start)) + k); // chorus 3's bars
  const o = (k: number) => au.timeOfBar(Math.round(au.barAt(S('outro').start)) + k); // the outro's
  const stop = au.ev.in(au.duration - 6, au.duration, 'bass_out').pop()?.t ?? S('outro').end; // the band stops dead
  return [
    // the intro: four poster worlds of four bars each, cut on the phrase downbeats, then the great gate (3D) from bar 17
    W('title', 0, au.timeOfBar(5)), W('skyline', au.timeOfBar(5), au.timeOfBar(9)), W('avenue', au.timeOfBar(9), au.timeOfBar(13)), W('rooftop', au.timeOfBar(13), au.timeOfBar(17)),
    E('gate', 'torii', au.timeOfBar(17), v1, { params: { fade: true, deco: true, gust: au.timeOfBar(17) } }),
    W('press', v1, l2), W('gougai', l2, S('pre1').start), // verse 1: the night's extra edition, printed and scattered (verse1.ts)
    E('street', 'street', S('pre1').start, S('pre1').end, { params: { section: 'pre1' } }),
    // chorus 1 (docs/TREATMENT.md): the senbon torii tunnel from Blender (blender/shots_chorus.py: the entrance in Cycles,
    // the lamp wave and the exit in EEVEE), two outside shots as Cycles stills lifted into reliefs (matte.ts), graphic
    // cards between them (cards.ts)
    E('tunnel', 'tunnel', S('chorus1').start, c1(4), { params: { shot: 'tunnel_entry', title: true } }),
    // outside: the line climbing the mountain to the moon, a Cycles still lifted into a relief (matte.ts) and pushed into
    E('reveal', 'matte', c1(4), c1(6), { params: { matte: 'reveal', move: { dolly: 4, rise: 1.5, tilt: 1.2, zoom: 1.1 }, exposure: 1.25, carry: true } }),
    Wc('card_crest', c1(6), c1(7)), // graphic cards between the 3D shots (cards.ts)
    E('lampwave', 'tunnel', c1(7), c1(9), { params: { shot: 'tunnel_lampwave', carry: true } }), // the lamps light down the line (EEVEE)
    Wc('card_plaque', c1(9), c1(10)),
    E('wall', 'matte', c1(10), c1(12), { params: { matte: 'wall', move: { dolly: 0.4, rise: 0.05, zoom: 1.07 }, exposure: 1.15, petals: [24, 220], carry: true } }),
    E('exit', 'tunnel', c1(12), c1(15), { params: { shot: 'tunnel_exit', carry: true } }), // to the mouth and the moon (EEVEE)
    Wc('card_finale', c1(15), S('interlude').start),
    // the city in 3D (it was the flat map W('citymap', …), worlds.ts)
    E('city', 'city', S('interlude').start, v2),
    W('record', v2, au.timeOfBar(Math.round(au.barAt(v2)) + 4)), W('kimono', au.timeOfBar(Math.round(au.barAt(v2)) + 4), S('pre2').start), // verse 2: the song on a record, then the kimono (verse2.ts)
    W('foxwed', S('pre2').start, S('chorus2').start), // pre 2: the fox wedding on the way to the shrine (pre2.ts) 
    // chorus 2: the foxfire tunnel (blender/foxfire.py; EEVEE) — the title written in blue fire, the line from above as a
    // trail of foxfire, the procession in the tunnel, the vortex — with Inari's cards between
    E('foxtitle', 'tunnel', c2(0), c2(4), { params: { shot: 'fox_title', title: true } }),
    E('foxline', 'matte', c2(4), c2(6), { params: { matte: 'foxline', move: { dolly: 5, rise: -1.2, tilt: -1.2, zoom: 1.08 }, exposure: 1.3, petals: [16, 160], carry: true } }),
    Wc('card_fox', c2(6), c2(7)),
    E('procession', 'tunnel', c2(7), c2(9), { params: { shot: 'fox_procession', carry: true } }),
    Wc('card_guardians', c2(9), c2(10)),
    E('vortex', 'tunnel', c2(10), c2(13), { params: { shot: 'fox_vortex', carry: true } }),
    Wc('card_foxmoon', c2(13), S('solo').start),
    W('neon', S('solo').start, au.timeOfBar(Math.round(au.barAt(S('solo').start)) + 6)), W('marquee', au.timeOfBar(Math.round(au.barAt(S('solo').start)) + 6), S('build').start), // the solo: the neon street in the rain, the cinema (solo.ts)
    W('clockworks', S('build').start, S('pre3').start), // the build: through the clock's dial into its works, to midnight (clockworks.ts)
    W('crane', S('pre3').start, S('chorus3a').start), // pre 3: a paper crane over the midnight city to the mountain (pre3.ts)
    // the last choruses in the tunnel (blender/shots_chorus.py, EEVEE): the quiet chorus by moonlight, its title written
    // in petals; the peak: the lamps and the gold title flown through, the film's emblems, the lamps and the foxfire
    // together, the ascent to the summit
    E('quiet', 'tunnel', S('chorus3a').start, S('chorus3').start, { params: { shot: 'quiet', title: true } }),
    E('peak', 'tunnel', c3(0), c3(3), { params: { shot: 'peak', title: true } }),
    Wc('card_mosaic', c3(3), c3(4)),
    E('spirits', 'tunnel', c3(4), c3(8), { params: { shot: 'spirits', carry: true } }),
    E('ascent', 'tunnel', c3(8), S('outro').start, { params: { shot: 'ascent', carry: true } }),
    // the outro: the summit, then the whole mountain from across the valley (Cycles stills lifted into reliefs), the
    // credits on the last gates, the end card; black from the band's dead stop to the end of the reverb
    E('summit', 'matte', o(0), o(4), { params: { matte: 'summit', move: { dolly: 1.0, rise: 0.3, tilt: 1.0, zoom: 1.12 }, exposure: 1.2, petals: [30, 240], run: 'pulse' } }),
    E('finale', 'matte', o(4), o(8), { params: { matte: 'finale', move: { dolly: 8, rise: 3, tilt: -0.8, zoom: 1.1 }, exposure: 1.3, petals: [12, 120], run: true } }),
    E('credits', 'tunnel', o(8), o(14), { params: { shot: 'credits', captions: [ // as the gates carrying them pass (blender/make_credits.py)
      ['楽曲', '千本桜　黒うさP feat. 初音ミク'], ['映像', 'xm-video-engine (XIAOMING6680)'], ['原典', 'pdoom-video — Giacomo Magnanini'],
      ['立体', 'Blender — Blender Foundation'], ['素材', 'Poly Haven (CC0)'], ['書体', 'Noto · Yuji Syuku · Cormorant · Archivo'],
      ['解析', 'audio-separator · torchaudio MMS'], ['', '非営利の二次創作'],
    ] } }),
    W('card_end', o(14), stop),
    W('card_fin', stop, au.duration), // 終 over the reverb
  ];
}
