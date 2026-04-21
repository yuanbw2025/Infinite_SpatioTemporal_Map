# 无限时空图 — 技术交接手册 (AI Developer Handover)

> **用途**：任何 AI 模型（Claude Code / Cursor / Gemini / GPT 等）接手本项目开发前，**必须先读此文档**。  
> **最后更新**：2026-04-20，Phase 0 MVP 验证通过。

---

## 一、当前项目状态快照

### ✅ 已完成
- **Phase 0 MVP 已跑通**：MapLibre GL + Deck.gl + Vue 3 骨架在 `app/` 目录下运行正常
- **真实数据验证**：从【萬曆】清河縣志官師表中提取了 20 条官员数据，弧线渲染、朝代筛选、悬停卡片均正常工作
- **规划文档定稿**：`doc_dev/` 下三份核心文档（WORK_RULES / PROJECT_PLAN / project_communication）已整合完毕

### ❌ 尚未开始
- `skills/` 目录为空（AI 提示词指令集未编写）
- `scripts/` 目录为空（Python 自动化管线未开发）
- 数据管线从未端到端自动运行过（当前 JSON 是手工编写的）
- 阅读器模块未开发
- 知识图谱后端未开发

---

## 二、目录结构与关键文件

```
project-root/
├── app/                               # 前端应用（Vite + Vue 3）
│   ├── src/
│   │   ├── App.vue                    # ★ 主组件（MapLibre + Deck.gl 渲染逻辑）
│   │   ├── data/
│   │   │   └── qinghe_officials.json  # ★ 当前唯一的真实数据文件
│   │   └── main.js                    # Vue 入口
│   ├── package.json                   # 依赖：maplibre-gl, @deck.gl/core, @deck.gl/layers, @deck.gl/mapbox
│   └── vite.config.js
│
├── doc_dev/                           # 内部规划文档
│   ├── WORK_RULES.md                  # ★ AI 工作宪法（标注规范、禁令）
│   ├── PROJECT_PLAN.md                # ★ 项目全景规划（功能、架构、阶段）
│   ├── PROJECT_INTRODUCTION.md        # 对外介绍文档
│   ├── project_communication.md       # 沟通留痕
│   ├── relics_schema.json             # 文博藏品 JSON Schema
│   └── ref_architecture_deconstruction.md  # 参考架构解构（只读参考）
│
├── scripts/                           # 【待建】Python 自动化管线
├── skills/                            # 【待建】AI Agent 提示词指令集
└── TotalData/                         # 【待建】数据目录（被 .gitignore 排除）
```

---

## 三、前端技术栈与约束（不可更改）

| 组件 | 选型 | 版本 | 理由 |
|:---|:---|:---|:---|
| 地图引擎 | **MapLibre GL JS** | 最新 | 完全开源，无 API Key |
| 数据可视化 | **Deck.gl** (`@deck.gl/mapbox` overlay 模式) | 最新 | MIT 协议，ArcLayer/TripsLayer |
| UI 框架 | **Vue 3** (Composition API) | 最新 | `<script setup>` 语法 |
| 构建工具 | **Vite** | v8+ | 默认模板 |
| 底图 | CartoDB Dark | — | 免费暗色瓦片 |

### 渲染架构（已验证，不要改动）
```
MapLibre Map
  └── MapboxOverlay（@deck.gl/mapbox）  ← Deck.gl 图层挂载为 MapLibre 的 control
       ├── ArcLayer        ← 官员赴任弧线
       ├── ScatterplotLayer ← 籍贯圆点 + 目的地圆点
       └── TextLayer       ← 地名标注
```

> **⚠️ 禁止切换回 standalone Deck 模式**。之前试过 `new Deck({ pointerEvents: 'none' })` 的 overlay 方案，鼠标事件无法传递，hover 不工作。必须使用 `MapboxOverlay` + `map.addControl()` 方案。

### 启动命令
```bash
export PATH="/Users/v_yuanbowen01/.nvm/versions/node/v24.14.1/bin:$PATH"
cd app && npm run dev -- --host --port 5188
```

---

## 四、数据契约（前端期望的 JSON 格式）

### 4.1 官员/人物数据 (`qinghe_officials.json`)

前端 `App.vue` 直接 `import` 此 JSON。任何生成此格式的脚本都必须严格遵循以下结构：

```json
{
  "meta": {
    "source": "来源说明",
    "destination": {
      "name": "目的地古名",
      "modern_name": "现代地名",
      "lng_lat": [经度, 纬度]
    }
  },
  "officials": [
    {
      "id": "p_001",              // 唯一ID，格式 p_NNN
      "name": "苏轼",             // 姓名（必填）
      "courtesy_name": "子瞻",    // 字（可选）
      "origin": "眉州",           // 籍贯古名（必填）
      "origin_lnglat": [103.83, 30.04],  // 籍贯经纬度（必填）
      "dynasty": "宋",            // 朝代（必填，用于颜色映射）
      "year_start": 1037,         // 任职/活动起始年（公元，必填）
      "year_end": 1101,           // 结束年（公元，必填）
      "position": "知州",         // 官职（必填）
      "note": "备注",             // 备注（可选）
      "color": [80, 180, 255]     // RGB 颜色（必填，与朝代对应）
    }
  ]
}
```

### 4.2 朝代→颜色映射（硬编码在 App.vue 中）
```javascript
const dynastyColors = {
  '東漢': '#ff5050',    // [255, 80, 80]
  '北魏': '#b464ff',    // [180, 100, 255]
  '東魏': '#b464ff',
  '隋':   '#00c896',    // [0, 200, 150]
  '唐':   '#ff7832',    // [255, 120, 50]
  '後晉': '#ffb400',    // [255, 180, 0]
  '宋':   '#50b4ff',    // [80, 180, 255]
  '明':   '#dc3232',    // [220, 50, 50]
  '明/清': '#dc3232',
  '清':   '#6464ff'     // [100, 100, 255]
}
```

> **新增朝代时**：必须同时在 `dynastyColors` 和 `dynasties` 数组中添加，否则右侧朝代面板不会显示筛选按钮。

### 4.3 坐标精度要求
- 经纬度使用 WGS84 坐标系（即标准 GPS 坐标）
- 精度到小数点后 2 位即可
- **禁止 AI 凭空猜测坐标**。如果不确定古地名对应的现代坐标，留空或标注 `null`，后续由 CHGIS 对接脚本补全

---

## 五、当前最高优先级任务：数据管线 (Phase 1)

### 5.1 需要构建的 Python 脚本

| 脚本 | 职责 | 输入 | 输出 |
|:---|:---|:---|:---|
| `scripts/pdf_extractor.py` | 从 PDF 中提取文字 | `TotalData/OriginalData/*.pdf` | `TotalData/ProcessedData/raw_text/*.txt` |
| `scripts/text_annotator.py` | 调用 LLM 进行实体标注 | 原始文本 | 标注后 Markdown |
| `scripts/entity_to_json.py` | 从标注文本提取结构化 JSON | 标注后 Markdown | `officials.json` 格式 |
| `scripts/lint_integrity.py` | 校验原文字符完整性 | 标注前后文本 | 通过/失败报告 |
| `scripts/gazetteer_linker.py` | 古地名→经纬度坐标匹配 | 地名字符串 | `[lng, lat]` |

### 5.2 标注符号体系（完整规范见 WORK_RULES.md 第四条）

方志域核心符号速查：
```
〖@分类:人名〗  〖=区划〗  〖~自然〗  〖§职位〗
〖⌚时间〗      〖⚔兵事〗  〖$物产〗  〖¥课税〗
```

### 5.3 质量红线
- **原文字符完整率 100%**：标注后去除所有符号，必须与原文逐字相同
- **JSON 必填字段不可缺失**：`id`, `name`, `origin`, `origin_lnglat`, `dynasty`, `year_start`, `year_end`, `position`, `color`
- **坐标不可凭空捏造**：不确定就留 `null`

---

## 六、本体标注示范（从原文到 JSON 的完整链路）

### 原文（清河縣志提要页节选）：
```
向日紅，湖北大冶人。恩選，貢生，明萬曆四年至十年任清河知縣，後升任雲南監察御史。
```

### 标注后：
```
〖@名宦:向日紅〗，〖=湖北大冶〗人。恩選，〖§貢生〗，〖⌚明萬曆四年至十年〗任〖=清河〗〖§知縣〗，後升任〖=雲南〗〖§監察御史〗。
```

### 提取为 JSON：
```json
{
  "id": "p_018",
  "name": "向日紅",
  "origin": "湖北大冶",
  "origin_lnglat": [114.97, 30.10],
  "dynasty": "明",
  "year_start": 1576,
  "year_end": 1582,
  "position": "清河知縣",
  "note": "本志纂修者，後升任雲南監察御史",
  "color": [220, 50, 50]
}
```

---

## 七、Git 与数据隔离策略

- `TotalData/` 目录**必须**被 `.gitignore` 排除
- 数据通过 Hugging Face Datasets 或 GitHub Release 单独分发
- `app/src/data/` 下的小型示例数据可以入 Git（用于 MVP 演示）
- 禁止将 100MB+ 的 PDF 原文放入 Git 仓库

---

## 八、常见陷阱与避坑指南

1. **Node.js 路径问题**：此机器使用 nvm，必须先 `export PATH="/Users/v_yuanbowen01/.nvm/versions/node/v24.14.1/bin:$PATH"` 才能使用 `npm`/`npx`
2. **端口冲突**：5173 端口被其他应用占用，本项目使用 `--port 5188`
3. **Deck.gl overlay 模式**：必须使用 `@deck.gl/mapbox` 的 `MapboxOverlay`，不要用 standalone `Deck`
4. **古地名坐标**：绝对不要让 AI 猜测。目前坐标是基于现代城市近似值手动填写的，后续需要对接 CHGIS 专业数据库

---

**本文档随项目推进持续更新。任何架构级变更必须同步反映在此文档中。**
