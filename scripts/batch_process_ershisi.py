#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
batch_process_ershisi.py — 二十四史全量批处理（466 章）

【功能】
1. 读取 app/public/data/ershisi_full_texts/*.txt（466 章原文）
2. 对每章调用 text_annotator 逻辑（XML 标注 + 反思校验）
3. 对每章调用 build_map_data 逻辑（CHGIS + 手工字典坐标匹配）
4. 输出：
   - TotalData/ProcessedData/ershisi_annotated/{chapter_id}_annotated.json
   - app/public/data/ershisi_locations/{chapter_id}_locations.json

【用法】
  python scripts/batch_process_ershisi.py                # 全量处理 466 章
  python scripts/batch_process_ershisi.py --limit 3      # 冒烟：只跑前 3 章
  python scripts/batch_process_ershisi.py --resume       # 跳过已完成的章节
  python scripts/batch_process_ershisi.py --chapters 006,007  # 指定章节
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from collections import OrderedDict

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from llm_client import chat, stats  # noqa: E402

# ========== 路径配置 ==========
TEXTS_DIR = ROOT / "app/public/data/ershisi_full_texts"
OUT_ANNOTATED_DIR = ROOT / "TotalData/ProcessedData/ershisi_annotated"
OUT_LOCATIONS_DIR = ROOT / "app/public/data/ershisi_locations"
GIS_DIR = ROOT / "TotalData/GISData"

OUT_ANNOTATED_DIR.mkdir(parents=True, exist_ok=True)
OUT_LOCATIONS_DIR.mkdir(parents=True, exist_ok=True)

# ========== 加载 Skills ==========
SKILL_META = (ROOT / "skills/00_meta_instructions.md").read_text(encoding="utf-8")
SKILL_ANNOT = (ROOT / "skills/01_entity_annotation.md").read_text(encoding="utf-8")
SKILL_REFLECT = (ROOT / "skills/03_reflection_check.md").read_text(encoding="utf-8")

# ========== 标注相关常量 ==========
MAX_ROUNDS = 3
TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")
FENCE_RE = re.compile(r"^```[a-zA-Z0-9_\-]*\s*\n(.*?)\n```\s*$", re.DOTALL)

# 中文标点等价映射（允许 LLM 把全角标点写成半角）
PUNCT_EQUIV: dict[str, set[str]] = {
    "\u201c": {"\""},
    "\u201d": {"\""},
    "\u2018": {"'"},
    "\u2019": {"'"},
    "\uff0c": {","},
    "\u3002": {"."},
    "\uff1a": {":"},
    "\uff1b": {";"},
    "\uff1f": {"?"},
    "\uff01": {"!"},
    "\uff08": {"("},
    "\uff09": {")"},
    "\u3001": {",", "、"},
}

# ========== 坐标匹配：手工字典（秦汉至明清常见地名） ==========
# 这是从 build_xiangyu_map_data.py 复制过来的，后续可以扩充
MANUAL_COORDS = {
    "下相": [118.30, 33.96], "项": [116.06, 33.47], "吴中": [120.62, 31.30],
    "会稽": [120.58, 30.00], "大泽中": [117.10, 33.75], "广陵": [119.43, 32.39],
    "东阳": [118.85, 32.93], "下邳": [117.95, 34.31], "彭城": [117.19, 34.26],
    "胡陵": [116.60, 34.95], "薛": [117.13, 34.88], "襄城": [113.48, 33.85],
    "沛": [116.93, 34.73], "居鄛": [117.38, 31.45], "盱台": [118.54, 33.01],
    "亢父": [116.98, 35.38], "东阿": [116.25, 36.33], "城阳": [118.31, 35.58],
    "濮阳": [115.03, 35.76], "定陶": [115.57, 35.07], "雍丘": [114.77, 34.52],
    "外黄": [115.02, 34.67], "陈留": [114.80, 34.38], "砀": [116.35, 34.43],
    "巨鹿": [115.18, 37.22], "棘原": [114.35, 36.38], "咸阳": [108.72, 34.33],
    "新安": [111.72, 34.73], "殷虚": [114.30, 36.12], "函谷关": [110.87, 34.52],
    "戏西": [109.20, 34.38], "霸上": [109.05, 34.20], "鸿门": [109.22, 34.35],
    "新丰": [109.25, 34.38], "关中": [108.90, 34.26], "山东": [116.00, 35.00],
    "郦山": [109.10, 34.36], "芷阳": [109.10, 34.28], "废丘": [108.40, 34.33],
    "栎阳": [109.22, 34.67], "高奴": [109.49, 36.60], "上郡": [109.95, 38.28],
    "平阳": [111.67, 36.10], "河东": [110.99, 34.83], "雒阳": [112.45, 34.62],
    "阳翟": [113.55, 34.15], "河内": [113.25, 35.08], "朝歌": [114.20, 35.62],
    "襄国": [114.50, 37.05], "六": [116.78, 31.75], "邾": [114.88, 30.38],
    "江陵": [112.19, 30.33], "南郡": [112.19, 30.33], "蓟": [116.40, 39.90],
    "临菑": [118.31, 36.88], "博阳": [117.12, 36.20], "南皮": [116.70, 38.03],
    "安阳": [114.35, 36.10], "无盐": [116.30, 35.80], "三户": [113.78, 36.28],
    "荥阳": [113.38, 34.78], "成皋": [113.23, 34.75], "广武": [113.35, 34.82],
    "敖仓": [113.40, 34.80], "鸿沟": [113.50, 34.75], "巴": [106.57, 29.56],
    "蜀": [104.07, 30.67], "汉中": [107.02, 33.07], "南郑": [106.94, 33.07],
    "三秦": [108.90, 34.26], "垓下": [117.10, 33.35], "阴陵": [117.55, 33.08],
    "东城": [118.02, 32.30], "乌江": [118.38, 31.57], "瑕丘": [116.78, 35.55],
    "胶东": [121.00, 37.10], "即墨": [120.45, 36.38], "梁地": [115.65, 34.45],
    "代": [114.47, 39.37], "常山": [114.50, 38.05], "九江": [116.00, 30.50],
    "辽东": [123.18, 41.27], "济北": [116.97, 36.65], "长沙": [112.97, 28.23],
    "郴县": [113.03, 25.77], "无终": [117.60, 39.88], "戏下": [109.20, 34.38],
    "阳夏": [114.88, 33.78], "固陵": [114.88, 33.73], "寿春": [116.50, 32.00],
    "城父": [115.98, 33.63], "舒": [117.05, 31.00], "睢阳": [115.65, 34.45],
    "谷城": [115.95, 35.97], "修武": [113.45, 35.22], "宛": [112.53, 33.00],
    "叶": [113.35, 33.62], "巩": [113.02, 34.75], "下邑": [116.08, 34.27],
    "灵壁": [117.55, 33.55], "萧": [116.95, 34.19], "鲁": [117.00, 35.60],
    "中水": [116.43, 38.23], "杜衍": [112.37, 35.12], "赤泉": [113.22, 34.77],
    "吴防": [116.78, 31.03], "涅阳": [112.15, 33.22], "北海": [118.77, 36.78],
    "平原": [116.43, 37.17], "陈": [114.88, 33.73], "鄢郢": [112.20, 30.33],
    "马服": [114.47, 36.40], "榆中": [104.10, 35.85], "阳周": [109.37, 36.78],
    "蕲": [117.00, 33.50], "秦中": [108.90, 34.26], "秦地": [108.90, 34.26],
    "楚地": [117.19, 34.26], "楚国": [117.19, 34.26], "楚": [117.19, 34.26],
    "秦": [108.90, 34.26], "赵": [114.50, 37.05], "齐": [118.31, 36.88],
    "汉": [107.02, 33.07], "韩": [113.55, 34.15], "江东": [120.00, 31.50],
    "河北": [114.50, 37.00], "河南": [113.00, 34.50], "江西": [116.00, 33.00],
    "司马门": [108.72, 34.33], "梁": [115.65, 34.45], "东海": [119.18, 34.75],
    "赵地": [114.50, 37.05], "栗": [115.78, 34.08],
    # 补充常见地名
    "洛阳": [112.45, 34.62], "长安": [108.90, 34.26], "北京": [116.40, 39.90],
    "南京": [118.78, 32.06], "开封": [114.35, 34.80], "杭州": [120.16, 30.25],
    "苏州": [120.62, 31.30], "扬州": [119.43, 32.39], "成都": [104.07, 30.67],
    "西安": [108.90, 34.26], "太原": [112.55, 37.87], "济南": [117.00, 36.65],
}

# ========== 辅助函数 ==========

def strip_tags(s: str) -> str:
    return TAG_RE.sub("", s)

def peel_fence(s: str) -> str:
    s = s.strip()
    m = FENCE_RE.match(s)
    return m.group(1).strip() if m else s

def _char_equiv(orig_ch: str, ann_ch: str) -> bool:
    if orig_ch == ann_ch:
        return True
    eq = PUNCT_EQUIV.get(orig_ch)
    return bool(eq and ann_ch in eq)

def repair_punctuation(annotated: str, original: str) -> str:
    out: list[str] = []
    i = j = 0
    n, m = len(annotated), len(original)
    while i < n:
        tag_m = TAG_RE.match(annotated, i)
        if tag_m:
            out.append(tag_m.group(0))
            i = tag_m.end()
            continue
        if j >= m:
            out.append(annotated[i:])
            break
        ann_ch, orig_ch = annotated[i], original[j]
        if ann_ch == orig_ch:
            out.append(ann_ch)
        elif _char_equiv(orig_ch, ann_ch):
            out.append(orig_ch)
        else:
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
    m = re.search(r"```(?:json)?\s*\n(.*?)\n```", s, re.DOTALL)
    return m.group(1).strip() if m else s.strip()

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

# ========== LLM 调用 ==========

def annotate_once(text: str, *, chapter_id: str, issues: list | None = None, tamper_hint: str = "") -> str:
    user_parts = ["# 原文（必须原样出现在 strip 后的输出里）\n", text, "\n"]
    if issues:
        user_parts.append(
            "\n# 上一轮反思检查发现的问题（请整段重写，修复下列问题）：\n"
            + json.dumps(issues, ensure_ascii=False, indent=2) + "\n"
        )
    if tamper_hint:
        user_parts.append(
            "\n# 【严重】上一轮 Zero-Tampering 失败，必须严格保持原文字节不变。\n"
            f"检测器提示：{tamper_hint}\n"
        )
    user_parts.append(
        "\n请严格按 skill 01 (XML 标签版) 对上面的原文插入 `<p>/<loc>/<geo>/<off>/<time>/<evt>/<art>/<ruin>` 标签。"
        "\n直接返回标注后的正文，不要代码围栏、不要解释、不要前后加字。"
    )
    messages = [
        {"role": "system", "content": SKILL_META + "\n\n" + SKILL_ANNOT},
        {"role": "user", "content": "".join(user_parts)},
    ]
    return chat(messages).strip()

def reflect_once(original: str, annotated: str, *, chapter_id: str) -> dict | None:
    user = (
        "# 原文\n" + original + "\n\n"
        "# 上一轮标注\n" + annotated + "\n\n"
        "请按 skill 03 (XML 版) 输出校验 JSON。"
    )
    messages = [
        {"role": "system", "content": SKILL_META + "\n\n" + SKILL_REFLECT},
        {"role": "user", "content": user},
    ]
    raw = chat(messages)
    return parse_reflection(raw)

# ========== 标注主流程 ==========

def split_paragraphs(text: str, max_len: int = 1500) -> list[str]:
    """将长文本按段落切分，每段不超过 max_len 字符（降低到 1500 避免 API 超时）"""
    paragraphs = []
    current = []
    current_len = 0
    
    for line in text.split('\n'):
        line_len = len(line) + 1  # +1 for newline
        if current_len + line_len > max_len and current:
            paragraphs.append('\n'.join(current))
            current = [line]
            current_len = line_len
        else:
            current.append(line)
            current_len += line_len
    
    if current:
        paragraphs.append('\n'.join(current))
    
    return paragraphs

def annotate_paragraph(text: str, chapter_id: str, para_idx: int, max_rounds: int = 2) -> dict:
    """对单个段落进行标注（简化版，只做 1-2 轮）"""
    annotated = ""
    tamper_ok = False
    tamper_hint = ""
    round_i = 0

    for round_i in range(1, max_rounds + 1):
        try:
            # 添加延迟避免限流
            if para_idx > 1:
                time.sleep(2)  # 每段之间等待 2 秒
            
            annotated = annotate_once(text, chapter_id=f"{chapter_id}_p{para_idx}", issues=None, tamper_hint=tamper_hint)
            annotated = peel_fence(annotated)
            repaired = repair_punctuation(annotated, text)
            if repaired != annotated:
                annotated = repaired
            tamper_ok, tamper_hint = tamper_check(annotated, text)

            if tamper_ok:
                break
            elif round_i < max_rounds:
                print(f"      para {para_idx} round {round_i}: TAMPER fail, retry", flush=True)
                time.sleep(1)  # 重试前等待
        except Exception as e:
            print(f"      para {para_idx} round {round_i}: ERROR {e}", flush=True)
            if round_i == max_rounds:
                annotated = text  # 失败就用原文
                tamper_ok = False
                break
            time.sleep(3)  # 错误后等待更久

    return {
        "text": text,
        "annotated": annotated,
        "tamper_ok": tamper_ok,
        "rounds": round_i,
    }

def annotate_chapter(text: str, chapter_id: str, max_rounds: int = MAX_ROUNDS) -> dict:
    """对单章文本进行标注（长文本自动分段）"""
    # 如果文本太长（>3000 字），分段处理
    if len(text) > 3000:
        print(f"    [{chapter_id}] 文本过长 ({len(text)} 字)，分段处理", flush=True)
        paragraphs = split_paragraphs(text, max_len=1500)
        print(f"    [{chapter_id}] 切分为 {len(paragraphs)} 段", flush=True)
        
        annotated_parts = []
        all_tamper_ok = True
        
        for i, para in enumerate(paragraphs, 1):
            if not para.strip():
                annotated_parts.append(para)
                continue
            
            print(f"    [{chapter_id}] 处理段落 {i}/{len(paragraphs)} ({len(para)} 字)", flush=True)
            result = annotate_paragraph(para, chapter_id, i, max_rounds=2)
            annotated_parts.append(result["annotated"])
            if not result["tamper_ok"]:
                all_tamper_ok = False
        
        annotated = '\n'.join(annotated_parts)
        tamper_ok = all_tamper_ok
        reflection = None
        round_i = 1
    else:
        # 短文本：原有逻辑
        annotated = ""
        reflection: dict | None = None
        tamper_ok = False
        tamper_hint = ""
        issues: list = []
        round_i = 0

        for round_i in range(1, max_rounds + 1):
            annotated = annotate_once(text, chapter_id=chapter_id, issues=issues or None, tamper_hint=tamper_hint)
            annotated = peel_fence(annotated)
            repaired = repair_punctuation(annotated, text)
            if repaired != annotated:
                annotated = repaired
            tamper_ok, tamper_hint = tamper_check(annotated, text)

            if not tamper_ok:
                print(f"    [{chapter_id}] round {round_i}: TAMPER fail — {tamper_hint[:100]}", flush=True)
                issues = []
                if round_i < max_rounds:
                    continue
                else:
                    print(f"    [{chapter_id}] round {round_i}: TAMPER still fail, giving up", flush=True)
                    break

            reflection = reflect_once(text, annotated, chapter_id=chapter_id)
            if reflection is None:
                print(f"    [{chapter_id}] round {round_i}: reflection parse FAIL, accept as-is", flush=True)
                break
            status = reflection.get("status")
            n_issues = len(reflection.get("issues", []) or [])
            if status == "ok":
                print(f"    [{chapter_id}] round {round_i}: REFLECT ok (issues={n_issues}) ✅", flush=True)
                break
            issues = reflection.get("issues", []) or []
            print(f"    [{chapter_id}] round {round_i}: REFLECT need_fix (issues={n_issues}), retry", flush=True)
            tamper_hint = ""
            if round_i == max_rounds:
                print(f"    [{chapter_id}] round {round_i}: reached max_rounds with unresolved issues", flush=True)

    return {
        "chapter_id": chapter_id,
        "text": text,
        "annotated": annotated,
        "rounds": round_i,
        "tamper_ok": tamper_ok,
        "reflection": reflection if len(text) <= 5000 else None,
    }

# ========== 坐标匹配 ==========

def load_chgis():
    """加载 CHGIS v6 数据"""
    import shapefile
    result = {}
    for subdir, fname in [
        ("v6_time_pref_pts_utf_wgs84", "v6_time_pref_pts_utf_wgs84.shp"),
        ("v6_time_cnty_pts_utf_wgs84", "v6_time_cnty_pts_utf_wgs84.shp"),
    ]:
        shp_path = GIS_DIR / subdir / fname
        if not shp_path.exists():
            continue
        sf = shapefile.Reader(str(shp_path))
        for rec in sf.records():
            name = rec.NAME_CH
            if name and name not in result:
                result[name] = [rec.X_COOR, rec.Y_COOR]
    print(f"  ✅ CHGIS 加载完成: {len(result)} 条")
    return result

def extract_locations(annotated: str) -> OrderedDict:
    """从标注文本提取所有 <loc> 和 <geo> 标签内的地名"""
    loc_set = OrderedDict()
    loc_pattern = re.compile(r'<loc>(.*?)</loc>')
    geo_pattern = re.compile(r'<geo>(.*?)</geo>')
    
    for m in loc_pattern.finditer(annotated):
        name = m.group(1)
        if name not in loc_set:
            loc_set[name] = 0
        loc_set[name] += 1
    for m in geo_pattern.finditer(annotated):
        name = m.group(1)
        if name not in loc_set:
            loc_set[name] = 0
        loc_set[name] += 1
    
    return loc_set

def resolve_coordinates(loc_dict: OrderedDict, chgis: dict, manual: dict) -> tuple[list, int, list]:
    """匹配每个地名的坐标"""
    results = []
    matched = 0
    missed = []
    
    for name, count in loc_dict.items():
        coord = None
        source = None
        
        if name in manual:
            coord = manual[name]
            source = "manual"
        elif name in chgis:
            coord = chgis[name]
            source = "chgis_exact"
        else:
            for suffix in ['府', '县', '州', '厅', '路', '郡']:
                if name + suffix in chgis:
                    coord = chgis[name + suffix]
                    source = "chgis_fuzzy"
                    break
                if name.endswith(suffix) and name[:-1] in chgis:
                    coord = chgis[name[:-1]]
                    source = "chgis_fuzzy"
                    break
        
        if coord:
            matched += 1
            results.append({
                "name": name,
                "lng": round(coord[0], 4),
                "lat": round(coord[1], 4),
                "source": source,
                "count": count
            })
        else:
            missed.append(name)
    
    return results, matched, missed

# ========== 主流程 ==========

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="只处理前 N 章（冒烟）")
    ap.add_argument("--chapters", type=str, default="", help="逗号分隔章节 ID 列表")
    ap.add_argument("--resume", action="store_true", help="跳过已完成的章节")
    args = ap.parse_args()

    # 1. 扫描所有文本文件
    text_files = sorted(TEXTS_DIR.glob("*.txt"))
    if not text_files:
        print(f"[ERR] 未找到任何文本文件在 {TEXTS_DIR}", file=sys.stderr)
        return 2

    # 2. 过滤章节
    if args.chapters:
        want = {x.strip() for x in args.chapters.split(",") if x.strip()}
        text_files = [f for f in text_files if f.stem in want]
    if args.limit > 0:
        text_files = text_files[:args.limit]

    print(f"=" * 60)
    print(f"🚀 二十四史批量处理：共 {len(text_files)} 章")
    print(f"=" * 60)

    # 3. 加载 CHGIS（只加载一次）
    chgis = load_chgis()

    # 4. 逐章处理
    t0 = time.time()
    success_count = 0
    
    for i, text_file in enumerate(text_files, 1):
        chapter_id = text_file.stem
        out_annotated = OUT_ANNOTATED_DIR / f"{chapter_id}_annotated.json"
        out_locations = OUT_LOCATIONS_DIR / f"{chapter_id}_locations.json"

        # Resume 模式：跳过已完成的
        if args.resume and out_annotated.exists() and out_locations.exists():
            print(f"[{i}/{len(text_files)}] {chapter_id} — SKIP (已完成)", flush=True)
            success_count += 1
            continue

        print(f"[{i}/{len(text_files)}] {chapter_id} — 开始处理", flush=True)
        
        try:
            # 读取原文
            text = text_file.read_text(encoding="utf-8").strip()
            if not text:
                print(f"  ⚠️  {chapter_id} 文本为空，跳过")
                continue

            # Step 1: 标注
            result = annotate_chapter(text, chapter_id)
            
            # 保存标注结果
            out_annotated.write_text(
                json.dumps(result, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
            print(f"  ✅ 标注完成: {out_annotated.name}")

            # Step 2: 提取地名
            if result["tamper_ok"]:
                loc_dict = extract_locations(result["annotated"])
                print(f"  ✅ 提取地名: {len(loc_dict)} 个")

                # Step 3: 匹配坐标
                locations, matched, missed = resolve_coordinates(loc_dict, chgis, MANUAL_COORDS)
                match_rate = (matched * 100 // len(loc_dict)) if loc_dict else 0
                print(f"  ✅ 坐标匹配: {matched}/{len(loc_dict)} ({match_rate}%)")
                if missed:
                    print(f"  ⚠️  未匹配 ({len(missed)}): {missed[:10]}")

                # 保存坐标结果
                output = {
                    "chapter_id": chapter_id,
                    "location_count": len(locations),
                    "match_rate": match_rate,
                    "locations": locations
                }
                out_locations.write_text(
                    json.dumps(output, ensure_ascii=False, indent=2),
                    encoding="utf-8"
                )
                print(f"  ✅ 坐标输出: {out_locations.name}")
                success_count += 1
            else:
                print(f"  ⚠️  标注未通过 tamper check，跳过坐标匹配")

        except Exception as e:
            print(f"  ❌ 处理失败: {e}", file=sys.stderr)
            continue

    dt = time.time() - t0
    print("=" * 60)
    print(f"🎉 批量处理完成！")
    print(f"   总耗时: {dt/60:.1f} 分钟")
    print(f"   成功: {success_count}/{len(text_files)}")
    print(f"   {stats.report()}")
    print("=" * 60)
    
    return 0 if success_count == len(text_files) else 1


if __name__ == "__main__":
    sys.exit(main())
