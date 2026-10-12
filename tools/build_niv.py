"""Build data/niv/<book>.json from en_niv.json (github.com/thiagobodruk/bible format).

Usage: python tools/build_niv.py English/en_niv.json

The source drops verses the NIV moves to footnotes, which shifts the numbering
of every later verse in that chapter; a blank is re-inserted so verse numbers
line up with 和合本.
"""
import json
import os
import sys

from canon import BOOKS

IDX = {code: i for i, (code, _) in enumerate(BOOKS)}
OMITTED = {
    "MAT": [(17, 21), (18, 11), (23, 14)],
    "MRK": [(7, 16), (9, 44), (9, 46), (11, 26), (15, 28)],
    "LUK": [(17, 36), (23, 17)],
    "JHN": [(5, 4)],
    "ACT": [(8, 37), (15, 34), (24, 7), (28, 29)],
    "ROM": [(16, 24)],
}
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "niv")

if __name__ == "__main__":
    src = json.load(open(sys.argv[1], encoding="utf-8-sig"))
    assert len(src) == 66
    books = [[[v.strip() for v in ch] for ch in b["chapters"]] for b in src]
    for code, refs in OMITTED.items():
        for c, v in refs:
            books[IDX[code]][c - 1].insert(v - 1, "")
    cuv = os.path.join(OUT, "..", "cuv")
    os.makedirs(OUT, exist_ok=True)
    for i, ((code, count), book) in enumerate(zip(BOOKS, books)):
        assert len(book) == count, code
        zh = json.load(open(os.path.join(cuv, f"{i + 1}.json"), encoding="utf-8"))
        for c, (a, b) in enumerate(zip(book, zh)):
            assert len(a) == len(b), f"{code} {c + 1}: niv {len(a)} vs cuv {len(b)}"
        with open(os.path.join(OUT, f"{i + 1}.json"), "w", encoding="utf-8") as fh:
            json.dump(book, fh, ensure_ascii=False, separators=(",", ":"))
    print("verses:", sum(len(c) for b in books for c in b))
