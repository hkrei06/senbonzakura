"""Line-level lyrics for non-latin LRCs (Japanese etc.) -> data/lyrics.json, no per-word alignment.

ctc_align.py only aligns a-z text; this keeps each LRC line as one "word" spanning the line.
  * starts = the LRC times (+ --offset). The script prints a suggested global offset (the shift where vocal activity
    in audio/stems/vocals.wav switches on right at the line starts) as a hint for an LRC from another release;
    `--offset auto` applies it. Starts are not snapped: in continuous singing the vocal stem never goes quiet.
  * each line ends at its first pause >= REST s, else its last vocal activity before the next line. Empty LRC lines
    are gap / end markers.
Prints only times and character counts, never lyric text.

  python analysis/lrc_lines.py [--offset 0.0 | --offset auto]
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
FPS = 100
MAX_OFF = 12.0   # s, the global shift search range
REST = 1.0       # s of vocal silence that ends a line


def lrc():
    tag = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\]")
    rows = []
    for l in (DATA / "lyrics.src.lrc").read_text(encoding="utf-8-sig").splitlines():
        ts = tag.findall(l)
        text = tag.sub("", l).strip()
        rows += [(int(m) * 60 + float(s), text) for m, s in ts]
    return sorted(rows)


def activity():
    y, sr = sf.read(str(ROOT / "audio" / "stems" / "vocals.wav"), dtype="float32", always_2d=True)
    y = y.mean(axis=1)
    hop = sr // FPS
    n = len(y) // hop
    rms = np.sqrt((y[: n * hop].reshape(n, hop) ** 2).mean(axis=1))
    db = 20 * np.log10(rms + 1e-9)
    # ponytail: one global threshold (15 dB under the loud vocal level); per-section thresholds if quiet verses get missed
    return db > np.percentile(db, 95) - 15


def contrast(act, starts, d):
    """Mean vocal activity just after the shifted line starts minus just before: high when lines start on singing."""
    s = 0.0
    for t in starts:
        i = int(round((t + d) * FPS))
        if i - 50 < 0 or i + 50 > len(act):
            continue
        s += act[i : i + 50].mean() - act[i - 50 : i].mean()
    return s / len(starts)


def main():
    rows = lrc()
    act = activity()
    dur = len(act) / FPS
    starts = [t for t, x in rows if x]
    grid = np.arange(-MAX_OFF, MAX_OFF + 1e-9, 0.02)
    scores = np.array([contrast(act, starts, d) for d in grid])
    best = float(grid[scores.argmax()])
    print("offset search: best %+.2f s (contrast %.2f), at 0 s contrast %.2f" % (best, scores.max(), contrast(act, starts, 0.0)))
    arg = sys.argv[sys.argv.index("--offset") + 1] if "--offset" in sys.argv else "0"
    off = best if arg == "auto" else float(arg)
    print("using offset %+.2f s" % off)

    out = []
    for k, (t, text) in enumerate(rows):
        if not text:
            continue
        t += off
        nxt = rows[k + 1][0] + off if k + 1 < len(rows) else dur
        if t >= dur:
            print("L%-2d lrc %7.2f  past the end of the song, dropped" % (len(out) + 1, rows[k][0]))
            continue
        start = max(0.0, t)
        a, b = int(start * FPS), int(min(nxt, dur) * FPS)
        on = np.flatnonzero(act[a:b])
        end = (a + on[-1] + 1) / FPS if len(on) else min(nxt, start + 2.0)
        # the line ends at its first pause >= REST once it has started (instrument bleed keeps the stem from going
        # fully quiet in instrumental breaks, so "last activity before the next line" would run through them)
        quiet = np.convolve(~act[a:b], np.ones(int(REST * FPS)), "valid") >= int(REST * FPS) - 1
        q = np.flatnonzero(quiet[int(0.3 * FPS):])
        if len(q):
            end = min(end, (a + int(0.3 * FPS) + q[0]) / FPS)
        end = max(end, start + 0.3)
        out.append(dict(i=len(out), text=text, lrc=round(rows[k][0], 3), start=round(start, 3), end=round(end, 3),
                        words=[dict(w=text, start=round(start, 3), end=round(end, 3))]))
        print("L%-2d lrc %7.2f  -> %7.2f-%7.2f  (%+.2f)  chars %2d%s" % (
            len(out), rows[k][0], start, end, start - rows[k][0], len(text), "" if len(on) else "  NO VOCALS FOUND"))
    doc = dict(lines=out, extras=[], notes=(
        "Line-level only (analysis/lrc_lines.py): text from data/lyrics.src.lrc, each line one word spanning it; "
        "starts = LRC times %+.2f s, ends = last vocal activity in audio/stems/vocals.wav before the next line. Song time (s)." % off))
    (DATA / "lyrics.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote data/lyrics.json", len(out), "lines")


if __name__ == "__main__":
    main()
