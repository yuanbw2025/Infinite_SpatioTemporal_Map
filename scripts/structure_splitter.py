#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
structure_splitter.py — 从二十四史 txt 中把一部"卷/本纪/列传"切成段落化 JSON

【当前用途】
仅支持史记项羽本纪（源文件 012_part0006_split_006.txt 第 10-162 行）。
日后可扩展更多章节。

【输出】
TotalData/ProcessedData/xiangyu/xiangyu_chapters.json
  {
    "work": "史记",
    "chapter": "项羽本纪",
    "chapter_num": 7,
    "source_file": "...",
    "source_lines": [10, 162],
    "paragraphs": [
        {"pid": "7.1",  "text": "项籍者，下相人也..."},
        {"pid": "7.2",  "text": "项籍少时..."},
        ...
    ]
  }
以及 .txt 逐段预览文件方便肉眼 diff。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC  = ROOT / "TotalData/ProcessedData/ershisi_full_texts/012_part0006_split_006.txt"
OUT_DIR = ROOT / "TotalData/ProcessedData/xiangyu"
OUT_JSON = OUT_DIR / "xiangyu_chapters.json"
OUT_TXT  = OUT_DIR / "xiangyu_paragraphs.txt"

# 明确的边界（1-based 行号）
LINE_START = 10   # "史记卷七"
LINE_END   = 162  # "...岂不谬哉！" 太史公曰结尾
CHAPTER_NUM = 7
CHAPTER_NAME = "项羽本纪"
WORK = "史记"


def clean(line: str) -> str:
    # 去掉首尾全角/半角空白
    return line.strip().replace("\u3000", "").strip()


def split_chapter() -> dict:
    if not SRC.exists():
        print(f"[ERR] source file not found: {SRC}", file=sys.stderr)
        sys.exit(2)

    raw_lines = SRC.read_text(encoding="utf-8").splitlines()
    # 取指定行号（1-based）
    slice_lines = raw_lines[LINE_START - 1: LINE_END]

    paragraphs: list[dict] = []
    pid_counter = 0
    for ln in slice_lines:
        txt = clean(ln)
        if not txt:
            continue
        # 标题两行跳过（"史记卷七"、"项羽本纪第七"）
        if txt.startswith("史记卷"):
            continue
        if txt == f"{CHAPTER_NAME}第七" or txt == CHAPTER_NAME:
            continue
        # 过渡标记（部分文本中出现的"译文："不应入段，但此范围内无）
        if txt == "译文：":
            continue
        pid_counter += 1
        paragraphs.append({
            "pid": f"{CHAPTER_NUM}.{pid_counter}",
            "text": txt,
        })

    return {
        "work": WORK,
        "chapter": CHAPTER_NAME,
        "chapter_num": CHAPTER_NUM,
        "source_file": str(SRC.relative_to(ROOT)),
        "source_lines": [LINE_START, LINE_END],
        "paragraph_count": len(paragraphs),
        "total_chars": sum(len(p["text"]) for p in paragraphs),
        "paragraphs": paragraphs,
    }


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    data = split_chapter()

    OUT_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 纯文本预览
    lines = [f"# {data['work']}·{data['chapter']}"]
    lines.append(f"# 段落数: {data['paragraph_count']}  总字数: {data['total_chars']}")
    lines.append("")
    for p in data["paragraphs"]:
        lines.append(f"[{p['pid']}] {p['text']}")
        lines.append("")
    OUT_TXT.write_text("\n".join(lines), encoding="utf-8")

    print(f"[OK] chapter : {data['chapter']} (卷 {data['chapter_num']})")
    print(f"[OK] paragraphs: {data['paragraph_count']}")
    print(f"[OK] total chars: {data['total_chars']}")
    print(f"[OK] json -> {OUT_JSON.relative_to(ROOT)}")
    print(f"[OK] txt  -> {OUT_TXT.relative_to(ROOT)}")

    # 预览前 3 段
    print("--- preview ---")
    for p in data["paragraphs"][:3]:
        preview = p["text"][:60] + ("..." if len(p["text"]) > 60 else "")
        print(f"  [{p['pid']}] {preview}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
