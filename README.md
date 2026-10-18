# 圣经 · 中英对照 Bible PWA

A simple bilingual (Chinese / English) Bible app that installs on a phone's home screen and works offline.

## Features

- **中英对照**: each verse shows one line of Chinese, then one line of English, or one language only (经文显示)
- **底部导航**: 内容 (book list → chapters → reading), 笔记, 书签, 历史, 设定
- **内容**: large Old/New Testament book list, big chapter buttons, "continue reading", recent passages, reference search (`约3:16`, `John 3:16`, `1co13`) and keyword search (`神爱世人`, `faith hope`) with the words highlighted, results grouped by book, and the words marked in the opened chapter
- **多分页**: keep several passages open (sermon text plus cross-references), switch with one tap, press and hold to reorder
- **朗读**: read-aloud mode switch in the header. When on, tap a verse to listen from there; the player has a progress bar, speed control and voice choice, and continues into the next chapter. When off, tapping verses selects them for marking
- **标记**: press and hold to select any words, even across verses, then highlight or underline in 5 colours, add a note, copy or bookmark; whole verses can be marked too
- **导读**: an introduction to every book in Chinese and English (author, date, theme, summary, key verse, outline)
- **历史**: a reading log by date and time, showing book, chapter and verse
- **界面语言**: English, 简体中文 or 繁體中文, chosen on first launch
- **设定**: font size, light/dark mode, versions, read-aloud voices, backup and restore
- Data is stored on the device (localStorage / IndexedDB); nothing is uploaded

## 译本 Versions

- **Built in:** 和合本 (1919, public domain), simplified (`data/cuv`) and traditional (`data/cuvt`, converted with OpenCC).
- **NIV** (`data/niv`, built with `tools/build_niv.py`): Scripture quotations taken from The Holy Bible, New International Version® NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ Used by permission. All rights reserved worldwide.
- **Other versions:** import a JSON file under 设置 → 导入译本. Imported versions are stored only on that device.

## Releasing an update

Add an entry at the top of `js/releases.js` (version, date, and what changed in 简体 / 繁體 / English) and bump `VERSION` in `sw.js`. After the update, the app shows the new entries once, and Settings → 更新记录 lists them all (`whatsnew.js`, shared by all of Bryan Woo's apps).

## Development

It's a static site with no build step:

```bash
python3 -m http.server 8765
```

After editing `js/strings/zhs.js` or `js/intro.js`, regenerate the 繁體 files (needs `pip install opencc-python-reimplemented`):

```bash
python tools/build_zht.py
```

To rebuild the 和合本 data from the PDF (needs `pip install pymupdf opencc-python-reimplemented`):

```bash
python tools/pdf2json.py cuv "Chinese/简体中文和合本圣经(CUV).pdf" /tmp/cuv.json
python tools/build_cuv.py /tmp/cuv.json
```
