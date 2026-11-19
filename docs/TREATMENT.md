# 千本桜 Senbonzakura

> Where decisions and feedback are recorded (engine repo `docs/新项目流程.md`: beat check → sample → full film; defects:
> `docs/质量验收.md`). Lyrics are referred to by line number and time, never copied here.

## Decided

| Item | Value | Step / version | Date |
|---|---|---|---|
| Spec | Landscape 1920×1080 (4K export), whole song 0:00–4:04 | prep | 2026-10-25 |
| Final export | **1080p, 1 sample per frame** (no motion blur; the user's choice for speed), from draft v2: `out/final/senbonzakura_1080p.mp4` | 3 | 2026-10-25 |
| Render settings (v3, whole project) | **every render, draft or final: 30 fps, 1080p, 1 sample per frame** (the user's choice for render speed; `src/config.ts` FPS = 30, the scripts default to it). Re-run the flash check on every render: without motion blur hard edges flash | 3 | 2026-10-25 |
| Working rule | **quality first, time is not a constraint** (the user): no shortcuts in the worlds; each world compared side by side with the reference before it is shown | 3 | 2026-10-25 |
| Bars and sections | 154.0 BPM, 157 bars; sections in `analysis/analyze.py` SECTION_BARS; beat check approved by the user | 1 | 2026-10-25 |
| Lyrics | Japanese, word-level: `LRC_OFFSET=1.0 python analysis/ja_align.py` (fugashi/UniDic words → cutlet romaji → the repo's CTC aligner, MMS_FA on the vocal stem) then `python analysis/snap_words.py` (VOCALOID: on the 16th grid). **The LRC is 1.0 s early** (every line lands within ±0.4 s of LRC + 1.0; Viterbi −3235 → −2497). Each displayed character appears on its own sung time. The old line-level file: `data/lyrics.linelevel.json` | 1 | 2026-10-26 |
| Look | **sample v5 approved by the user** (`out/sample/senbonzakura_sample_v5.mp4`; its scene code `out/sample/torii.sample-v5.ts.txt`): the standard for the whole film | 2 | 2026-10-26 |
| Tools | **Blender (Cycles) and free CC0 assets allowed** (the user, 2026-10-26: code-only "not necessary … show me what you can do at the best"). Blender scenes are built by Python in `blender/` and rendered by `tools/blender/render.py` into `assets/blender/<shot>/`; `app/src/scenes/tunnel.ts` puts them in the film with the lyric columns and the gold frame | 3 | 2026-10-26 |
| Render budget | Cycles was slower than the user expected (the tunnel interior ~47 s a frame, the forest outside ~115–170 s): **what Cycles has rendered stays (chorus 1's entrance, 56.16–62.39); every shot not started renders a faster way** (the user, 2026-10-26). EEVEE choked on the scanned forest (a rasterizer draws every tree instance for every sample, motion step and shadow map): fine for the tunnel interior, the outside needs a lighter forest or 2.5D layers. Give render estimates from measured times, don't render to measure | 3 | 2026-10-26 |
| Moon | the disc shows in the open-sky shots only (intro, interlude, solo, outro); it never dims: below the treetops it sets behind the hills (`uMoonVis` by camera height). Outro: higher, over the hall; the last frame: low over the far end of the line (moved while out of frame). Default chosen while the user had not decided | 3 | 2026-10-26 |

Later feedback that touches these: say what it affects first, change it once the user agrees.

## Direction v3 (rework, 2026-10-25)

The v2 final (one flight through the torii tunnel) was judged by the user: "basically just tree, shrine and moon". The rework, decided by the user:
**hybrid** (mostly flat graphic Taisho-romance poster scenes, 3D for a few hero moments: the torii tunnel in the choruses), **Miku as code-drawn
silhouettes and details**, **code only** (no image generation; code-only lifted 2026-10-26: Blender and CC0 assets allowed, still no image generation). Benchmark: Bilibili BV16MJY6yEKq (another Claude-made 千本桜 MV, `refs/`): ~35 setups,
124 cuts, lyrics as design. We match its density, not its shots. Engine skill: `.claude/skills/mv-direction`.

Design system: plum night `#1c0f1e → #2b1530`, gold line `#c9a24a / #e8c77a`, sakura `#f2b8c6 / #f7d6de`, vermilion `#c8321e`, cream washi `#efe4cc`,
ink `#120a10`; gold Art Deco linework and frames, family crests, asanoha / seigaiha / yagasuri patterns, washi grain; Noto Serif JP for type;
red seal stamps; lyrics as objects in the world (banners, signs, tags) as well as stamped kinetic type.

**Distinct from the reference** (the user, 2026-10-26: "the reference is just a reference, don't copy everything"). It sets the bar for density
and craft only. Our own devices: one story thread where the lyric can carry it (verse 1: the night's extra edition, from the type case to the
street); lyrics as physical objects in the world (manuscript, metal type, printed sheets, banners, flip boards) rather than overlaid type;
motivated transitions (match cut, tram wipe, whip tilt, petal storm, paper wipe); 3D worlds (the great gate, the tunnel, the city, the
summit, the festival street); the gold Art Deco frame throughout; Miku's silhouette performing. Overlaps found with the reference (2026-10-26),
to rethink before they are built: the theatre stage + diorama (its 1:52–2:02), the aerial city with the tower (its 2:40–2:52), the
line-art-on-cream world (its 3:06), fireworks over the river and river reflections (its 2:20–2:38), ink-branch credits on cream (its 3:56),
the station sign (its 2:54). Already built and close to it: the intro's gas-lamp avenue + tram in gold line art with halftone light (its
0:06–0:10), Miku before the moon and leaping across it (its 0:16, 3:16), the title in a gold moon frame (its 0:02) — kept until the user says.
The board's poster wall (its 0:22) was dropped for the press.

World list (one or more per section, ~20 worlds / 35+ compositions; no world longer than ~20–30 s):

| Song time | Section | World |
|---|---|---|
| 0–7.85 (bars 0–4) | intro **(built)** | black; the gold frame draws itself in from the corners in the silence; the moon ignites on the hit at 1.45 (a ring flies out), the branch and the seigaiha waves sweep in on the band (1.61); 千 本 桜 stamp on the beats of bar 2 (lit ink, a 2 px jolt), the 初音 seal on bar 3 (the riser's end), the credit types in; a slow push in, then into the moon |
| 7.85–14.08 (bars 5–8) | intro **(built)** | a match cut on the moon (same screen place and size, zoom-smeared) pulling back to the skyline; the twelve-storey tower lights floor by floor on the beats from bar 6, a train on the brick viaduct; a slow truck; a tram sweeps across the lens as the wipe (its nose at the frame's left edge on bar 9) |
| 14.08–20.31 (bars 9–12) | intro **(built)** | behind the tram, the gas-lamp avenue: ten lamps light one per beat; passers-by (a gentleman in a bowler and inverness cape, schoolgirls in hakama, a woman with a parasol, a student, a child, a rickshaw), one close to the lens; a tram crosses; the truck; a whip tilt up (0.42 s, smeared) |
| 20.31–26.55 (bars 13–16) | intro **(built)** | the tilt lands on Miku saluting on a roof ridge before a huge moon (its rings turning), the wind in her tails, gusting on the snare roll; a slow dolly in; a crouch, and on bar 16 the leap across the moon (the camera follows up); a petal storm that peaks on the cut |
| 26.55–32.78 (bars 17–20) | intro **(built)** | the great gate (3D): the storm clears over the approach, the 千本桜 plaque, through the gate into the tunnel on verse 1's downbeat |
| 32.78–35.90 | verse 1 **(built)** | **the extra edition, 1**: the composing table from above: line 0 brushed into vermilion-ruled manuscript paper glyph by glyph while each glyph's metal sort lifts out of the type case (mirrored, raised) and lands in the brass composing stick on its sung time; the manuscript stamped 校了, the stick inked by a brayer; window moonlight across the case, the lamp warm on the paper |
| 35.90–38.92 | verse 1 **(built)** | **2**: the press's delivery from above (punched in on the masthead, pulling back): the sheet steps out from under the cylinder one glyph of line 1 at a time, the impression counter rolling; the grippers let go and the run blows up off the press at the lens |
| 38.92–45.25 | verse 1 **(built)** | **3**: the extras scattered over a shallow-focus night street (lamps and lanterns as bokeh, a soft moon): a newsboy with his bell runs across throwing one up on every beat, hands reach up from the crowd; each phrase on its own extra that swings round to face the lens while its glyphs ink in (vermilion → ink; line 3's Latin letters as an extra-wide wood-type headline); the last flies into the lens and turns onto its back |
| 45.25–56.16 | pre 1 **(built)** | the festival street (3D): it opens out of the extra's blank back flying off the lens; Taisho fronts painted in colour (brick, wood, plaster, copper; dark key lines) dressed for the festival — red-and-white kōhaku bunting, paper lanterns along it — with signboards; lantern strings lighting on the beat ahead of the camera; a crowd along both pavements, lit warm, some with lanterns; lines 4–5 rising as nobori banners, each glyph inking in as sung; Miku running ahead; faster and faster, through the great torii into the chorus on the downbeat |
| 56.16–62.39 | chorus 1 **(built, Blender)** | the senbon torii tunnel in Cycles: dense Inari gates (inscribed donors and dates, brushed), wet flagstones, washi lamps, low moon over the valley, ground mist, petals; the camera brakes on the downbeat, the petals hang when the bass drops out (57.01), 千 本 桜 struck in gold as each is sung (57.23 / 57.43 / 58.01), flared on the surge (57.72), burst into petals on the beat (58.50); the camera surges through them down the bending tunnel, a lamp on every second snare |
| 62.39–65.51 | chorus 1 **(built, matte)** | outside at last: the line climbing the mountain through the cedar forest among cherry trees lit from below, the moon over the ridge (`blender/mountain.py`, Poly Haven's scanned firs and jacaranda-as-cherry); one Cycles still lifted into a relief, pushed into with petals falling through it (`matte.ts`) |
| 65.51–67.07 | chorus 1 **(built, card)** | a gold sakura crest slams in on the downbeat and turns, rings out on every beat, the phrase stamped beside it on plum asanoha (`cards.ts`) |
| 67.07–70.19 | chorus 1 **(built, EEVEE)** | low over the petal-strewn flagstones of the dark tunnel: the lamps light one each 16th down the line from the downbeat, all flare on the next |
| 70.19–71.74 | chorus 1 **(built, card)** | a black-lacquer plaque swings in on a vermilion field of gold seigaiha, the phrase in gold |
| 71.74–74.86 | chorus 1 **(built, matte)** | low beside the tunnel's glowing wall: a stone lantern at the lens, the path curving away, cherry trees lit from below, the moon behind the cedars |
| 74.86–79.54 | chorus 1 **(built, EEVEE)** | down the tunnel's last stretch at speed toward its mouth, the moon low and huge in it, the frame blooming into its light |
| 79.54–82.65 | chorus 1 **(built, card)** | the moon ringed by turning crests, the phrase across the foot, the title seal stamped on the last downbeat, the camera diving into the moon (the interlude's city) |
| 83–95 | interlude **(built, 3D)** | the city from above at night (city.ts): thousands of buildings with lit window grids, lamp-lit streets, sakura avenues glowing pink, the river, the loop line with a tram, a slow glide past the twelve-storey tower |
| 95–101 | verse 2 **(built)** | the song on a record (verse2.ts): a gramophone in gold line art, the needle dropping on the downbeat; each sung glyph sends a spark up from the needle and stamps into the column; the horn bursts petals on the downbeats; the last bar pushes into the horn |
| 101–108 | verse 2 **(built)** | Miku cut from asanoha before a gold moon: kimono-pattern panels slide to the next pattern on every downbeat, slam shut on the last beat |
| 108–118 | pre 2 **(built)** | the fox wedding on the ridge path to the shrine (pre2.ts): masked figures in procession, the bride under a red parasol, a foxfire lit on every beat, the lyric in foxfire; a push through the torii before the huge moon |
| 118–145 | chorus 2 **(built, Blender + cards)** | the foxfire tunnel (EEVEE): the title written in blue fire and burst; the line from above as a trail of foxfire (matte); the masked procession in the tunnel; the vortex barrel roll; Inari's cards (the fox mask, the guardians, the fox in the moon) between |
| 145–154 | solo **(built)** | Asakusa's theatre street in the rain (solo.ts): a long truck past neon that strikes on in a wave over the riser and then as each sign comes into view, breathing with the guitar's eighths, flaring on the snares; painted billboards, nobori, passers-by under oiled-paper umbrellas, telegraph poles past the lens; the wet road mirrors it all (ripples, streaks, puddles); searchlights behind the twelve-storey tower lighting floor by floor; the truck settles onto the electric palace, a cinema that switches on from the pavement up |
| 154–162 | solo **(built)** | the cinema closer: bulbs chasing on the eighths, 千本桜 in bulb letters a glyph a beat, the posters (主演 初音ミク; the fox wedding coming soon), a queue under umbrellas, drips off the canopy; a cut on the kick to the canopy close, a tilt up the fanlight, every bulb flaring on the last downbeat, the rise into the clock over the door |
| 162–176 | build **(built)** | inside the clock (clockworks.ts): a match cut on its face, lit from behind with the shadows of the works turning across it; the camera falls through the dial into brass wheels at every depth, the escapement ticking on the snares, petals and dust in the warm light, spiralling as everything doubles its speed every two bars; pulled back out as the hands race to midnight, landing on XII on the downbeat |
| 176–187 | pre 3 **(built)** | a paper crane over the midnight city (pre3.ts): its wings beating on the beats, each phrase inking itself along its wing; the tiled roofs, the river, the skyline with the tower, the moon over the mountain where the lit line of gates zigzags up to the shrine; on the last bar it climbs away toward the shrine |
| 187–200 | chorus 3a **(Blender, EEVEE)** | the quiet chorus in one take: the lamps out, moonlight in stripes through the slits; petals drawn out of the air settle into 千本桜 as it is sung, hang glowing faintly, then peel away over the lens; with the kicks the lamps relight two at a time from the far end toward us and the camera gathers speed into the peak |
| 200–215 | chorus 3 **(Blender + card)** | the peak: low and fast up the lamp-lit tunnel, a front of light racing away on the downbeat, the gold title struck ahead and flown through as it bursts; a card of the film's emblems lighting one an eighth (moon, type sort, lantern, torii, gramophone, fox mask, bulb 桜, clock); the lamps, the foxfire and the petals all at once, weaving; the ascent to the summit's light in the last gate |
| 215–240 | outro **(Blender + cards)** | the summit precinct (a Cycles still lifted into a relief): the approach between stone lanterns and the fox guardians to the hall (nagare-zukuri), its doors glowing, the moon over it; the whole mountain from across the valley, the lit line zigzagging up to the shrine (relief); the credits brushed on the pillars of the last gates like donors' names (EEVEE); the end card: the moon, Miku saluting, 千本桜 stamped on the beats, the 初音 seal on the last hit; black when the band stops dead (239.75), the reverb over black |

## Song

154 BPM, 4/4, constant tempo (kick residual 8.6 ms). Line = 2–4 bars.

| Bars | Section | Energy (1–5) | Notes |
|---|---|---|---|
| 0–21 | intro | 4 | no vocals; 1.5 s of silence, then the full band from 1.61 (bar 1) |
| 21–29 / 61–69 | verse1 / verse2 | 3 | vocal pickup in the bar before |
| 29–36 / 69–76 / 113–120 | pre1 / pre2 / pre3 | 4 | |
| 36–53 / 76–93 | chorus1 / chorus2 | 5 | **bar 36 / 76 / 120: bass and low end drop out for one bar** (the stop bar), the title phrase is sung on it |
| 53–61 | interlude | 4 | full band (loudness as the choruses) |
| 93–104 | solo | 4 | vocals out |
| 104–113 | build | 4 | "other" loudest, vocal chops, no lyric lines |
| 120–128 | chorus3a | 4 | bass out, drums thinned |
| 128–138 | chorus3 | 5 | the peak |
| 138–157 | outro / end | 4→0 | full band to the last hits (238.51, 239.28); **stops dead at 239.75** (bass-out), reverb tail to 244 |

## Direction

**千本鳥居: a moonlit night inside a thousand vermilion torii.** One long flight down an endless gate tunnel through a
cherry grove; the gates are the metronome. Light: moonlight from behind-left (cool, hard shadows of every gate
striped diagonally across the stone path; the disc itself is out of frame: ahead, the stacked beams of the gates hide
any moon but slits), a warm light deep in the tunnel (70 m on) as the vanishing-point focal point, stone lanterns (warm fire, flare on the snare), lit-up cherry trees glowing
pink outside. Petals in the air all the time. Japanese lyrics set vertically (tategaki).

Palette (`app/src/engine/palette.ts`): night `#070912` / `#111628`, torii vermilion `#D9361A`, sakura `#F6A6BE`,
lantern fire `#FFB866`, paper white `#F3EEE4` (lyrics, moon).

Type: lyrics Noto Serif JP 600 (as `NotoSerifSC-*`, subset from the Windows JP fonts:
`python analysis/make_fonts_zh.py C:\Windows\Fonts\NotoSansJP-VF.ttf C:\Windows\Fonts\NotoSerifJP-VF.ttf`); the title
phrase Noto Serif JP 900.

## Look (3D)

Upgraded inside the engine, not Blender (Cycles here: est. 5–30 s/frame → 20–120 h for the song; every revision a re-render). Blender stays an option for a hero shot or two (`tools/blender/` + `library/kit/plate.ts`).
- Moonbeams: `VolLight` (orthographic, depth map from the moon) + `VolPass` (64 steps, 32 m), **only inside the tunnel corridor** (`VolLight.box`, x ±1.25 m, 0–3.4 m, soft 0.5 m — added to this project's `engine/kit3d.ts`): the open night beside it keeps #070912 / #111628; density 0.022 /m (×0.65 in the hold), fbm haze 0.7 at 0.35 /m, Henyey–Greenstein g 0.68, colour (0.6, 0.68, 1.1). Objects with custom vertex shaders, the sky dome and glows are on layer 2 only (the main camera enables it) so they do not occlude the beams.
- Lacquer: MeshPhysicalMaterial, clear coat 0.35 / 0.3 over roughness 0.6, a wood-grain colour map (±5 %) and grain normal map (0.14), reflecting a PMREM night (sky dome, moon, lantern glows; intensity 0.25 — stronger gave cool rings and blue edge strips). Pillar base flush with the black wrap. Hemisphere fill down to 0.35.
- Stone path: bevelled slabs (height drawn with the colour → normal map ×1.0, scale 0.6), roughness 0.74: dark seams, not lit tile lines.
- Ground dressing: 7000 fallen petals lying on the path and gravel, drifts against the pillar bases and along the path edges, lantern-lit (they lie in the gates' shadows).

## Signature features

| Feature | Value | Where |
|---|---|---|
| Gate metronome | gates 2.2 m apart; 0.6 → 0.9 gates per beat into a chorus, 1 per beat in choruses (a gate passes the camera on every beat: phase locked in `travel` from the bar after the surge). **Never above 1.15 a beat**: 2 a beat = 5 passes / s, a strobe that fails the flash check | whole film |
| Stop bar | follows the audio, not the bar line: brake 0.9 → 0.15 gates/beat in 0.2 s on the downbeat (the pre-chorus's last word lands there; zoom punch 2 %, no title yet); title punches (glow ×2.2, scale +6 %, 2-frame attack, 10-frame release, lanterns +80 %, a 1.5 px jolt) on the kick / sub hits before the bass goes; the real freeze at the bar's last `bass_out` (→ 0.03 gates/beat, petal clock ×0.04, lanterns −55 %); a vermilion light sweeps down the title (0.3 s) on the strongest vocal onset in the hold; a 0.5° roll drift through the hold; the camera winds back 0.15 m (ease-in cubic) over the last 0.4 s and is slung forward on the surge; flash only 0.15 | bars 36, 76, 120 |
| Title in the tunnel | the chorus line's first phrase, Noto Serif JP 900, 2.2 m tall, standing between two gates 6–8 m ahead, centre at eye height; **each glyph slams in on its own sung time** (it is sung in the stop bar's frozen half and across the band's return: 千本 57.23, 桜 58.01), white pop ×3.5 and a vermilion flash (τ 0.35 s); it flares ×2.5 with the band; (scale 1.6 → 1, τ 70 ms, glow 6.7 → 1.7); on the first beat ≥ 0.35 s after its last glyph is sung it **bursts into 4500 petals sampled from its own glyphs** (a light hit: paper white ×3.2 → sakura in 0.15 s; 2.5–5.3 m/s outward, drag 1.8/s; the speed toward the lens is solved so the densest layer crosses the camera one beat after the surge; size 0.5–2×, flipping in the moonlight) — 千本桜 becomes the blossom | stop bars |
| Surge | band back in: 0.03 → 1 gate/beat over 0.5 s, fov 45 → 61°, petal clock ×1.8, zoom punch 3.5 %, no flash | bar 37, 77, 121 |
| Lyric columns | vertical, 62 px, right edge, columns 92 px apart right→left, glyphs 45 ms apart, 110 ms ease-out drop of 0.22 em, a 2 px paper-white rule (55 %) drawn beside each column in 350 ms; a line clears (40 px left, 120 ms) before the next starts; bracketed readings dropped; soft elliptical night scrim (50 % → 0) behind the block | every lyric line |
| Lantern flare | fire ×(1 + 1.1·snare pulse) | all |
| Chorus events | a camera move on every second downbeat, each eased over one bar: bar +1 dolly 0.45 m right, +3 drop to 0.62 m (look up, roll swaps) and centre, +5 rise back, +6 dolly 0.4 m left; fov +2.5° on the snare | chorus |
| Gates | ±3 % in size; after the surge the gate passing on each downbeat is 22 % larger (the bar is felt); lacquer tint ±7 %, grime on the top 0.9 m and above the base | all |
| Audio | export filter `volume=-7.3dB` (master −6.7 LUFS → −14) | all |

## Scene table

One timeline entry (`film`, the whole song) and one scene (`scenes/torii.ts`): one continuous flight. `travel(t)` (m down the tunnel) is integrated over the whole song from the gates-per-beat profile, so camera, petals and gates never jump; the camera is on the rail in the tunnel, or lifted out of it (the torii have no roof) by a weight with its own pose.

| Bars | Section | Content | Camera |
|---|---|---|---|
| 0–17 | intro | black until the band's first hit (1.61); the moon flares; over the night cherry forest (varied crowns, dark cedars, three ranges of hills) to the great torii (2.4×, gold plaque 千本桜, two stone lanterns, a warm light) | dive 34 → 11 m over bars 1–4, skimming the treetops with a ±12° bank per 4-bar phrase, down to the gate; onto the rail at bar 17 |
| 17–21 | intro | the approach, through the great gate exactly on verse 1's downbeat | rail, 0.6 gates/beat; a 3° tilt up so the plaque reads whole |
| 21–36 | verse1, pre1 | the tunnel; lyric columns | rail; 0.6 → 0.9 gates/beat over the pre |
| 36–53 | chorus1 | the approved sample: stop bar, title glyphs, burst, chorus moves | rail, 1 gate/beat |
| 53–61 | interlude | lifted out: above the tunnel between the trees, the gates ticking past below | straight crane up (1 bar) to 7 m, 1 gate/beat; straight back down on bar 60 |
| 61–69 | verse2 | **the dark verse**: one lantern in four lit, moonbeams ×1.5, petals ×0.5, blossoms dimmer | rail |
| 69–93 | pre2, chorus2 | the lanterns come back on one by one through pre 2; chorus 2 as chorus 1 | rail |
| 93–113 | solo, build | from the air, the whole line in view: on every bar a front of light races down it at a gate per 16th (lanterns ×4, the vermilion glows); exposure +30 % | straight crane up, orbit 16 m / R 20; in to R 15 on bar 97, out wide and high (R 26, 21 m) on bar 101; the build spirals back down |
| 113–128 | pre3, chorus3a | the quiet chorus: its title drifts up 0.6 m/s and floats away as petals above the lens; lanterns −55 %; the camera slow (0.55 gates/beat) | rail |
| 128–138 | chorus3 | the peak: on its downbeat one front of light lights every lantern ahead within a bar (they stay ×1.8); petals ×2 a chorus, blossoms ×1.4, snare flare ×1.6 | rail, low (0.62 m) all through, 1 gate/beat |
| 138–157 | outro, end | the last gate on bar 140; the moon rises over the summit hall (nagare roof, crossed finials, sacred rope); its four paper lanterns light on the beats of bar 141; tilt up to the moon on bar 142; from bar 147 the crane rises over the hall and turns back: **the whole lit line of gates running to the hills, the moon over them** (last frame); lantern flare + petal gust on the last two hits; **cut to black at 239.75** with the band | rail → crane 30 m up, turning 190° |

## Cues

Registered in `torii.ts` `cues()`: title (chorus downbeat), punches (kick / sub), freeze (bass_out), surge + petal burst (next downbeat), low angle (bar 40) — all within ±17 ms. Check: `render.ts cues` +
`tools/qa/cuecheck.py`.

## Feedback log

| Round | Scope (shot / section / film) | Feedback | Done |
|---|---|---|---|
| tech | film | 2 gates / beat = 5 passes / s fails the flash check; master −6.7 LUFS | gates capped at 1 / beat; `volume=-7.3dB` |
| 评审 R1 (5–6/10) | shot | fly-through glow cut to a grey slab, off the beat (fatal) | title bursts into petals on the surge downbeat |
| 评审 R1 | shot | template 3D: tree cards with straight edges, grey card at the vanishing point, identical gates | trees kept inside their cells; tunnel 154 m + horizon = fog; warm light at the end; gate size / grime variation |
| 评审 R1 | shot | inline bracketed reading; L7→L8 share a column for ~6 frames | readings dropped; a line clears before the next |
| 评审 R1 | shot | stop bar is one flat hold, but the bass only goes at its second half | punches / freeze / sweep / wind-up from the audio events |
| 评审 R1 | section | chorus is one unchanging loop | low angle + roll swap from L8, fov on snares |
| 评审 R1 | shot | moon reads as a ceiling lamp; title bottom cut during the hold; lyric contrast; lanterns clipped white; milky flash | moon out of frame (tried 2.6° and 10°: always cropped by beams); title back and centred; scrim; gold lanterns; flash 0.15 |
| 评审 R2 (6–7/10, no fatal) | shot | the band's return is visually the quietest beat; the burst pours like sand (a preset look) | light hit ×3.2 on the downbeat, outward 2.5–5.3 m/s, the wave crosses the lens on the next beat, petals 0.5–2× flipping |
| 评审 R2 | section | chorus still constant flight | a camera move every second downbeat; the downbeat gate 22 % larger |
| 评审 R2 | shot | neon ring at every pillar base; lyric contrast 3.1:1 over blossom; punches barely read | base ledge removed, lacquer roughness 0.5; scrim 62 % + 1.5 px dark outline; punches ×2 + jolt |
| 评审 R2 | film | the moon (a listed feature) was dropped without asking | **open: the user decides** (moon back somewhere visible, or keep the warm light at the tunnel's end) |
| user (sample v4) | film | "the lyrics appear too early" | the LRC was 1.0 s early and the overlay showed whole phrases: word-level alignment (ja_align + snap_words), every character on its sung time; the title glyphs too, the burst moved to the first beat after the title is read |
| user (sample v4) | film | "the 3D looks vanilla" (asked about Blender MCP) | engine upgrade: moonbeams, clear-coat lacquer + grain, night reflections, bevelled damp stone; Blender kept for later hero shots |
| 评审 R3 (6–7.5/10, no fatal) | film | lyric sync fixed (median −10 ms vs the vocal rises); the 2nd title glyph ~100 ms late | glyphs inside a word sit on its vocal onsets, snapped to the 16th |
| 评审 R3 | film | the haze lifted the night to lavender dusk (beside the tunnel RGB 103,109,142 vs 62,53,71) | moonbeams limited to the tunnel corridor (VolLight.box) |
| 评审 R3 | film | bevels as lit tile lines; still template 3D: empty ground; cool rings; grey slab flash; small title | matte bevels; fallen petals on the ground; clear coat / reflections down, flush base; no frame flash, gentler glyph pop; title back to ~45 % (closer + fov −7° in the stop) |
| 评审 R3 | section | chorus moves too subtle | dollies 0.7 / 0.65 m, a quarter roll (5°) on bar +2 |
| user | film | sample v5 accepted: "progress to the next step" | step 3: the whole film as one scene (see Scene table) |
| 评审 R4 (draft v1, 5–7/10) | film | the open sky reads as generated: one stamped 5-lobe crown, flat grey ground, one flat hill band, a box hall | crowns: 4 ragged outlines (3–7 lobes) + a cedar in four, tinted per tree, jittered grid; ground: moss / petal drifts; hills in three hazy ranges; thinner fog in the open; a nagare-zukuri hall with finials, logs, rope, tall lanterns |
| 评审 R4 | film | gates missing from the air; the moon fades to a grey disc; neon stripes on the kasagi from above; the crane grazes a beam (83.7, 94, 146) | 420 gates / 140 lantern pairs from the air, the path ends at the hall; the moon sets behind the hills; the clear coat goes matte from the air; straight cranes, the rail stands still mid-gap while the camera crosses the beams |
| 评审 R4 | film | the instrumentals (intro, interlude, solo, outro) are full band but the stillest shots; the outro plays a fade | see the scene table: dive + skim, tracking crane, fronts of light + orbit changes, the arrival and the look back, a cut on the band's stop |
| 评审 R4 | section | verse 2 / chorus 3a / chorus 3 repeat verse 1 / chorus 1 | dark verse 2, rising quiet title, the peak's lantern chase and low ride |
| 评审 R4 | shot | the 2nd title glyph drifts (0.20 / 0.42 / 0.39 s after the 1st); the plaque cut at 28.5 | every chorus uses chorus 1's glyph timing with the 2nd on the vocal jump (+0.12 s); the plaque hangs in front of the beams + a 3° tilt |
| 评审 R4 | film | not done (scope): pre-chorus 3 climbing steps / a curving tunnel, rolling terrain, 1.15 gates/beat in chorus 3 (the flash cap) | — |
| tech (final, 1 sample) | section | flash check failed top-left at 199.7 / 207.9 s (4 / s): in chorus 3 the low camera sat 0.65 m left (the chorus 3a dolly), the pillars and lit lanterns swept the corner; without motion blur each pass is a hard flash | the peak rides centred; its blossom boost ×1.4 → ×1.15; chunks 192–216 s re-rendered |
| board batch 1 (v3) | film | 8 stills, one per world: title card, moonlit skyline, Miku on the rooftop, the festival street (×2), the 3D tunnel with the gold frame, fireworks over the river, ink on washi (`out/board/board_batch1.jpg`); self-review fixed: Miku redrawn with curves and an outer glow (was stiff polygons), a real sakura tree drawer, the street moon's square halo, the purple floor past the street, polka-dot roof tiles | user: "it looks fine"; Miku may stay unpolished (an image model may come later as a plugin) |
| board batch 2 (v3) | film | 14 more stills (gas-lamp avenue + tram, the great gate, poster wall, extra-edition handbills, city as a gold map, station + flip board, kimono pattern, theatre, paper diorama, clock gears, rooftop leap, triptych montage, summit, credits scroll); the full board in song order: `out/board/world_board.jpg` (22 worlds). Self-review fixed: an empty poster wall, yagasuri that read as stripes, a flat map tower, a small diorama, the montage seal over Miku, the scroll's branch over the title, a blob locomotive | waiting for the user |
| intro v1 (v3) | section | the intro animated (`out/intro/intro_v1.mp4`, 30 fps, 1080p, 1 sample; all checks pass): poster scene camera (truck / zoom / dolly by depth, screen shifts, smear), match cut, tram wipe, whip tilt, petal storm cut; worlds cut on the 4-bar downbeats | waiting for the user |
| user (intro v1) | shot | "on 00:19 the sakura tree has been cut into half" | the avenue's near tree was drawn on a frame-wide canvas; the camera's truck slid the canvas edge into view (a straight cut through the crown). Its canvas now runs 600 px past both sides, the skies are padded too; poster.ts checks every layer at init (content touching its canvas edge that the camera brings into the frame → a SCENE ERRORS warning) and found the same flaw in roofrun (fixed) |
| user (intro v1) | shot | "the house looks vanilla" (0:14–0:20); asked how the reference did it | the reference draws its streets as flat line-art elevations (near-black masses, every member traced in pale gold, flat gold lit windows, lamp light as halftone dots, a dot screen over the night): print graphics, not Blender. New `scenes/taisho-arch.ts`: an elevation generator in that language (bank, shop, mansard, stepped gable, clock tower, dome, machiya; cornices, dentils, pilasters, keystones, balustrades, dormers; signs right to left as in period signage), halftone lamp light in separate pools, lamp reflections on the wet road, the crowd traced in gold with paper lanterns, lamps and the tram redrawn in line art. To do: the festival street (pre 1) still uses the old flat facades: redo in this language when it is animated |
| user | film | "the reference is just a reference, you shouldn't copy everything" | the poster wall (the reference has one at 0:22) replaced by the press; verse 1 told as one story (the extra edition); the festival street painted in colour, not the reference's gold line art; overlaps listed above for the worlds still to build |
| verse 1 + pre 1 v1 (v3) | section | built: press (2 shots), gougai, festival street; continuous render 0–58.5 (`out/section/sec1_v1.mp4`, all checks pass, 0 missing glyphs) | waiting for the user |
| user | film | lifted code-only: "show me what you can do at the best" (Blender MCP); then, Cycles too slow: "for those haven't start, move to a faster way" | chorus 1's entrance stays Cycles; inside shots EEVEE (`blender/eevee.py`), outside shots a Cycles still + depth lifted into a relief (`blender/matte.py`, `scenes/matte.ts`), cards in the engine |
| user (chorus 1, Blender) | section | "yeah it is fine. now work through the whole project" | built the rest at that level (rows above): verse 2, pre 2, chorus 2 (foxfire tunnel, EEVEE + matte + cards), solo (neon street, cinema), build (clockworks, match cut on the cinema's clock), pre 3 (paper crane; the rooftop leap dropped: it repeated the intro and the reference's 3:16), chorus 3a (petal title, EEVEE), chorus 3 (peak, emblem card, spirits, ascent), outro (summit precinct and the mountain as reliefs with lights run over them, credits on the last gates, the end card) |
| self-review (solo) | section | the neon street's first render: thin black poles reading as lines (one cut the Café sign), regular zigzag ripples on the wet road, hard-edged searchlights, two signs never struck | poles shaded round with a neon rim each side, spaced to frame the cinema at the end; ripples from noise plus dry patches between puddles sliding with the road; three nested wedges a beam; signs strike nearer the frame's edge |
| self-review (chorus 3a) | shot | the petal title dispersed as a box of petals; the tunnel lost in a flat haze | each petal lets go at its own time, the top glyph first; less haze, more moon, finer froxels (the moonlight shows as stripes on the stones) |
