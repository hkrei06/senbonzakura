# CREDITS — 千本桜 (Senbonzakura) MV

## Music
千本桜 — 黒うさP (WhiteFlame) feat. 初音ミク. All rights to the song, its lyrics and the vocal belong to their owners.
This video is an unofficial, non-commercial fan work; the lyrics shown come from the song.

## Engine
- 小铭的视频基础引擎 / xm-video-engine — XIAOMING6680, MIT (`LICENSE.engine`)
- Engine core from mexicat/pdoom-video — Giacomo Magnanini, MIT
- three.js — MIT

## Fonts (SIL Open Font License)
- Noto Serif JP, Noto Sans JP (subset into `app/public/fonts/Noto*SC-*.ttf`)
- Cormorant Garamond, Archivo, IBM Plex Mono
- Yuji Syuku — Kinuta Font Factory (the brushed donors' inscriptions on the tunnel's torii, `blender/make_inscriptions.py`,
  and the film's own credits on the last gates, `blender/make_credits.py`, with Cormorant for their Latin names)

## Analysis (used for timing only; nothing of these models appears in the video)
- Vocal / stem separation: audio-separator (MIT) with MDX Kim_Vocal_2 and htdemucs_ft (MIT)
- Lyric alignment: torchaudio MMS_FA (weights CC-BY-NC 4.0 — fine for this non-commercial work; see the engine's
  `docs/模型选型.md` before any paid use), fugashi (MIT) with UniDic-lite (BSD), cutlet (MIT)

## 3D (Blender)
- Blender 5.2 (Cycles, EEVEE) — Blender Foundation, GPL (the software; renders are ours). The torii tunnel set, its
  petals, title and trees, the foxfire, and the summit's shrine precinct (its hall, lanterns and fox guardians) are built
  by code (`blender/tunnel_set.py`, `tunnel_fx.py`, `sakura.py`, `foxfire.py`, `summit.py`)
- Textures from Poly Haven, CC0: Grey Stone Path (Amal Kumar), Japanese Cedar Bark (Charlotte Baglioni), Brown Mud
  Leaves 01 (Rob Tuytel)
- Models from Poly Haven, CC0: Fir Tree 01 (the cedar forest) and Jacaranda Tree (its leaves recoloured as the night
  cherry blossom) — Rob Tuytel, Rico Cilliers

## Imagery
Everything on screen is made by code (three.js, WebGL shaders, Canvas2D, and Blender scenes built from Python) and the
CC0 textures and models above; no stock footage, no generated images. The inscriptions' donors are invented (a few are this MV's
own: the verse-1 newspaper, the theatre, the clock shop), as are the solo's shop and theatre signs and its cinema (櫻都キネマ).
