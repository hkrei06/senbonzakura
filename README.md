# 千本桜 Senbonzakura — a code-made fan MV

An unofficial, non-commercial music video for **千本桜 (Senbonzakura)** by 黒うさP (WhiteFlame) feat. 初音ミク.
Every frame comes from code: three.js / WebGL shaders and Canvas2D scenes in the browser, plus Blender scenes
built entirely from Python. There is no stock footage and no AI-generated imagery.

Built on [小铭的视频基础引擎 / xm-video-engine](https://github.com/xiaoming6680) (MIT).

## Watch

**▶ Video: _link coming soon_**

The finished video is **not stored in this repository**. Each render is 1–3 GB, which is too big for Git, and it
contains the song, which isn't mine to redistribute. Watch it at the link above.

## What is (and isn't) in this repo

| Included | Not included (and why) |
|---|---|
| All scene code (`app/src/scenes/`), the renderer (`app/scripts/`) | **The song audio.** It belongs to its owners; bring your own copy |
| Blender set and shot scripts (`blender/`) | **Rendered Blender frames** (`assets/blender/`, ~4 GB): rebuild them with the scripts |
| Song analysis: beats, sections, sound events, lyric timing (`data/`) | **Downloaded CC0 models / textures and fonts** (`blender/models`, `tex`, `fonts`): `blender/fetch_assets.py` fetches them |
| Fonts used by the app (`app/public/fonts`, SIL OFL) | **Finished videos and drafts** (`out/`) |
| Design notes and decisions (`docs/TREATMENT.md`) | **Reference videos** (`refs/`): other people's work, used only locally for comparison |

## Rebuilding the video yourself

Be warned: this takes a lot of work. The Blender shots take many hours on a single GPU.

**You need:** [Bun](https://bun.sh), Microsoft Edge or Chrome (the renderer drives it headlessly),
[ffmpeg](https://ffmpeg.org) on `PATH`, [Blender 5.2](https://www.blender.org), and Python 3.

1. **Add the song.** Put your own copy at `audio/song.wav`. The timing data in `data/` was made from the
   full-length original release (4:04), so a different edit will be out of sync.
2. **Fetch the 3D assets** (Poly Haven CC0 and Google Fonts OFL, all free):
   ```sh
   python blender/fetch_assets.py
   python blender/make_inscriptions.py
   python blender/make_credits.py
   ```
3. **Render the Blender shots** into `assets/blender/`, one shot at a time.
   These commands use `tools/blender/render.py` and `blender/matte.py`:
   ```sh
   # frame-by-frame shots: tunnel_entry tunnel_lampwave tunnel_exit fox_title fox_procession fox_vortex
   #                       quiet peak spirits ascent credits
   blender -b --factory-startup -P tools/blender/render.py -- --shots shots_chorus --shot tunnel_entry
   # 2.5D matte stills: reveal foxline wall summit finale
   blender -b --factory-startup -P blender/matte.py -- --matte reveal
   ```
   Finished frames are skipped, so a render can be stopped and resumed.
4. **Preview in the browser:**
   ```sh
   cd app
   bun install
   bunx vite
   ```
5. **Render the video:**
   ```sh
   cd app
   bun scripts/render.ts video --out ../out/film/senbonzakura.mp4
   ```
   The default is 1080p at 30 fps. Run `bun scripts/render.ts` with no mode to see the other options in the
   header of `app/scripts/render.ts`.

The analysis scripts (`analysis/`) and the audio and voice tools (`tools/audio/`, `tts/`) are only needed to
re-time the film to a song. They expect the base engine checked out next to this folder
(`../xm-video-engine-main`), or its path in the `XM_ENGINE` environment variable.

## Layout

```
app/        the film: scenes, engine library, renderer (Bun + Vite + three.js)
blender/    Blender sets and shots, built from Python
analysis/   beat, section and lyric-timing analysis of the song
data/       the analysis results the film reads
tools/      QA, asset and audio helpers from the base engine
docs/       TREATMENT.md: the direction and every decision
```

## Rights

- **Music, lyrics and vocal:** 千本桜 by 黒うさP (WhiteFlame) feat. 初音ミク. All rights belong to their owners.
  This is an unofficial, non-commercial fan work. It is not affiliated with or endorsed by the creators,
  Crypton Future Media, or any label.
- **Engine:** MIT, see [`LICENSE.engine`](LICENSE.engine).
- **Fonts, textures, models and analysis models:** see [`CREDITS.md`](CREDITS.md). The lyric-alignment model
  weights are CC BY-NC 4.0, one more reason this project is non-commercial only.

If you are a rights holder and want something changed or removed, please open an issue.
