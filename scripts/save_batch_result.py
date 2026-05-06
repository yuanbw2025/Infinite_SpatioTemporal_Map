"""
订阅模式实体提取 — 结果保存与合并脚本

用法：
    # 保存单个批次的结果（从文件读取）
    python3 scripts/save_batch_result.py --batch 0 --input result.json

    # 合并所有已完成批次的结果为最终的 TOTAL_ERSHISI_CLEAN_DATA.json
    python3 scripts/save_batch_result.py --merge

功能：
    1. 接收模型返回的 JSON 实体数据
    2. 校验数据格式（必须包含 file, persons, places 字段）
    3. 保存到 TotalData/ProcessedData/llm_results/batch_NNN.json
    4. 更新 batch_index.json 的状态
    5. --merge 模式下，合并所有已完成批次为前端可用的最终数据
"""

import os
import json
import argparse
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH_DIR = os.path.join(PROJECT_ROOT, "TotalData", "ProcessedData", "llm_batches")
RESULT_DIR = os.path.join(PROJECT_ROOT, "TotalData", "ProcessedData", "llm_results")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "app", "public", "data", "TOTAL_ERSHISI_CLEAN_DATA.json")
INDEX_PATH = os.path.join(BATCH_DIR, "batch_index.json")

# 垃圾检测黑名单
GARBAGE_NAMES = {
    '目录', '本纪', '列传', '世家', '帝纪', '未知', '前言', '卷一', '卷二',
    '史记', '汉书', '后汉书', '三国志', '晋书', '宋书', '南齐书', '梁书',
    '陈书', '魏书', '北齐书', '周书', '隋书', '南史', '北史', '旧唐书',
    '新唐书', '旧五代史', '新五代史', '宋史', '辽史', '金史', '元史', '明史',
    '天下', '中国', '百姓', '天子', '陛下', '皇帝', '太后',
}


def validate_chapter_result(data):
    """校验单个章节的提取结果"""
    errors = []

    if 'file' not in data:
        errors.append("缺少 'file' 字段")
    if 'persons' not in data:
        errors.append("缺少 'persons' 字段")
    elif not isinstance(data['persons'], list):
        errors.append("'persons' 必须是数组")
    if 'places' not in data:
        errors.append("缺少 'places' 字段")
    elif not isinstance(data['places'], list):
        errors.append("'places' 必须是数组")

    # 检查垃圾人名
    if 'persons' in data and isinstance(data['persons'], list):
        garbage = [p for p in data['persons'] if p in GARBAGE_NAMES or len(p) > 5]
        if garbage:
            errors.append(f"检测到疑似垃圾人名: {garbage}")

    return errors


def save_batch(batch_num, input_path):
    """保存单个批次的结果"""
    os.makedirs(RESULT_DIR, exist_ok=True)

    with open(input_path, 'r', encoding='utf-8') as f:
        results = json.load(f)

    # results 应该是一个列表，每个元素对应一个章节
    if isinstance(results, dict):
        results = [results]  # 兼容单个章节的情况

    print(f"📥 批次 {batch_num}: 接收到 {len(results)} 个章节的结果")

    all_errors = []
    for i, chapter in enumerate(results):
        errors = validate_chapter_result(chapter)
        if errors:
            print(f"  ⚠️ 章节 {i} ({chapter.get('file', '?')}): {errors}")
            all_errors.extend(errors)
        else:
            persons = chapter.get('persons', [])
            places = chapter.get('places', [])
            print(f"  ✅ {chapter['file']}: {len(persons)} 人物, {len(places)} 地名")

    if all_errors:
        print(f"\n⚠️ 共 {len(all_errors)} 个警告，但仍然保存（垃圾人名需要人工确认）")

    # 保存结果
    result_path = os.path.join(RESULT_DIR, f"batch_{batch_num:03d}.json")
    with open(result_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"💾 结果已保存至: {result_path}")

    # 更新索引
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, 'r') as f:
            index = json.load(f)
        index['status'][f"batch_{batch_num:03d}"] = "done"
        with open(INDEX_PATH, 'w') as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        done = sum(1 for v in index['status'].values() if v == 'done')
        total = len(index['status'])
        print(f"📊 总进度: {done}/{total} 批次已完成")


def merge_all():
    """合并所有已完成批次为最终数据文件"""
    if not os.path.exists(RESULT_DIR):
        print("❌ 没有任何已完成的批次结果")
        return

    result_files = sorted([f for f in os.listdir(RESULT_DIR) if f.endswith('.json')])
    if not result_files:
        print("❌ 没有任何已完成的批次结果")
        return

    # 收集所有章节的数据
    all_chapters = {}  # file -> data
    for rf in result_files:
        with open(os.path.join(RESULT_DIR, rf), 'r') as f:
            batch_data = json.load(f)
        for chapter in batch_data:
            fname = chapter.get('file', '')
            if fname:
                all_chapters[fname] = {
                    'persons': chapter.get('persons', []),
                    'places': chapter.get('places', []),
                    'officials': chapter.get('officials', []),
                    'events': chapter.get('events', []),
                }

    # 构建完整的 467 章数据（没有被处理过的章节保留空数据）
    all_files = sorted(os.listdir(os.path.join(PROJECT_ROOT, "TotalData", "ProcessedData", "ershisi_full_texts")))
    graph = []
    for fname in all_files:
        if not fname.endswith('.txt'):
            continue
        if fname in all_chapters:
            graph.append({'file': fname, 'data': all_chapters[fname]})
        else:
            graph.append({'file': fname, 'data': {'persons': [], 'places': [], 'officials': [], 'events': []}})

    # 统计
    total_persons = set()
    total_places = set()
    for ch in graph:
        total_persons.update(ch['data']['persons'])
        total_places.update(ch['data']['places'])
    chapters_with_data = sum(1 for ch in graph if ch['data']['persons'] or ch['data']['places'])

    # 输出
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'graph': graph}, f, ensure_ascii=False)

    print(f"✅ 合并完成！")
    print(f"  总章节: {len(graph)}")
    print(f"  有数据的章节: {chapters_with_data}")
    print(f"  唯一人物: {len(total_persons)}")
    print(f"  唯一地名: {len(total_places)}")
    print(f"  输出至: {OUTPUT_PATH}")

    # 自检：打印前 20 个人物
    sample = sorted(list(total_persons))[:20]
    print(f"  前 20 个人物: {sample}")

    # 垃圾检测
    garbage = [p for p in total_persons if p in GARBAGE_NAMES]
    if garbage:
        print(f"  ⚠️ 检测到垃圾人名: {garbage}")
    else:
        print(f"  ✅ 未检测到垃圾人名")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="保存/合并 LLM 提取结果")
    parser.add_argument("--batch", type=int, help="批次编号")
    parser.add_argument("--input", help="输入的 JSON 文件路径")
    parser.add_argument("--merge", action="store_true", help="合并所有批次为最终数据")
    args = parser.parse_args()

    if args.merge:
        merge_all()
    elif args.batch is not None and args.input:
        save_batch(args.batch, args.input)
    else:
        parser.print_help()
