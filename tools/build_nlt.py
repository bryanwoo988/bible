"""Build data/nlt/<book>.json from en_nlt.json (github.com/thiagobodruk/bible format).

Usage: python tools/build_nlt.py English/en_nlt.json

Lines verse numbers up with 和合本, like build_niv.py:
- the verses the NLT moves to footnotes get a blank (same list as the NIV);
- Revelation 12:18 is joined to 12:17 (和合本 counts it there);
- Numbers 1-2 are tables in the NLT and the source keeps only the first row of
  each, so the rows that are missing become blanks at their verse numbers.
Also tidies the source: no space after "Lord" before punctuation, and table
headers and run-together names in a few lists are split.
"""
import json
import os
import re
import sys

from build_niv import IDX, OMITTED
from canon import BOOKS

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "nlt")


def tidy(v):
    v = v.strip()
    v = re.sub(r"\bLord ([,.;:!?’])", r"Lord\1", v)
    v = re.sub(r"Tribe (?:Leader ?Number|Leader|Number)(?=[A-Z])", "", v)  # table headers
    v = re.sub(r"([a-z)])([A-Z][a-z])", r"\1; \2", v)  # table rows run together
    return v


def spread(ch, slots, total):
    """Place source verses at the verse numbers in slots (1-based), blanks elsewhere."""
    assert len(ch) == len(slots)
    out = [""] * total
    for v, n in zip(ch, slots):
        out[n - 1] = v
    return out


if __name__ == "__main__":
    src = json.load(open(sys.argv[1], encoding="utf-8-sig"))
    assert len(src) == 66
    books = [[[tidy(v) for v in ch] for ch in b["chapters"]] for b in src]

    num = books[IDX["NUM"]]
    # 1:20 is the first row of the census table (vv. 20-43); 1:44-54 follow it.
    num[0] = spread(num[0], [*range(1, 21), *range(44, 55)], 54)
    # Each camp: first table row, then the total verse after the table.
    num[1] = spread(num[1], [1, 2, 3, 9, 10, 16, 17, 18, 24, 25, 31, 32, 33, 34], 34)

    rev12 = books[IDX["REV"]][11]
    rev12[16] += " " + rev12.pop(17)

    for code, refs in OMITTED.items():
        for c, v in refs:
            books[IDX[code]][c - 1].insert(v - 1, "")

    cuv = os.path.join(OUT, "..", "cuv")
    os.makedirs(OUT, exist_ok=True)
    for i, ((code, count), book) in enumerate(zip(BOOKS, books)):
        assert len(book) == count, code
        zh = json.load(open(os.path.join(cuv, f"{i + 1}.json"), encoding="utf-8"))
        for c, (a, b) in enumerate(zip(book, zh)):
            assert len(a) == len(b), f"{code} {c + 1}: nlt {len(a)} vs cuv {len(b)}"
        with open(os.path.join(OUT, f"{i + 1}.json"), "w", encoding="utf-8") as fh:
            json.dump(book, fh, ensure_ascii=False, separators=(",", ":"))
    print("verses:", sum(len(c) for b in books for c in b), "blank:", sum(not v for b in books for c in b for v in c))
