"""Convert the 和合本 PDF into the app's JSON format.

Usage: python tools/pdf2json.py cuv <pdf> <out.json>

Each PyMuPDF text line is mapped to events:
  ("C",)      start of a new chapter (its first verse has no number)
  ("V", n)    verse number n
  ("T", s)    verse text
  ("SKIP",)   footnote/back-matter starts; ignore text until the next chapter
  None        ignore span (headers, footers, headings, footnote markers)

Books are assigned by counting chapters against the canonical chapter counts.
Output: {"id", "name", "lang", "books": [[ [verse1, verse2, ...], ... ], ...]}
where an empty string marks a verse number the translation omits.
"""
import json
import re
import sys

import pymupdf

from canon import BOOKS, TOTAL_CHAPTERS

CUV_VERSE = re.compile(r"^\s*(\d*):(\d+)(?:\s*[-,，、]\s*(\d+))?\s*$")


def cuv(s):
    f, z, t = s["font"], s["size"], s["text"]
    if abs(z - 10.6) > 0.3:
        return None  # headers, footers, chapter index, drop caps, titles
    if f.startswith("Calibri"):
        m = CUV_VERSE.match(t)
        if m:
            first, last = int(m.group(2)), int(m.group(3) or m.group(2))
            if m.group(1) == "" and first == 1:
                return ("C", last)
            return ("V", first, last)
        return None
    return ("T", t)


VERSIONS = {
    "cuv": (cuv, "zh"),
}


def clean(text, lang):
    text = text.replace("­", "").replace(" ", " ").replace(" ", " ")
    text = text.replace(" ", " ").replace(" ", " ").replace("\x08", "")
    text = re.sub(r"\s+", " ", text).strip()
    if lang == "zh":
        text = re.sub(r"(?<=[　-鿿＀-￯“”‘’])\s+(?=[　-鿿＀-￯“”‘’])", "", text)
        text = re.sub(r"^\s+|\s+$", "", text)
    return text


def lines_of(page, classify, lang, skip_line=None):
    """Yield events per line; a line is a list of spans."""
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            spans = line["spans"]
            if skip_line and skip_line(spans):
                continue
            events = []
            if classify is cuv:
                events = cuv_line(spans)
            else:
                for s in spans:
                    e = classify(s)
                    if e:
                        events.append(e)
            if events:
                events.append(("EOL",))
            yield from events


CUV_LINE = re.compile(r"^\s*(\d*):(\d+)(?:\s*[-,，、]\s*(\d+))*(?!\d)")


def cuv_line(spans):
    """The verse reference ("40:2", ":1", "24:29,30", "13:17、18") may be split
    over several spans, so match it against the whole line's text."""
    spans = [s for s in spans if abs(s["size"] - 10.6) <= 0.3]
    text = "".join(s["text"] for s in spans)
    m = CUV_LINE.match(text) if spans and spans[0]["font"].startswith("Calibri") else None
    if not m:
        return [("T", text)] if text.strip() else []
    first, last = int(m.group(2)), int(m.group(3) or m.group(2))
    ev = ("C", last) if m.group(1) == "" and first == 1 else ("V", first, last)
    return [ev, ("T", text[m.end():])]


def cuv_skip_line(spans):
    # Section headings are a line of SimSun text followed by a bold Calibri space,
    # with no verse number on the line.
    has_bold = any(s["font"] == "Calibri-Bold" for s in spans)
    has_num = bool(re.search(r"\d*:\d", "".join(s["text"] for s in spans if s["font"].startswith("Calibri") and abs(s["size"] - 10.6) <= 0.3)))
    return has_bold and not has_num


def parse(version, path, start_page, end_page=None):
    classify, lang = VERSIONS[version]
    doc = pymupdf.open(path)
    end_page = end_page or doc.page_count
    chapters = []  # list of dict verse->list[str]
    cur = 0
    just_c = False
    skipping = False
    warnings = []
    skip_line = cuv_skip_line if version == "cuv" else None

    tgt = 1

    def new_chapter(last=1):
        nonlocal cur, just_c, tgt
        chapters.append({v: [] for v in range(1, last + 1)})
        cur, tgt = last, 1
        just_c = True

    for pno in range(start_page, end_page):
        if len(chapters) > TOTAL_CHAPTERS:
            break
        for e in lines_of(doc[pno], classify, lang, skip_line):
            kind = e[0]
            if kind == "SKIP":
                skipping = True
                continue
            if kind == "C":
                skipping = False
                new_chapter(e[1] if len(e) > 1 else 1)
                continue
            if skipping or not chapters and kind != "V":
                continue
            if kind == "V":
                n = e[1]
                last = e[2] if len(e) > 2 else n
                if not chapters:
                    if n == 1:
                        new_chapter()
                    continue
                if just_c and n == 1:
                    continue
                if n == 1 and cur > 1:
                    new_chapter(last)
                elif n > cur:
                    if n > cur + 1:
                        warnings.append(f"p{pno}: chapter {len(chapters)} jump {cur}->{n}")
                    for v in range(n, last + 1):
                        chapters[-1][v] = []
                    cur, tgt = last, n
                else:
                    warnings.append(f"p{pno}: chapter {len(chapters)} verse {n} after {cur}; kept as text")
                    chapters[-1][tgt].append(str(n))
                just_c = False
                continue
            if kind == "T":
                if e[1].strip():
                    just_c = False
                chapters[-1][tgt].append(e[1])
            elif kind == "EOL" and chapters:
                chapters[-1][tgt].append("\n")
    return chapters[:TOTAL_CHAPTERS], warnings, lang


def join(parts, lang):
    out = ""
    for p in parts:
        if p == "\n":
            if lang == "en":
                stripped = out.rstrip()
                if stripped.endswith(("­", "-", "—")):
                    out = stripped
                elif out and not out.endswith(" "):
                    out += " "
            continue
        out += p
    return clean(out, lang)


def build(chapters, lang):
    books, i = [], 0
    for _, count in BOOKS:
        book = []
        for ch in chapters[i:i + count]:
            last = max(ch)
            book.append([join(ch.get(v, []), lang) for v in range(1, last + 1)])
        books.append(book)
        i += count
    return books


START = {"cuv": 5}

if __name__ == "__main__":
    version, pdf, out = sys.argv[1], sys.argv[2], sys.argv[3]
    start = int(sys.argv[4]) if len(sys.argv) > 4 else START[version]
    end = int(sys.argv[5]) if len(sys.argv) > 5 else None
    chapters, warnings, lang = parse(version, pdf, start, end)
    for w in warnings:
        print("WARN", w, file=sys.stderr)
    print(f"{version}: {len(chapters)} chapters, {sum(len(c) for c in chapters)} verses", file=sys.stderr)
    books = build(chapters, lang)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({"id": version, "lang": lang, "books": books}, fh, ensure_ascii=False, separators=(",", ":"))
