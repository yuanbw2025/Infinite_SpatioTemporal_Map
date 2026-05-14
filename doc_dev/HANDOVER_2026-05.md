# 无限时空图谱 · 开发进度交接备忘录

> 最近一次更新：2026-05-14  
> 提交：`da62a81 feat: 项羽本纪地图数据集成 + 知识图谱稳定化`  
> 远程：`https://github.com/yuanbw2025/Infinite_SpatioTemporal_Map.git` (main)

本文件只讲"阶段与进度"，细节看代码与对应模块内的 README。换机器后读完这份就能接着干。

---

## 一、总体路线（四阶段）

| 阶段 | 目标 | 状态 |
|:---|:---|:---|
| **P0 — 前端地图 MVP** | MapLibre + Deck.gl 跑通，假数据能渲染 | ✅ 完成 |
| **P1 — 数据管线 + 实体标注** | LLM 批量 XML 标注 + 坐标回填 | ✅ 完成（以《项羽本纪》为首个 end-to-end 样本） |
| **P2 — 三视图联动（地图 / 阅读器 / 图谱）** | 真数据驱动三大视图，稳定不抖 | 🟡 进行中（当前位置） |
| **P3 — 扩量至《二十四史》全量 + 时间轴 + 百科** | 从"项羽本纪"推广到全库 | 🔲 未开始 |

---

## 二、当前里程碑快照（P2）

### ✅ 已完成
- **数据管线闭环（单篇验证）**  
  `scripts/structure_splitter.py` → 段落切分  
  `scripts/text_annotator.py` + `scripts/llm_client.py` + `skills/01_02_03_*.md` → LLM XML 标注 + 反思校验  
  `scripts/build_xiangyu_map_data.py` → CHGIS v6 + 手工字典匹配，坐标命中率 ≈ 96%  
  产物：`app/public/data/xiangyu_annotated.json`（50 段）、`xiangyu_locations.json`（142 点位）

- **地图视图** `app/src/views/MapView.vue`  
  秦末中原古地图（中心 `[113.5, 34.5]`），Natural Earth 河流/海岸线叠加，142 个历史地名散点。

- **阅读器** `app/src/views/ReaderView.vue` + `app/src/components/BookReader.vue`  
  XML 标签实时解析 + 实体彩色高亮（人物 / 地名 / 官职 / 事件），加载真实项羽本纪标注数据。

- **知识图谱** `app/src/views/GraphView.vue`  
  修掉了"无限抖动"Bug：friction 0.6 / 节点上限 50 / 共现阈值 ≥3 / 5 秒自动冻结。

- **工程基建**  
  `.env.example` 模板化、Poe 兼容 OpenAI 协议、`.llm_cache` 磁盘缓存、`requirements.txt` 精简。

### 🟡 手上未收尾
- `app/src/views/UnifiedView.vue`（三视图联动入口）还只是骨架，没接入真实路由联动。
- `app/src/layouts/SystemLayout.vue` 的导航与新路由同步过，但视觉样式待统一。
- `TotalData/ProcessedData/llm_results/` 里的二十四史批处理结果尚未产出对应的 `*_annotated.json` / `*_locations.json`（只有项羽本纪一篇做完了）。

### 🔲 下一步（按优先级）
1. **UnifiedView 联动**：在阅读器选中段落 → 地图聚焦对应点位 + 图谱高亮相应实体。  
2. **数据管线批量化**：把 `build_xiangyu_map_data.py` 提炼成 `build_map_data.py <chapter>`，复用于高祖本纪、吕后本纪等。  
3. **时间轴视图** `TimelineView.vue` 与 **百科卡片** `WikiView.vue` 对接标注产物。  
4. 端到端跑通《史记·本纪》12 篇作为 P3 入场券。

---

## 三、换机器接手步骤（最小命令集）

```bash
# 1. 克隆
git clone https://github.com/yuanbw2025/Infinite_SpatioTemporal_Map.git
cd Infinite_SpatioTemporal_Map

# 2. 前端（只需要这一步就能看到现成效果，数据已入库）
cd app && npm install && npm run dev
# 打开 http://localhost:5173  → MapView / ReaderView / GraphView 都是真数据

# 3. 数据管线（仅当需要重新跑 LLM 标注时）
cd ..
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 填入 Poe / OpenAI key
# 然后按需执行：
#   python scripts/structure_splitter.py
#   python scripts/text_annotator.py
#   python scripts/build_xiangyu_map_data.py
```

> ⚠️ 注意：`TotalData/GISData/*.zip` 已在 `.gitignore` 里排除（解压后的 shapefile 保留入库），不需要重新下载也能跑。

---

## 四、代码地图（只列"入口文件"，不展开）

```
前端
  app/src/views/MapView.vue       ← 地图视图（142 点位 + 河流/海岸线）
  app/src/views/ReaderView.vue    ← 阅读器（加载 xiangyu_annotated.json）
  app/src/components/BookReader.vue
  app/src/views/GraphView.vue     ← 知识图谱（ECharts 力导）
  app/src/views/UnifiedView.vue   ← 三视图联动入口（TODO）
  app/src/router/index.js         ← 路由注册
  app/src/layouts/SystemLayout.vue
  app/public/data/                ← 所有静态数据产物

数据管线
  scripts/structure_splitter.py     ← 按章/段切分
  scripts/text_annotator.py         ← 调用 LLM 生成 XML 标注（配 skills/*.md）
  scripts/llm_client.py             ← Poe/OpenAI 兼容客户端 + 磁盘缓存
  scripts/build_xiangyu_map_data.py ← CHGIS + 手工字典 → 经纬度回填
  scripts/chgis_compiler.py         ← CHGIS shapefile → JSON

提示词
  skills/00_meta_instructions.md
  skills/01_entity_annotation.md
  skills/02_json_extraction.md
  skills/03_reflection_check.md     ← 反思校验环节（新增）
```

---

## 五、注意事项 / 已踩过的坑

1. **图谱必须限流**：`GraphView.vue` 如果把共现阈值调回 1 或节点上限调到 >100，力导会震荡不收敛。
2. **MapView 的坐标系**：用 WGS84，秦末地名的经纬度是"现代对应位置"，不是历史投影。
3. **LLM 缓存**：`.llm_cache/` 已被 .gitignore 排除。换机器第一次跑会全部重新请求 → 花钱。如果要复用之前结果，把这个目录也带过去。
4. **繁/简**：`skills/` 里的提示词假定输入已繁转简（OpenCC）。`scripts/text_annotator.py` 内部会先转一次。
5. **`core/` 是旧版残留**：不是当前主路径，可以忽略；当前前端主路径是根目录的 `app/`。

---

## 六、最近 3 次提交

```
da62a81  feat: 项羽本纪地图数据集成 + 知识图谱稳定化        ← 当前 HEAD
d16279e  docs(data): add llm extraction results for batches 034-036
8327d7c  refactor: OpenCC 繁体修复, 订阅模式 LLM 实体提取基础设施
```

---

换机器后建议的第一件事：`npm run dev` 打开前端看一眼三个视图都能渲染 → 再开始写 UnifiedView 联动。
