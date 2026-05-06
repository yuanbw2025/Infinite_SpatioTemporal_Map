"""
订阅模式实体提取 — 批次准备脚本

用法：
    python3 scripts/prepare_batch.py --batch-size 5 --start 0

功能：
    1. 从 TotalData/ProcessedData/ershisi_full_texts/ 读取章节文件
    2. 跳过极短文件（目录、封面等）
    3. 将文本内容 + 提取指令打包输出到 TotalData/ProcessedData/llm_batches/ 目录
    4. 每个批次生成一个 .md 文件，包含若干章节的原文和提取指令
    5. 用户将 .md 文件的内容粘贴到 AI 对话中（或在对话中直接让模型读取文件）
    6. 模型返回 JSON 结果后，用 save_batch_result.py 保存

输出示例：
    TotalData/ProcessedData/llm_batches/batch_000.md
    TotalData/ProcessedData/llm_batches/batch_001.md
    ...
"""

import os
import json
import argparse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(PROJECT_ROOT, "TotalData", "ProcessedData", "ershisi_full_texts")
BATCH_DIR = os.path.join(PROJECT_ROOT, "TotalData", "ProcessedData", "llm_batches")
RESULT_DIR = os.path.join(PROJECT_ROOT, "TotalData", "ProcessedData", "llm_results")
MIN_FILE_SIZE = 500  # 跳过小于 500 字节的文件

EXTRACTION_PROMPT = """你是一个中国古代史料实体提取专家。请从以下《二十四史》原文中提取所有实体。

## 提取规则（必须严格遵守）

1. **人名**：提取所有出现的真实历史人物姓名（2-4个字）。只提取人名本身，不要带官职或称号。
   - 正确：`项羽`、`刘邦`、`韩信`
   - 错误：`高祖`（这是称号不是名字，但如果文中"高祖"指代特定人物且无法确定真名，也可保留）
   - 错误：`项羽本纪`（这是章节名不是人名）

2. **地名**：提取所有出现的地理名称（2-6个字）。包括古代地名。
   - 正确：`下相`、`彭城`、`咸阳`、`会稽`
   - 错误：`天下`、`中国`（太泛泛）

3. **官职**：提取出现的官职名称。
   - 例：`知县`、`太守`、`丞相`、`御史大夫`

4. **时间**：提取明确的时间表述，转换为公元纪年。
   - 例：`秦二世元年` → `-209`

## 输出格式（必须严格遵守，只输出 JSON，不要输出其他任何文字）

```json
{
  "file": "文件名",
  "persons": ["人名1", "人名2", ...],
  "places": ["地名1", "地名2", ...],
  "officials": ["官职1", "官职2", ...],
  "events": [
    {"person": "人名", "location": "地名", "role": "官职", "year": 公元年份或null}
  ]
}
```

注意：events 只记录文中明确关联的"人-地-职"三元组，不要猜测。year 如果无法确定就写 null。
"""


def get_content_files():
    """获取所有有实质内容的章节文件，按文件名排序"""
    files = []
    for fname in sorted(os.listdir(SRC_DIR)):
        if not fname.endswith('.txt'):
            continue
        fpath = os.path.join(SRC_DIR, fname)
        if os.path.getsize(fpath) >= MIN_FILE_SIZE:
            files.append(fname)
    return files


def prepare_batches(batch_size=5, start=0):
    """将章节文件分批，生成提示词文件"""
    os.makedirs(BATCH_DIR, exist_ok=True)

    files = get_content_files()
    total = len(files)
    print(f"共 {total} 个有效章节文件（跳过了 <{MIN_FILE_SIZE} 字节的文件）")

    batch_idx = 0
    for i in range(start, total, batch_size):
        batch_files = files[i:i + batch_size]
        batch_name = f"batch_{batch_idx:03d}.md"
        batch_path = os.path.join(BATCH_DIR, batch_name)

        with open(batch_path, 'w', encoding='utf-8') as out:
            out.write(f"# 实体提取批次 {batch_idx}（共 {len(batch_files)} 个章节）\n\n")
            out.write(EXTRACTION_PROMPT)
            out.write("\n\n---\n\n")

            for fname in batch_files:
                fpath = os.path.join(SRC_DIR, fname)
                with open(fpath, 'r', encoding='utf-8') as f:
                    text = f.read()

                # 如果文本太长（>8000字），截取前8000字
                if len(text) > 8000:
                    text = text[:8000] + "\n\n[...文本过长，已截断...]"

                out.write(f"## 文件：{fname}\n\n")
                out.write(f"```text\n{text}\n```\n\n")
                out.write(f"请输出该章节的 JSON 结果（文件名为 `{fname}`）：\n\n")
                out.write("---\n\n")

        print(f"  ✅ {batch_name}: {len(batch_files)} 个章节 ({', '.join(batch_files)})")
        batch_idx += 1

    # 生成批次索引文件
    index = {
        "total_files": total,
        "batch_size": batch_size,
        "total_batches": batch_idx,
        "status": {f"batch_{i:03d}": "pending" for i in range(batch_idx)}
    }
    index_path = os.path.join(BATCH_DIR, "batch_index.json")
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"\n共生成 {batch_idx} 个批次文件，索引已保存至 {index_path}")
    print(f"\n📋 使用方法：")
    print(f"  1. 在 AI 对话中，让模型读取 TotalData/ProcessedData/llm_batches/batch_000.md")
    print(f"  2. 模型会返回每个章节的 JSON 实体数据")
    print(f"  3. 运行 python3 scripts/save_batch_result.py --batch 0 --input result.json 保存结果")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="准备 LLM 实体提取批次")
    parser.add_argument("--batch-size", type=int, default=5, help="每批处理的章节数")
    parser.add_argument("--start", type=int, default=0, help="从第几个文件开始")
    args = parser.parse_args()
    prepare_batches(args.batch_size, args.start)
