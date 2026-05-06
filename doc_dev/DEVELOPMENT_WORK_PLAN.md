# 无限时空图谱 — 后续开发全量工作规划

> **文档性质**：强制约束性施工指南。任何 AI 模型接手本项目，必须逐条执行本文档中的任务，不得跳过、不得简化、不得自行发挥。
> **创建日期**：2026-05-06
> **创建背景**：经严格审计发现，此前开发阶段存在大量数据造假、验证缺失、虚报进度的问题。本文档的目的是杜绝此类行为再次发生。

---

## 一、当前问题总结（经审计验证，附证据）

### 问题 1：人物实体数据是垃圾
- **证据**：`TOTAL_ERSHISI_CLEAN_DATA.json` 中 467 章只提取出 1008 个"人物"，抽样前 20 个为：`目录`、`梁书`、`晋书`、`未知`、`帝纪`、`一夜九迁`、`不妄罚`
- **根因**：使用正则从章节标题中提取"种子人物"，然后在正文做子串匹配。方法本身就是错的
- **影响**：百科系统（WikiView）和知识图谱（GraphView）展示的全是垃圾数据

### 问题 2：文白分离不可靠
- **证据**：`ershisi_simp/003_part0003.txt`（前言）有完整内容，但对应的 `ershisi_trad/003_part0003.txt` 只有 2 个字"前言"
- **根因**：使用"字符密度启发式"（检测 `的/了/是` vs `者/也/曰` 的比例）来分离古文和白话，该方法在短文本和混合文本上完全失效
- **影响**：阅读器的"繁简对照"功能在大量章节上是一边有内容、一边是空白

### 问题 3：繁体转换已修复（✅ 已于 2026-05-06 完成）
- 已使用 OpenCC (`opencc-python-reimplemented`) 对 467 卷全量重新转换
- 验证结果：`目录→目錄`、`传说→傳說`、`内容→內容`，质量合格

### 问题 4：README 图片已修复（✅ 已于 2026-05-06 完成）
- 10 张图已复制到 `doc_dev/images/`，README 改为相对路径

### 问题 5：Python 管线从未端到端跑通
- `scripts/` 有 11 个文件，其中 3 个是 mock 数据生成器
- `pipeline_runner.py` 存在但从未用于处理真实方志
- 缺少：PDF 文本提取 → LLM 实体标注 → JSON 输出 → CHGIS 坐标匹配 的完整链路

### 问题 6：交接文档过时
- `AI_HANDOVER.md` 停留在 2026-04-20，写着"scripts/ 目录为空"
- `CHANGELOG.md` 停留在 2026-04-21

---

## 二、项目关键数据指标（当前状态）

| 指标 | 数值 | 说明 |
|:---|:---|:---|
| 原始文本文件 | 467 个 | `TotalData/ProcessedData/ershisi_full_texts/` |
| 繁体文件 | 467 个 | `app/public/data/ershisi_trad/`（OpenCC 转换，质量合格） |
| 简体文件 | 467 个 | `app/public/data/ershisi_simp/`（文白分离产物，质量存疑） |
| 极短文件（<100字节） | 各 25 个 | 目录页、封面页等，属正常现象 |
| CHGIS 地理节点 | 5,224 个 | `app/src/data/historical_places.json`（真实数据） |
| CHGIS 唯一地名 | 2,696 个 | 含历代沿革 |
| 当前人物实体 | 1,008 个 | **垃圾数据，需要全部重做** |
| 当前地名实体 | 4,812 个 | CHGIS 子串匹配，质量尚可但未校验 |
| 无实体章节 | 68 个 | 占总章节的 14.6% |
| Vue 视图组件 | 6 个 | MapView, ReaderView, WikiView, GraphView, TimelineView, LibraryView |

---

## 三、后续工作任务清单

> **执行原则**：每个任务必须按顺序执行。每个任务结束后必须执行"自检流程"（见第五节）。未通过自检的任务不得标记为完成。

---

### 任务 1：使用订阅模式 LLM 提取实体（核心任务）

**目标**：利用 AI 模型的语义理解能力，从 467 卷正文中提取真实的历史人物、地名、官职和事件关联。

**背景**：这是用户从立项之初就明确要求的核心功能——"用模型订阅额度在对话中直接让模型处理文本"。不是调用 API，不是正则匹配，而是在对话中让模型直接读取原文并输出结构化数据。

**已完成的基础设施**：
- `scripts/prepare_batch.py`：已将 467 卷有效文本分为 **84 个批次**，每批 5 个章节
- `scripts/save_batch_result.py`：结果保存和校验脚本
- `doc_dev/ENTITY_EXTRACTION_PROTOCOL.md`：模型必须遵守的工作协议
- 批次文件位于：`TotalData/ProcessedData/llm_batches/batch_000.md` ~ `batch_083.md`

**执行方式**：
1. 用户在对话中告诉模型："读取 `TotalData/ProcessedData/llm_batches/batch_000.md`，按照 `doc_dev/ENTITY_EXTRACTION_PROTOCOL.md` 提取实体"
2. 模型读取文件内容，用自己的语义理解识别人名、地名、官职
3. 模型将结果写入 `TotalData/ProcessedData/llm_results/batch_000.json`
4. 模型运行校验脚本验证结果质量
5. 每次对话处理 1-3 个批次，共需约 28-84 次对话

**进度追踪命令**：
```bash
python3 -c "
import json
idx = json.load(open('TotalData/ProcessedData/llm_batches/batch_index.json'))
done = sum(1 for v in idx['status'].values() if v == 'done')
total = len(idx['status'])
print(f'进度: {done}/{total} 批次已完成 ({done*100//total}%)')
"
```

**全部批次完成后的合并命令**：
```bash
python3 scripts/save_batch_result.py --merge
```

**达标标准**（合并后）：
- Unique persons > 5,000
- 垃圾人名（目录、未知、列传等）数量 = 0
- 前 30 个人物全是真实中国历史人名
- Empty chapters < 50

**⚠️ 补充方案**（可与订阅模式并行）：
- 下载 CBDB（哈佛中国历代人物传记数据库）作为辅助校验白名单
- 下载地址：https://projects.iq.harvard.edu/cbdb/download-cbdb

---

### 任务 3：修复文白分离

**目标**：确保 `ershisi_trad/` 存放繁体原文，`ershisi_simp/` 存放简体原文。两个目录的内容一致，仅字形不同。

**背景说明**：
当前的 `ershisi_full_texts/` 中的文件包含了"古文原文 + 白话翻译"的混合内容。之前的分离方法（字符密度启发式）不可靠。

**执行方案（二选一）**：

**方案 A（推荐）：放弃分离，统一存储**
- `ershisi_trad/`：对 `ershisi_full_texts/` 的完整内容执行 OpenCC `s2t` 转换（已完成）
- `ershisi_simp/`：直接复制 `ershisi_full_texts/` 的原始内容（简体原文，包含古文和白话）
- 好处：不再有"一边有内容一边为空"的问题
- 代价：两个目录显示的是同一篇文章的繁简版本，不是"原文 vs 译文"

**方案 B（如果用户坚持要文白分离）**：
- 需要回到 EPUB 原始文件，利用 EPUB 的章节结构（不同的 HTML 文件）来定位古文和译文的边界
- 这要求检查 EPUB 的内部结构，工作量较大
- 建议在 Phase 2 或后续迭代中再做

**脚本名称**：`scripts/rebuild_simp_texts.py`

**自检命令**：
```bash
# 检查每个 trad 文件都有对应的 simp 文件，且两者都非空
python3 -c "
import os
trad = set(os.listdir('app/public/data/ershisi_trad/'))
simp = set(os.listdir('app/public/data/ershisi_simp/'))
missing = trad - simp
extra = simp - trad
print(f'Trad files: {len(trad)}, Simp files: {len(simp)}')
print(f'Missing in simp: {missing}')
print(f'Extra in simp: {extra}')
# 检查前 5 个文件的大小比例
for f in sorted(list(trad))[:5]:
    ts = os.path.getsize(f'app/public/data/ershisi_trad/{f}')
    ss = os.path.getsize(f'app/public/data/ershisi_simp/{f}')
    ratio = ts/ss if ss > 0 else 999
    print(f'{f}: trad={ts}B, simp={ss}B, ratio={ratio:.2f}')
"
```

**达标标准**：
- Missing 和 Extra 均为空集
- 每个文件的 trad/simp 大小比例在 0.8 到 1.5 之间（因为繁体字的 UTF-8 编码可能稍大）
- 不得出现 trad 文件有几万字节而 simp 只有几字节的情况

---

### 任务 4：重建人物轨迹数据

**目标**：为时空沙盘（MapView）生成真实的人物行踪轨迹。

**前置条件**：任务 2 已完成（有了真实的人物-章节关联数据）

**执行步骤**：
1. 从 `TOTAL_ERSHISI_CLEAN_DATA.json` 中提取高频人物（出现在 ≥ 3 个章节中的人物）
2. 对每个高频人物，收集其出现的所有章节中共现的地名
3. 从 `historical_places.json` 中查找每个地名的经纬度
4. 按章节顺序排列，生成轨迹路径
5. 输出到 `app/src/data/biographies_data.json`

**输出格式**：
```json
[
  {
    "name": "项羽",
    "color": [255, 80, 80],
    "path": [
      [118.3, 34.0],
      [116.9, 34.2],
      [108.9, 34.3]
    ],
    "events": [
      {"location": "下相", "coord": [118.3, 34.0]},
      {"location": "彭城", "coord": [116.9, 34.2]},
      {"location": "咸阳", "coord": [108.9, 34.3]}
    ]
  }
]
```

**脚本名称**：`scripts/rebuild_biographies.py`

**自检命令**：
```bash
python3 -c "
import json
d = json.load(open('app/src/data/biographies_data.json'))
print(f'Total persons with trajectories: {len(d)}')
for p in d[:5]:
    print(f\"{p['name']}: {len(p['path'])} points, first={p['events'][0]['location'] if p['events'] else 'N/A'}\")
# 检查坐标合法性
bad = 0
for p in d:
    for pt in p['path']:
        if not (70 < pt[0] < 140 and 15 < pt[1] < 55):
            bad += 1
print(f'Invalid coordinates: {bad}')
"
```

**达标标准**：
- Total persons ≥ 50
- 前 5 个人物必须有 ≥ 2 个轨迹点
- Invalid coordinates = 0
- 人物名必须是真实中国历史人名

---

### 任务 5：更新交接文档

**目标**：将 `AI_HANDOVER.md` 和 `CHANGELOG.md` 更新至当前真实状态。

**执行步骤**：
1. 重写 `AI_HANDOVER.md`，反映当前真实的目录结构、已完成的工作、尚未完成的工作
2. 在 `CHANGELOG.md` 中追加从 2026-04-22 到今天的所有工作记录
3. 必须如实记录之前的数据质量问题和本次修复过程

**达标标准**：
- 文档中不得出现与当前代码库实际状态矛盾的描述
- 不得使用"全线完工"、"彻底解决"等不可验证的表述

---

### 任务 6：前端残留清理

**目标**：清除前端代码中的硬编码占位符和 mock 数据引用。

**需要检查的文件**：
- `app/src/views/ReaderView.vue`：第 40 行附近的中文占位符 `【系統提示：...】`
- `app/src/data/` 目录：检查是否有 mock/测试 数据文件被前端代码引用
- `app/src/components/BookReader.vue`：确认没有硬编码的 mock 标题或文本

**自检命令**：
```bash
grep -rn "Mock\|mock\|MOCK\|占位\|placeholder\|系統提示" app/src/ --include="*.vue" --include="*.js"
```

**达标标准**：
- 上述 grep 命令输出为空（无任何匹配）

---

### 任务 7：端到端验证

**目标**：启动开发服务器，验证所有功能模块能正常加载和交互。

**执行步骤**：
```bash
cd app && npm run dev -- --host --port 5188
```

**需要验证的场景**：
1. 首页加载后，左侧导航栏显示四大功能入口
2. 点击"时空沙盘"：3D 地球正常渲染，有轨迹线和打点
3. 点击"典籍精读"：能加载章节列表，选择章节后繁简两栏都有内容显示
4. 点击"实体百科"：搜索框能搜索到真实人名（如"项羽"），点击后显示出处章节
5. 点击"知识图谱"：力导向图正常渲染，节点标签是真实人名/地名

**达标标准**：
- 5 个场景全部通过
- 控制台无红色报错（`console.error`）
- 页面无白屏、无"undefined"显示

---

## 四、开发流程规范（强制）

### 4.1 每个任务的执行流程

```
1. 宣布开始执行任务 N
2. 编写/修改代码或脚本
3. 运行脚本
4. 执行该任务的"自检命令"
5. 将自检结果的完整输出展示给用户
6. 对照"达标标准"逐条检查
7. 全部达标 → 宣布任务 N 完成，进入下一个任务
8. 未达标 → 分析原因，修改代码，重新从步骤 3 开始
```

### 4.2 禁止行为

| 编号 | 禁止行为 | 说明 |
|:---|:---|:---|
| F1 | **禁止跳过自检** | 脚本输出 `Done` 不代表完成。必须执行自检命令并检查输出内容 |
| F2 | **禁止使用"全线完工"等表述** | 只允许说"任务 N 已完成，自检结果为 XXX" |
| F3 | **禁止凭空猜测数据** | 不确定的坐标写 `null`，不确定的人名不要硬塞 |
| F4 | **禁止一次性处理 467 个文件而不先做抽样** | 任何批量处理脚本，必须先在 5 个文件上运行并展示结果，确认无误后再全量执行 |
| F5 | **禁止修改用户未要求修改的文件** | 特别是 `SYSTEM_ARCHITECTURE.md`、`PROJECT_PLAN.md` 等规划文档 |
| F6 | **禁止在回答中编造进度** | 如果不确定某个文件是否存在或内容是什么，必须先 `cat` / `head` / `ls` 查看 |

### 4.3 抽样验证规则

对于任何批量数据处理任务：
1. **先处理 5 个文件**
2. **打印前 5 个文件的处理结果**（前 20 行或前 20 条数据）
3. **展示给用户确认**
4. **用户确认无误后，再全量处理**
5. **全量处理后，再次抽样检查 5 个文件的结果**

---

## 五、自检流程总表

| 任务 | 自检命令 | 关键指标 |
|:---|:---|:---|
| 任务 1 | `python3 -c "..."` 打印人名总数和前 20 个 | 总数 > 100,000；前 20 个全是真实人名 |
| 任务 2 | `python3 -c "..."` 打印实体统计和垃圾检测 | Unique persons > 5,000；Garbage = [] |
| 任务 3 | `python3 -c "..."` 打印文件数量和大小比例 | 比例在 0.8-1.5 之间；无缺失文件 |
| 任务 4 | `python3 -c "..."` 打印轨迹人物数和坐标 | ≥ 50 人；Invalid coordinates = 0 |
| 任务 5 | 人工检查文档内容 | 无过时描述 |
| 任务 6 | `grep` 搜索 mock/占位符 | 输出为空 |
| 任务 7 | 浏览器访问 5 个场景 | 全部通过，无报错 |

---

## 六、用户需要提供的资源

| 资源 | 来源 | 用途 | 是否必须 |
|:---|:---|:---|:---|
| CBDB 数据库 | https://projects.iq.harvard.edu/cbdb/download-cbdb | 人名词典 | **是**（除非选择 LLM 方案） |
| LLM API Key | 用户自行配置 | 备选的人名提取方案 | 否（如果用 CBDB 则不需要） |

---

## 七、预期最终状态

当全部 7 个任务完成后，项目应达到以下状态：

1. **时空沙盘**：3D 地球上显示 ≥ 50 个真实历史人物的行踪轨迹，点击可查看人物信息
2. **典籍精读**：467 卷文本可正常浏览，繁简两栏内容一致（仅字形不同），无空白栏
3. **实体百科**：可搜索到 ≥ 5,000 个真实历史人名，每个人名关联到出处章节
4. **知识图谱**：力导向图展示人物-地名的共现关系网络，节点全是真实实体
5. **README**：GitHub 上图片正常显示，描述与实际功能一致
6. **交接文档**：如实反映项目状态，无过时信息
