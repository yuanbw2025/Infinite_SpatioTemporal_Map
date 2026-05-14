#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
text_annotator.py — 段落级实体标注（XML 标签 + 反思迭代 + Zero-Tampering 门禁）

【输入】
TotalData/ProcessedData/xiangyu/xiangyu_chapters.json
  {..., "paragraphs":[{"pid":"7.1","text":"..."}, ...]}

【输出】
TotalData/ProcessedData/xiangyu/xiangyu_annotated.json
  {
    "chapter": "项羽本纪",
    "paragraphs": [
      {
        "pid": "7.1",
        "text": "...原文...",
        "annotated": "...带 XML 标签的正文...",
        "rounds": 2,
        "tamper_ok": true,
        "reflection": {...}
      }, ...
    ]
  }

【流程（每段）】
  loop ≤ MAX_ROUNDS:
    1. skill 01 做一次标注
    2. Zero-Tampering 本地校验（re.sub 后 == 原文？）
       - 不通过：把 diff 回塞 prompt，重来（不进反思）
    3. skill 03 做反思
       - status=ok 退出
       - status=need_fix 把 issues 回塞 skill 01，再来一轮
  保底：最多 MAX_ROUNDS 轮后无论 ok 与否都落盘，tamper_ok 标记真实状态。

【用法】
  python scripts/text_annotator.py                   # 跑全部
  python scripts/text_annotator.py --limit 3         # 冒烟：只跑前 3 段
  python scripts/text_annotator.py --only 7.1,7.2    # 指定段
  python scripts/text_annotator.py --resume          # 保留已完成段
  python scripts/text_annotator.py --no-reflect      # 只做标注+tamper，不进反思（加速）
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from llm_client import chat, stats  # noqa: E402

CHAPTERS_JSON = ROOT / "TotalData/ProcessedData/xiangyu/xiangyu_chapters.json"
OUT_JSON      = ROOT / "TotalData/ProcessedData/xiangyu/xiangyu_annotated.json"
OUT_MD        = ROOT / "TotalData/ProcessedData/xiangyu/xiangyu_annotated.md"

SKILL_META   = (ROOT / "skills/00_meta_instructions.md").read_text(encoding="utf-8")
SKILL_ANNOT  = (ROOT / "skills/01_entity_annotation.md").read_text(encoding="utf-8")
SKILL_REFLECT= (ROOT / "skills/03_reflection_check.md").read_text(encoding="utf-8")

MAX_ROUNDS = 3
# XML 标签清洗（开/闭合/自闭合）
TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")
# 抓 markdown 代码围栏（LLM 偶尔忘了约束会加）
FENCE_RE = re.compile(r"^```[a-zA-Z0-9_\-]*\s*\n(.*?)\n```\s*$", re.DOTALL)

# LLM 喜欢把中文标点"归一化"成半角——这里做安全的反向映射
# 只覆盖视觉同形的标点类，绝不触碰汉字
PUNCT_EQUIV: dict[str, set[str]] = {
    "\u201c": {"\""},          # “ -> "
    "\u201d": {"\""},          # ” -> "
    "\u2018": {"'"},           # ‘ -> '
    "\u2019": {"'"},           # ’ -> '
    "\uff0c": {","},           # ， -> ,
    "\u3002": {"."},           # 。 -> .
    "\uff1a": {":"},           # ： -> :
    "\uff1b": {";"},           # ； -> ;
    "\uff1f": {"?"},           # ？ -> ?
    "\uff01": {"!"},           # ！ -> !
    "\uff08": {"("},           # （ -> (
    "\uff09": {")"},           # ） -> )
    "\u3001": {",", "、"},     # 、 -> , or 、
}


# ----------------------------------------------------------------- helpers

def strip_tags(s: str) -> str:
    return TAG_RE.sub("", s)


def peel_fence(s: str) -> str:
    """如果整段被 ``` 围栏包了，就脱掉。"""
    s = s.strip()
    m = FENCE_RE.match(s)
    if m:
        return m.group(1).strip()
    return s


def _char_equiv(orig_ch: str, ann_ch: str) -> bool:
    """允许 LLM 把中文标点写成半角（但只在 PUNCT_EQUIV 里声明的那些）。"""
    if orig_ch == ann_ch:
        return True
    eq = PUNCT_EQUIV.get(orig_ch)
    return bool(eq and ann_ch in eq)


def repair_punctuation(annotated: str, original: str) -> str:
    """
    双游标扫描：annotated 的"标签外字符"逐字对齐 original；
    若当前字符与 original 等价（按 PUNCT_EQUIV），就强制写回 original 的字符。
    若不等价直接停止修复，返回当前结果（让 tamper_check 报错）。
    """
    out: list[str] = []
    i = 0  # annotated index
    j = 0  # original index
    n = len(annotated)
    m = len(original)
    while i < n:
        # 1) 遇到标签：整段复制跳过
        tag_m = TAG_RE.match(annotated, i)
        if tag_m:
            out.append(tag_m.group(0))
            i = tag_m.end()
            continue
        # 2) 普通字符
        if j >= m:
            # annotated 比 original 多出内容，交给 tamper 报错
            out.append(annotated[i:])
            break
        ann_ch = annotated[i]
        orig_ch = original[j]
        if ann_ch == orig_ch:
            out.append(ann_ch)
        elif _char_equiv(orig_ch, ann_ch):
            out.append(orig_ch)  # 用原文的字符覆盖
        else:
            # 失败：原样放回，交给 tamper 报错
            out.append(annotated[i:])
            break
        i += 1
        j += 1
    return "".join(out)


def tamper_check(annotated: str, original: str) -> tuple[bool, str]:

    stripped = strip_tags(annotated)
    if stripped == original:
        return True, ""
    n = min(len(stripped), len(original))
    diff_pos = n
    for i in range(n):
        if stripped[i] != original[i]:
            diff_pos = i
            break
    ctx_from = max(0, diff_pos - 10)
    ctx_to_orig = min(len(original), diff_pos + 20)
    ctx_to_strp = min(len(stripped), diff_pos + 20)
    msg = (
        f"TamperCheck FAILED at char {diff_pos}. "
        f"len(original)={len(original)} len(stripped)={len(stripped)}. "
        f"original[{ctx_from}:{ctx_to_orig}]={original[ctx_from:ctx_to_orig]!r} ; "
        f"stripped[{ctx_from}:{ctx_to_strp}]={stripped[ctx_from:ctx_to_strp]!r}"
    )
    return False, msg


def extract_json_block(s: str) -> str:
    """取第一个 ```json ... ``` 里的内容，没有就返回原串。"""
    m = re.search(r"```(?:json)?\s*\n(.*?)\n```", s, re.DOTALL)
    if m:
        return m.group(1).strip()
    return s.strip()


def parse_reflection(s: str) -> dict | None:
    body = extract_json_block(s)
    try:
        return json.loads(body)
    except Exception:
        m = re.search(r"\{.*\}", body, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


# ----------------------------------------------------------------- llm wrappers

def _timed_chat(tag: str, messages: list[dict]) -> str:
    t0 = time.time()
    try:
        reply = chat(messages)
    finally:
        dt = time.time() - t0
        print(f"    [{tag}] llm {dt:.1f}s", flush=True)
    return reply


def annotate_once(
    text: str,
    *,
    pid: str,
    issues: list | None = None,
    tamper_hint: str = "",
) -> str:
    user_parts = [
        "# 原文（必须原样出现在 strip 后的输出里）\n",
        text,
        "\n",
    ]
    if issues:
        user_parts.append(
            "\n# 上一轮反思检查发现的问题（请整段重写，修复下列问题）：\n"
            + json.dumps(issues, ensure_ascii=False, indent=2)
            + "\n"
        )
    if tamper_hint:
        user_parts.append(
            "\n# 【严重】上一轮 Zero-Tampering 失败，必须严格保持原文字节不变。\n"
            "常见错误：把规范名写成了标签体（比如 `<p name=\"项羽\">项羽</p>项籍` 让项羽/项籍都出现了），"
            "正确做法是 `<p name=\"项羽\">项籍</p>`（标签体必须是原文连续子串）。\n"
            f"检测器提示：{tamper_hint}\n"
        )
    user_parts.append(
        "\n请严格按 skill 01 (XML 标签版) 对上面的原文插入 `<p>/<loc>/<geo>/<off>/<time>/<evt>/<art>/<ruin>` 标签。"
        "\n直接返回标注后的正文，不要代码围栏、不要解释、不要前后加字。"
    )
    user = "".join(user_parts)
    messages = [
        {"role": "system", "content": SKILL_META + "\n\n" + SKILL_ANNOT},
        {"role": "user",   "content": user},
    ]
    return _timed_chat(f"annot {pid}", messages).strip()


def reflect_once(original: str, annotated: str, *, pid: str) -> dict | None:
    user = (
        "# 原文\n" + original + "\n\n"
        "# 上一轮标注\n" + annotated + "\n\n"
        "请按 skill 03 (XML 版) 输出校验 JSON。"
    )
    messages = [
        {"role": "system", "content": SKILL_META + "\n\n" + SKILL_REFLECT},
        {"role": "user",   "content": user},
    ]
    raw = _timed_chat(f"refl  {pid}", messages)
    return parse_reflection(raw)


# ----------------------------------------------------------------- main loop

def process_paragraph(
    p: dict, *, max_rounds: int = MAX_ROUNDS, do_reflect: bool = True
) -> dict:
    text = p["text"]
    pid  = p["pid"]
    annotated = ""
    reflection: dict | None = None
    tamper_ok = False
    tamper_hint = ""
    issues: list = []
    round_i = 0

    for round_i in range(1, max_rounds + 1):
        annotated = annotate_once(text, pid=pid, issues=issues or None, tamper_hint=tamper_hint)
        annotated = peel_fence(annotated)
        # 先尝试修复"半角中文标点"这类无害漂移（“ → "、, 等）
        repaired = repair_punctuation(annotated, text)
        if repaired != annotated:
            annotated = repaired
        tamper_ok, tamper_hint = tamper_check(annotated, text)

        if not tamper_ok:
            print(f"  [{pid}] round {round_i}: TAMPER fail — {tamper_hint[:160]}", flush=True)
            issues = []
            if round_i < max_rounds:
                continue
            else:
                print(f"  [{pid}] round {round_i}: TAMPER still fail, giving up", flush=True)
                break

        if not do_reflect:
            print(f"  [{pid}] round {round_i}: TAMPER ok (no-reflect mode) ✅", flush=True)
            break

        reflection = reflect_once(text, annotated, pid=pid)
        if reflection is None:
            print(f"  [{pid}] round {round_i}: reflection parse FAIL, accept as-is", flush=True)
            break
        status = reflection.get("status")
        n_issues = len(reflection.get("issues", []) or [])
        if status == "ok":
            print(f"  [{pid}] round {round_i}: REFLECT ok (issues={n_issues}) ✅", flush=True)
            break
        issues = reflection.get("issues", []) or []
        print(f"  [{pid}] round {round_i}: REFLECT need_fix (issues={n_issues}), retry", flush=True)
        tamper_hint = ""
        if round_i == max_rounds:
            print(f"  [{pid}] round {round_i}: reached max_rounds with unresolved issues", flush=True)

    return {
        "pid": pid,
        "text": text,
        "annotated": annotated,
        "rounds": round_i,
        "tamper_ok": tamper_ok,
        "reflection": reflection,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="只处理前 N 段（冒烟）")
    ap.add_argument("--only", type=str, default="", help="逗号分隔 pid 列表")
    ap.add_argument("--resume", action="store_true", help="保留已 tamper_ok 的段")
    ap.add_argument("--no-reflect", action="store_true", help="关闭反思，只做标注+tamper")
    ap.add_argument("--max-rounds", type=int, default=MAX_ROUNDS)
    args = ap.parse_args()

    if not CHAPTERS_JSON.exists():
        print(f"[ERR] {CHAPTERS_JSON} not found. run structure_splitter.py first.", file=sys.stderr)
        return 2

    src = json.loads(CHAPTERS_JSON.read_text(encoding="utf-8"))
    paragraphs = src["paragraphs"]

    if args.only:
        want = {x.strip() for x in args.only.split(",") if x.strip()}
        paragraphs = [p for p in paragraphs if p["pid"] in want]
    if args.limit > 0:
        paragraphs = paragraphs[: args.limit]

    existing: dict[str, dict] = {}
    if args.resume and OUT_JSON.exists():
        try:
            prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
            for rp in prev.get("paragraphs", []):
                if rp.get("tamper_ok"):
                    existing[rp["pid"]] = rp
        except Exception:
            pass

    results: list[dict] = []
    t0 = time.time()
    for i, p in enumerate(paragraphs, 1):
        if p["pid"] in existing:
            print(f"[{i}/{len(paragraphs)}] {p['pid']} — SKIP (resume)", flush=True)
            results.append(existing[p["pid"]])
            continue
        print(f"[{i}/{len(paragraphs)}] {p['pid']} — processing ({len(p['text'])} chars)", flush=True)
        try:
            r = process_paragraph(p, max_rounds=args.max_rounds, do_reflect=not args.no_reflect)
        except Exception as e:
            print(f"  [{p['pid']}] EXCEPTION: {e}", file=sys.stderr, flush=True)
            r = {"pid": p["pid"], "text": p["text"], "annotated": "",
                 "rounds": 0, "tamper_ok": False, "reflection": None, "error": str(e)}
        results.append(r)
        _save(src, results)

    dt = time.time() - t0
    print("-" * 40)
    print(f"[DONE] {len(results)} paragraphs in {dt:.1f}s")
    ok = sum(1 for x in results if x.get("tamper_ok"))
    print(f"[STAT] tamper_ok = {ok}/{len(results)}")
    print(stats.report())
    return 0 if ok == len(results) else 1


def _save(src: dict, results: list[dict]) -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "work": src["work"],
        "chapter": src["chapter"],
        "chapter_num": src["chapter_num"],
        "paragraph_count_total": src["paragraph_count"],
        "paragraph_count_done": len(results),
        "paragraphs": results,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [f"# {src['work']}·{src['chapter']}（标注版·XML）", ""]
    for r in results:
        flag = "✅" if r.get("tamper_ok") else "⚠️"
        lines.append(f"### [{r['pid']}] {flag} (rounds={r.get('rounds',0)})")
        lines.append("")
        lines.append("```xml")
        lines.append(r.get("annotated") or "(empty)")
        lines.append("```")
        lines.append("")
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
