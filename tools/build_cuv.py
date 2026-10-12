"""Build the app's 和合本 data from the parsed PDF output.

Usage:
  python tools/pdf2json.py cuv "Chinese/简体中文和合本圣经(CUV).pdf" /tmp/cuv.json
  python tools/build_cuv.py /tmp/cuv.json

Applies fixes for typesetting errors in the source PDF, then writes
data/cuv/<book>.json (简体) and data/cuvt/<book>.json (繁體, via OpenCC),
one file per book: an array of chapters, each an array of verse strings.
An empty string means the verse is printed together with the previous one.
"""
import json
import os
import sys

from opencc import OpenCC

from canon import BOOKS

IDX = {code: i for i, (code, _) in enumerate(BOOKS)}
ROOT = os.path.join(os.path.dirname(__file__), "..", "data")


def fix(books):
    def ch(code, n):
        return books[IDX[code]][n - 1]

    # Matthew 10:25 is misprinted as "10:2" and ends up glued to 10:24.
    mat10 = ch("MAT", 10)
    head, tail = mat10[23].split(" 2 ", 1)
    mat10[23], mat10[24] = head.strip(), tail.strip()

    # John 7:53 and 8:1 are printed as one verse at the start of chapter 8.
    jhn8 = ch("JHN", 8)
    first = jhn8[0]
    assert first.startswith("于是各人都回家去了，"), first
    ch("JHN", 7).append("于是各人都回家去了。")
    jhn8[0] = first.split("，", 1)[1]

    # 1 Chronicles 22:1 is numbered 21:31 in the PDF.
    ch("1CH", 22).insert(0, ch("1CH", 21).pop())

    # Galatians 3:29 is missing from the PDF.
    gal3 = ch("GAL", 3)
    assert len(gal3) == 28
    gal3.append("你们既属乎基督，就是亚伯拉罕的后裔，是照着应许承受产业的了。")
    return books


def write(books, version, convert=None):
    out = os.path.join(ROOT, version)
    os.makedirs(out, exist_ok=True)
    for i, book in enumerate(books):
        data = [[convert(v) if convert else v for v in chapter] for chapter in book]
        with open(os.path.join(out, f"{i + 1}.json"), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    books = fix(json.load(open(sys.argv[1], encoding="utf-8"))["books"])
    for (code, count), book in zip(BOOKS, books):
        assert len(book) == count, code
    write(books, "cuv")
    write(books, "cuvt", OpenCC("s2t").convert)
    print("verses:", sum(len(c) for b in books for c in b))
