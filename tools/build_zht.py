"""Generate the 繁體 interface files from the 简体 sources with OpenCC.

Usage: python tools/build_zht.py   (needs: pip install opencc-python-reimplemented)

  js/strings/zhs.js -> js/strings/zht.js   (s2twp: Taiwan wording, e.g. 设置 -> 設定)
  js/intro.js       -> js/intro-zht.js     (s2tw: Taiwan standard characters, e.g. 為)
"""
import os

from opencc import OpenCC

ROOT = os.path.join(os.path.dirname(__file__), "..", "js")
HEADER = "// 由 tools/build_zht.py 从简体版自动生成，请勿手改。\n"


def convert(src, dst, config):
    text = open(os.path.join(ROOT, src), encoding="utf-8").read()
    lines = text.split("\n")
    if lines[0].startswith("//"):
        lines = lines[1:]
    out = HEADER + OpenCC(config).convert("\n".join(lines)).replace("臺灣", "台灣")
    with open(os.path.join(ROOT, dst), "w", encoding="utf-8") as fh:
        fh.write(out)


if __name__ == "__main__":
    convert("strings/zhs.js", "strings/zht.js", "s2twp")
    convert("intro.js", "intro-zht.js", "s2tw")
    print("ok")
