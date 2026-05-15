#!/usr/bin/env python3
"""
build_entity_index.py

Reads all chapter JSON files from app/public/data/shiji/*.json (excluding index.json),
extracts XML-tagged entities from each paragraph's `annotated` field,
and builds an inverted index saved to app/public/data/entity_occurrences.json.
"""

import json
import re
import os
import glob
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHIJI_DIR = os.path.join(BASE_DIR, "app", "public", "data", "shiji")
OUTPUT_FILE = os.path.join(BASE_DIR, "app", "public", "data", "entity_occurrences.json")

# All valid entity tag names
ENTITY_TAGS = (
    "p", "loc", "off", "time", "state", "role", "clan", "sys", "idea",
    "law", "tribe", "astro", "bio", "book", "rite", "qty", "myth", "art",
    "evt", "geo", "ruin", "vact", "vpol", "vecon", "vpen", "idiom"
)

# Build regex pattern — longest alternatives first to avoid prefix shadowing
TAG_PATTERN = re.compile(
    r'<(' + '|'.join(sorted(ENTITY_TAGS, key=len, reverse=True)) + r')'
    r'(\s+name="([^"]*)")?>(.*?)</\1>',
    re.DOTALL
)

SNIPPET_LEN = 60


def chapter_sort_key(chapter_file: str) -> int:
    """Extract leading numeric prefix for sorting."""
    m = re.match(r'^(\d+)', chapter_file)
    return int(m.group(1)) if m else 999999


def process_file(filepath: str) -> tuple[str, str, list[dict]]:
    """
    Returns (chapter_file, title, list_of_entity_hits).
    Each hit: { canonical, display, tag, pid, snippet }
    """
    with open(filepath, encoding="utf-8") as f:
        data = json.load(f)

    chapter_file = data.get("chapter_file", os.path.splitext(os.path.basename(filepath))[0])
    title = data.get("chapter", chapter_file)
    paragraphs = data.get("paragraphs", [])

    hits = []
    for para in paragraphs:
        pid = para.get("pid", "")
        annotated = para.get("annotated", "") or ""
        text = para.get("text", "") or ""
        snippet = text[:SNIPPET_LEN]

        # Collect unique (canonical, tag) pairs per paragraph to deduplicate
        seen_in_para: set[tuple[str, str]] = set()

        for m in TAG_PATTERN.finditer(annotated):
            tag = m.group(1)
            name_attr = m.group(3)   # may be None
            inner_text = m.group(4)

            canonical = name_attr.strip() if name_attr else inner_text.strip()
            if not canonical:
                continue

            key = (canonical, tag)
            if key in seen_in_para:
                continue
            seen_in_para.add(key)

            hits.append({
                "canonical": canonical,
                "display": inner_text.strip(),
                "tag": tag,
                "pid": pid,
                "snippet": snippet,
            })

    return chapter_file, title, hits


def main():
    # Gather all chapter files, excluding index.json
    pattern = os.path.join(SHIJI_DIR, "*.json")
    all_files = sorted(glob.glob(pattern))
    chapter_files = [f for f in all_files if os.path.basename(f) != "index.json"]

    print(f"Found {len(chapter_files)} chapter files in {SHIJI_DIR}")

    # entity_name → { types: set, occurrences: list }
    index: dict[str, dict] = {}
    total_occurrences = 0

    for i, filepath in enumerate(chapter_files, 1):
        chapter_file, title, hits = process_file(filepath)
        if i % 20 == 0 or i == len(chapter_files):
            print(f"  [{i}/{len(chapter_files)}] processed {chapter_file} ({len(hits)} entity hits)")

        for hit in hits:
            canonical = hit["canonical"]
            tag = hit["tag"]

            if canonical not in index:
                index[canonical] = {"types": set(), "occurrences": []}

            index[canonical]["types"].add(tag)
            index[canonical]["occurrences"].append({
                "chapter": chapter_file,
                "title": title,
                "pid": hit["pid"],
                "snippet": hit["snippet"],
                "_sort_key": chapter_sort_key(chapter_file),
            })
            total_occurrences += 1

    print(f"\nBuilding output index for {len(index)} unique entities…")

    # Sort occurrences by chapter number, then by pid
    entities_out: dict[str, dict] = {}
    for canonical, data in sorted(index.items()):
        sorted_occ = sorted(
            data["occurrences"],
            key=lambda o: (o["_sort_key"], str(o["pid"]))
        )
        # Strip internal sort key
        clean_occ = [
            {"chapter": o["chapter"], "title": o["title"], "pid": o["pid"], "snippet": o["snippet"]}
            for o in sorted_occ
        ]
        entities_out[canonical] = {
            "types": sorted(data["types"]),
            "count": len(clean_occ),
            "occurrences": clean_occ,
        }

    output = {
        "meta": {
            "total_entities": len(entities_out),
            "total_occurrences": total_occurrences,
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "entities": entities_out,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nDone!")
    print(f"  Unique entities : {len(entities_out):,}")
    print(f"  Total occurrences: {total_occurrences:,}")
    print(f"  Output written to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
