# 圣经 · 中英对照 Bible PWA

A simple bilingual (Chinese / English) Bible app that installs on a phone's home screen and works offline.

## Features

- **中英对照**: each verse shows one line of Chinese, then one line of English
- **多分页**: open several passages at once (for example the sermon text plus its cross-references) and switch with one tap; each tab remembers its position
- **快速跳转**: type `约3:16`, `罗8`, `John 3:16` or `1co13`, or pick book, chapter and verse from a grid
- **朗读**: reads verse by verse (Chinese, English or both; Mandarin or Cantonese; adjustable speed), highlights and scrolls to the current verse, and continues into the next chapter
- **导读**: an introduction to every book in Chinese and English (author, date, theme, summary, key verse, outline)
- **标记**: highlight or underline in 5 colours, notes, bookmarks, copy
- **历史**: a reading log by date and time, showing book, chapter and verse
- **设置**: font size, light/dark mode, version choice, read-aloud options, backup and restore
- Data is stored on the device (localStorage / IndexedDB); nothing is uploaded

## 译本 Versions

- **Built in:** 和合本 (1919, public domain), simplified (`data/cuv`) and traditional (`data/cuvt`, converted with OpenCC).
- **NIV** (`data/niv`, built with `tools/build_niv.py`): Scripture quotations taken from The Holy Bible, New International Version® NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ Used by permission. All rights reserved worldwide.
- **Other versions:** import a JSON file under 设置 → 导入译本. Imported versions are stored only on that device.

## Development

It's a static site with no build step:

```bash
python3 -m http.server 8765
```

To rebuild the 和合本 data from the PDF (needs `pip install pymupdf opencc-python-reimplemented`):

```bash
python tools/pdf2json.py cuv "Chinese/简体中文和合本圣经(CUV).pdf" /tmp/cuv.json
python tools/build_cuv.py /tmp/cuv.json
```
