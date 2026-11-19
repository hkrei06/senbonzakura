"""Japanese lyrics -> per-word times in data/lyrics.json: CTC forced alignment of their romaji.

ctc_align.py aligns a-z text only. Here each LRC line (data/lyrics.src.lrc, times accurate to ~0.3 s) is cut into
words by fugashi (UniDic: surface + sung pronunciation, e.g. the particle は -> ワ); each word's pronunciation is
romanized by cutlet (Hepburn) and the romaji go through the same emissions (ctc_align.common_logp: MMS_FA on the MDX
vocal stem, mono + L + R) and Viterbi pass (ctc_viterbi.align) as English lyrics. MMS_FA was trained on romanized
text of 1100+ languages, so it reads romaji; the English LV60K model is left out (JA_MODELS=mms,lv60k to add it).
  * a reading in full-width brackets after a kanji run, 浮世（うきよ）, is the sung reading of that run: it replaces
    the dictionary reading and is not displayed
  * Latin capitals are sung as letter names (ICBM -> ai shii bii emu)
  * punctuation joins the word before it
Each word keeps its surface (the words of a line, in order, spell the displayed line without its spaces).
Synthesized (VOCALOID) vocals sit on the grid: run analysis/snap_words.py afterwards. Prints times only, no text.

  [LRC_OFFSET=1.0] python analysis/ja_align.py      then   python analysis/snap_words.py
"""
import json
import os
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ctc_align as ca  # noqa: E402  (emissions, T0 / T1 window, paths)
from ctc_viterbi import align  # noqa: E402

import cutlet  # noqa: E402
import fugashi  # noqa: E402

MODELS = os.environ.get("JA_MODELS", "mms").split(",")
# the LRC's own clock vs the song (s): a first pass with 0 prints how far each line lands from its LRC time; when
# they agree (this song: +1.0 s, the LRC was timed to another release) rerun with it so every window sits right
LRC_OFFSET = float(os.environ.get("LRC_OFFSET", "0"))
KANJI = r"[一-鿿々]"
KANA = r"[぀-ヿー]"
LETTER = dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", (
    "ei bii shii dii ii efu jii eichi ai jei kei eru emu enu oo pii kyuu aaru esu tii yuu bui daburyuu ekkusu wai "
    "zetto").split()))
PUNCT = re.compile(r"^[\W_]+$")

tagger = fugashi.Tagger()
kat = cutlet.Cutlet()


def lrc():
    """[(t, text)] for every timed row, sorted; empty rows are gap / end markers."""
    tag = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\]")
    rows = []
    for l in (ca.DATA / "lyrics.src.lrc").read_text(encoding="utf-8-sig").splitlines():
        ts = tag.findall(l)
        text = tag.sub("", l).strip()
        rows += [(int(m) * 60 + float(s) + LRC_OFFSET, text) for m, s in ts]
    return sorted(rows)


def romaji(kana: str) -> str:
    return re.sub(r"[^a-z]", "", kat.romaji(kana).lower())


def words_of(phrase: str):
    """[(surface, romaji)] for one space-free phrase; bracketed readings applied and dropped."""
    out = []
    pos = 0
    for m in re.finditer(rf"({KANJI}+)（({KANA}+)）", phrase):
        out += tokens(phrase[pos:m.start()])
        out.append((m.group(1), romaji(m.group(2))))
        pos = m.end()
    out += tokens(phrase[pos:])
    # punctuation (and anything unpronounced) joins the word before it
    merged = []
    for s, r in out:
        if not r and merged:
            merged[-1] = (merged[-1][0] + s, merged[-1][1])
        elif r:
            merged.append((s, r))
    return merged


def tokens(text: str):
    out = []
    text = re.sub(r"（[^）]*）|\([^)]*\)", "", text)  # a stray bracket group with no kanji before it
    for w in tagger(text):
        s = w.surface
        if re.fullmatch(r"[A-Za-z]+", s):
            out.append((s, "".join(LETTER.get(c.upper(), "") for c in s)))
            continue
        if PUNCT.match(s):
            out.append((s, ""))
            continue
        f = w.feature
        rd = getattr(f, "pron", None) or getattr(f, "kana", None)
        if not rd or rd == "*":
            rd = s  # unknown word: kana as written
        out.append((s, romaji(rd)))
    return out


def main():
    rows = lrc()
    timed = [(i, t, x) for i, (t, x) in enumerate(rows) if x and ca.T0 + 1 <= t < ca.T1]
    es = [ca.common_logp(m, s) for m in MODELS for s in ca.SOURCES]
    n = min(len(e) for e in es)
    E = np.logaddexp.reduce(np.stack([e[:n] for e in es]), axis=0) - np.log(len(es))

    lines, toks, windows = [], [], {}
    for k, (i, t, x) in enumerate(timed):
        display = re.sub(r"（[^）]*）|\([^)]*\)", "", x)
        ws = [w for ph in x.split() for w in words_of(ph)]
        nxt = rows[i + 1][0] if i + 1 < len(rows) else ca.T1
        windows[k] = (max(0.0, t - 0.4 - ca.T0), min(ca.T1 - ca.T0, nxt + 0.15 - ca.T0))
        lines.append((t, display, ws))
        toks.append([r for _, r in ws])
    words, score = align(E, toks, windows)

    out = []
    for li, (t, display, ws) in enumerate(lines):
        wl = []
        for ti, (s, _) in enumerate(ws):
            w = words[(li, ti)]
            wl.append(dict(w=s, start=round(w["start"] + ca.T0, 3), end=round(w["end"] + ca.T0, 3), conf=round(w["conf"], 3)))
        assert "".join(w["w"] for w in wl) == display.replace(" ", "").replace("　", ""), f"L{li + 1}: words do not spell the line"
        out.append(dict(i=li, text=display, lrc=round(t, 3), start=wl[0]["start"], end=wl[-1]["end"], words=wl))
        c = [w["conf"] for w in wl]
        print("L%-2d lrc %7.2f  aligned %7.2f-%7.2f (%+.2f)  words %2d  conf min %.2f mean %.2f" % (
            li + 1, t, wl[0]["start"], wl[-1]["end"], wl[0]["start"] - t, len(wl), min(c), np.mean(c)))
    doc = dict(lines=out, extras=[], notes=(
        "Japanese, word-level: analysis/ja_align.py (fugashi/UniDic words, cutlet romaji, CTC forced alignment with "
        "MMS_FA on the MDX vocal stem, one Viterbi pass, 20 ms frames). Text from data/lyrics.src.lrc; bracketed "
        "readings used for alignment, not displayed. LRC times shifted by %+.2f s. Song time (s)." % LRC_OFFSET))
    (ca.DATA / "lyrics.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote data/lyrics.json", len(out), "lines, viterbi score %.1f" % score)


if __name__ == "__main__":
    main()
