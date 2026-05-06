# Gemini 实体提取工作协议（强制执行）

> **本文档是给 AI 模型的工作指令。任何模型在执行实体提取任务时，必须严格遵守本协议。**
> **违反任何一条规则等同于任务失败。**

---

## 一、你的任务

你需要读取 `TotalData/ProcessedData/llm_batches/` 目录下的批次文件（`batch_000.md`, `batch_001.md`, ...），从每个章节的原文中提取历史实体，输出结构化 JSON。

---

## 二、工作流程（每个批次必须严格执行以下 5 步）

### 步骤 1：读取批次文件
```bash
cat TotalData/ProcessedData/llm_batches/batch_NNN.md
```
读取完毕后，告诉用户："已读取 batch_NNN，包含 X 个章节，开始提取。"

### 步骤 2：逐章节提取实体
对每个章节，你需要从原文中识别并提取：
- **persons**（人名）：真实的历史人物姓名，2-4 个字。不包含称号（如"高祖"需转换为"刘邦"）
- **places**（地名）：真实的地理名称，2-6 个字。不包含泛称（如"天下"、"中国"）
- **officials**（官职）：出现的官职名称
- **events**（事件）：人-地-职的三元组关联

### 步骤 3：将结果写入 JSON 文件
将所有章节的结果组成一个 JSON 数组，保存到：
```
TotalData/ProcessedData/llm_results/batch_NNN.json
```

文件格式：
```json
[
  {
    "file": "012_part0006_split_006.txt",
    "persons": ["项籍", "项梁", "项燕", "王翦", "陈涉", "范增"],
    "places": ["下相", "会稽", "吴中", "咸阳", "彭城", "广陵"],
    "officials": ["楚将", "裨将", "上柱国"],
    "events": [
      {"person": "项籍", "location": "下相", "role": null, "year": null},
      {"person": "项籍", "location": "会稽", "role": "裨将", "year": -209}
    ]
  }
]
```

### 步骤 4：运行校验脚本
```bash
python3 scripts/save_batch_result.py --batch NNN --input TotalData/ProcessedData/llm_results/batch_NNN.json
```
将校验脚本的**完整输出**展示给用户。

### 步骤 5：报告结果
使用以下格式报告（不得修改格式）：
```
✅ batch_NNN 完成
- 章节数: X
- 提取人物: X 个
- 提取地名: X 个
- 校验结果: 通过/有警告（列出警告内容）
```

---

## 三、质量红线（违反即失败）

| 编号 | 红线 | 说明 |
|:---|:---|:---|
| Q1 | 人名必须是真实历史人物 | "目录"、"列传"、"本纪"、"未知"是章节标题，不是人名 |
| Q2 | 人名长度 2-4 字 | 超过 4 字的大概率是句子片段，不是人名 |
| Q3 | 地名必须是具体地理位置 | "天下"、"中国"、"四海"不是地名 |
| Q4 | 不得编造原文中没有的实体 | 只提取文中明确出现的名词，不要靠知识补充 |
| Q5 | 每个章节必须有输出 | 即使某章很短，也必须输出 `{"file": "xxx", "persons": [], "places": []}` |

---

## 四、效率要求

- 每次对话处理 **1-3 个批次**（5-15 个章节）
- 共 84 个批次，预计需要 28-84 次对话
- 每次对话结束前，必须告诉用户下次从哪个批次开始

---

## 五、如何检查进度

用户（或模型自己）可以随时运行：
```bash
python3 -c "
import json
idx = json.load(open('TotalData/ProcessedData/llm_batches/batch_index.json'))
done = sum(1 for v in idx['status'].values() if v == 'done')
total = len(idx['status'])
print(f'进度: {done}/{total} 批次已完成 ({done*100//total}%)')
pending = [k for k,v in idx['status'].items() if v == 'pending']
print(f'下一个待处理: {pending[0] if pending else \"全部完成\"}')
"
```

---

## 六、全部批次完成后的合并操作

当所有 84 个批次都标记为 done 后，运行：
```bash
python3 scripts/save_batch_result.py --merge
```
这会合并所有结果为 `app/public/data/TOTAL_ERSHISI_CLEAN_DATA.json`。

合并后必须检查：
```bash
python3 -c "
import json
d = json.load(open('app/public/data/TOTAL_ERSHISI_CLEAN_DATA.json'))
g = d['graph']
all_p = set()
for ch in g:
    all_p.update(ch['data']['persons'])
print(f'唯一人物: {len(all_p)}')
print(f'前 30 个: {sorted(list(all_p))[:30]}')
garbage = [p for p in all_p if p in ('目录','未知','列传','本纪','世家','帝纪')]
print(f'垃圾: {garbage}')
"
```

**达标标准**：
- 唯一人物 > 5,000
- 垃圾列表为空
- 前 30 个人物全是真实中国历史人名
