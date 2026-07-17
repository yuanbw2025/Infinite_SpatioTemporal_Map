# 数据与功能组合蓝图

本文回答六个问题：数据从哪里进入、如何分层、字段由谁拥有、记录怎样引用、功能读取什么、功能之间怎样组合。它与 `architecture.md` 共同构成实现依据。

## 1. 一条数据如何进入项目

```text
原始文件/影印/GIS/文博目录
          │
          ▼
1 Source Intake
  sourceId、来源地址、馆藏、权利、SHA-256
          │
          ▼
2 Extraction / Transcription
  OCR或转录文本、处理器、责任人、原件/转录双校验值
          │
          ▼
3 Segmentation
  稳定 PassageId、原文字符区间、卷章归属
          │
          ├────────► 4 Text Derivatives
          │           简体、标点、白话、翻译（永不覆盖原文）
          ▼
5 Candidate Extraction
  Entity / Mention / Assertion / Place / Geometry / Occurrence 候选
          │
          ▼
6 Alignment & Review
  实体消歧、地点对齐、证据核验、人工决策、争议保留
          │
          ▼
7 Canonical Dataset
  唯一规范事实，以稳定 ID 相互引用
          │
          ▼
8 Publication Build
  合并 → 引用校验 → 契约校验 → 权利/审核门禁 → 清单与校验值
          │
          ▼
9 Immutable Publication Revision
  公众运行时唯一可读数据版本
          │
          ▼
10 Shared DataContext → Application Use Cases → All Features
```

### 各阶段允许做什么

| 阶段         | 可以做                 | 不能做                   |
| ------------ | ---------------------- | ------------------------ |
| Intake       | 登记原件、权利、校验值 | 推断历史事实             |
| Extraction   | 生成可审计文本         | 覆盖原件、冒充人工核定   |
| Segmentation | 切分稳定引用单元       | 简繁转换、改写原文       |
| Derivatives  | 生成独立文本层         | 改变 original 和字符偏移 |
| Candidate    | 提出机器/规则建议      | 直接进入正式数据         |
| Review       | 修正、核定、争议、驳回 | 删除原提案和历史决策     |
| Canonical    | 保存当前规范事实       | 被公众页面直接修改       |
| Publication  | 生成不可变交付快照     | 原地覆盖旧版本           |

## 2. 唯一规范数据图

```text
Work 1 ── N Edition 1 ── N Volume 1 ── N Passage
                                             │
                                             ├── N Mention ── 1 Entity
                                             │
                                             └── EvidenceSpan
                                                     ▲
                                                     │
Entity 1 ── N Assertion ── 0..1 Entity              │
   │              └──────────────────────────────────┘
   │
   ├── 0..1 PlaceIdentity ── N HistoricalName
   │             │
   │             ├── N HistoricalGeometry
   │             └── parentPlaceIds → PlaceIdentity
   │
   └── N SpatiotemporalOccurrence ── 1 PlaceIdentity
                         └──────────── EvidenceSpan
```

图中只有这些记录是规范事实。`SearchHit`、`MapObservation`、`GraphEdge`、`TimelineItem`、`ResearchFinding` 和统计指标是临时查询结果。

## 3. 字段所有权

### 3.1 通用字段

| 字段              | 权威位置                        | 规则                                             |
| ----------------- | ------------------------------- | ------------------------------------------------ |
| id                | 每个规范记录自身                | 稳定、带类型、发布后不复用                       |
| reviewStatus      | 可审核事实自身                  | 机器建议、已复核、核定、争议、驳回语义统一       |
| revision          | 可独立修订记录                  | 乐观并发与审计，不作为显示版本号                 |
| publicationId     | PublicationManifest/DataContext | 一个运行时只有一个活动值                         |
| source/provenance | Source Registry + 引用字段      | 来源详情只登记一次，事实只引用 sourceId/evidence |

### 3.2 Catalog：文献结构

#### Work

拥有作品身份、主标题、异名、类型、内容摘要和时空覆盖范围。

```text
id
title
alternativeTitles[]
category
abstract?
coverage.temporal?
coverage.regionLabels[]
coverage.placeIds[] → PlaceIdentity
sourceRefs[] → SourceRecord
```

`describedRegion` 与 `coverage.regionLabels` 语义重复，目标契约只保留 `coverage`；面向公众的地区说明由应用投影生成。

#### Edition

拥有具体版本和出版说明；馆藏、来源与权利由统一来源台账拥有。

```text
id
workId → Work
label
publicationStatement?
sourceRefs[] → SourceRecord
```

#### Volume

拥有卷章树和顺序。

```text
id
editionId → Edition
parentVolumeId? → Volume
label
sequence
```

### 3.3 Text：正文与影印

#### Passage

```text
id
volumeId → Volume
sectionLabel?
sequence
text.original
text.simplified?
text.punctuated?
text.modernTranslation?
facsimileAnchors[] → FacsimilePage/region
revision
```

唯一权威规则：

- `Passage.id` 已经是段落身份，删除重复的 `source.passageId`；
- 卷名读取 `Volume.label`，删除重复的 `source.volumeLabel`；
- Passage 只保存 `volumeId`；Edition 和 Work 经 `Volume.editionId → Edition.workId` 推导；
- 为查询建立 `passagesByEdition/work` 只读索引，不能把推导字段重新写回事实；
- 所有 Mention/Evidence 的 start/end 以 `text.original` Unicode 索引为准。

### 3.4 Knowledge：知识事实

#### Entity

拥有跨文献规范身份、实体类型、规范显示名和异名。

```text
id
type
preferredName
aliases[]
summary?                 # 可由带证据主张生成时不应手工重复
reviewStatus
```

#### Mention

只表示“某实体在某段原文中出现”。

```text
id
passageId → Passage
entityId → Entity
start/end
surface                  # 必须等于 original[start:end]
confidence?
reviewStatus
```

#### Assertion

只表示带证据的知识主张。

```text
id
subjectId → Entity
predicate
objectId? → Entity       # 与 literalValue 二选一
literalValue?
temporal?
evidence[] → Passage span
reviewStatus
```

人物生卒、官职、家族、师承、物产、工艺等优先表示为 Assertion，不为每个页面增加实体字段。

### 3.5 Spacetime：历史时空事实

#### PlaceIdentity

表示跨时期相对稳定的地点身份，并绑定一个 `type=place` 的 Entity。

```text
id
entityId → Entity(type=place)
historicalNames[]
parentPlaceIds[] → PlaceIdentity
```

规范显示名唯一由 `Entity.preferredName` 拥有。目标契约删除重复的 `PlaceIdentity.preferredName`；地图当前时代名称从 `historicalNames.validDuring` 选择，无匹配时回退 Entity 名称。

#### HistoricalName

```text
name
validDuring?
kind?
evidence[] / sourceRefs[]
```

#### HistoricalGeometry

```text
id
placeId → PlaceIdentity
geometry
validDuring?
precision
sourceRefs[]
reviewStatus
```

坐标或疆域可能来自外部 GIS，不能强制伪造 Passage 证据，但必须引用来源台账。当前契约需要补 `sourceRefs`。

#### SpatiotemporalOccurrence

```text
id
entityId → Entity
placeId → PlaceIdentity
kind
temporal?
sequence?
evidence[] → Passage span
reviewStatus
```

人物游历、任官、事件现场、文物发现和收藏流转都使用这一结构。

## 4. 来源与证据如何划分

来源分为两类：

1. **文本证据**：能指向本项目 Passage 的事实使用 `EvidenceSpan`；
2. **外部来源**：GIS、馆藏目录、测绘、权利声明使用 `SourceRef`，指向 Source Registry。

Source Registry 是规范数据中的单一来源台账集合。Edition、HistoricalName、HistoricalGeometry 等只保存 SourceRef，不重复 URL、馆藏和权利字段；面向公众的 Publication 可以包含经过权利过滤的来源记录。

```text
SourceRecord
  id
  kind
  title
  holdingInstitution?
  url?
  rights
  checksum?
  accessedAt?

EvidenceSpan
  passageId → Passage
  start/end
  note?

SourceRef
  sourceId → SourceRecord
  locator?
  note?
```

知识主张默认需要文本证据；历史几何等外部事实需要 SourceRef；同时具有两类依据时可以并存。

## 5. 功能如何引用同一数据

| 功能     | 读取的规范记录                                      | 生成的临时投影        | 主要跳转                                    |
| -------- | --------------------------------------------------- | --------------------- | ------------------------------------------- |
| 方志博览 | Work、Edition、Volume、Passage                      | 目录、分类计数        | Work → Passage                              |
| 版本对读 | Edition、Volume、Passage                            | 对齐行                | 两侧 Passage                                |
| 阅读器   | Passage、Mention、Entity、Assertion                 | 高亮片段、并列文本    | Mention → Entity；Evidence → Passage        |
| 实体百科 | Entity、Mention、Assertion、Occurrence、Place       | EntityProfile         | 关系 → Entity；证据 → Passage；地点 → Atlas |
| 地图     | Entity、Place、HistoricalName、Geometry、Occurrence | MapObservation、Route | 点位 → Entity；经历证据 → Passage           |
| 知识图谱 | Entity、Assertion                                   | GraphNode/GraphEdge   | 节点 → Entity；边 → Evidence                |
| 时间线   | Entity、Assertion、Occurrence、Place                | TimelineTrack/Item    | 项目 → Entity/Place/Evidence                |
| 人物     | Entity(type=person)、Assertion、Occurrence          | 人物列表、生平摘要    | Entity/Atlas/Timeline                       |
| 文博     | 文博 Entity、Assertion、Occurrence                  | 分类卡片、流转摘要    | Entity/Atlas/Evidence                       |
| 搜索     | Work、Passage、Entity及只读索引                     | SearchHit             | 对应事实详情                                |
| 研究工具 | Assertion、Occurrence、Geometry、ReviewStatus       | ResearchFinding       | 冲突双方 Evidence                           |
| 数据质量 | PublicationManifest及全部集合                       | Metrics               | 问题集合/审核入口                           |

任何功能需要新信息时，先扩充规范事实或主张，再生成投影；不能把只供本页面使用的业务真相塞进投影。

## 6. 功能如何组合

### 6.1 文献到时空

```text
Library → Work → Edition → Volume → Passage
                                  → Mention → Entity
                                             → Occurrence → Place → Geometry
```

用户从书目进入原文，点击人物/地点后进入实体档案，再查看同一实体的历史行迹和地图位置。

### 6.2 地图回到原文

```text
Atlas MapObservation
  → entityId → EntityProfile
  → occurrenceId → Occurrence.evidence[]
  → passageId + start/end → Reader
```

地图不能只有坐标和标签；时空经历必须能返回证据。

### 6.3 图谱与时间线互通

```text
Graph edge = Assertion(subjectId, objectId, evidence)
Timeline item = Assertion.temporal OR Occurrence.temporal
```

二者共享 Entity 和 Evidence。图谱不复制人物关系，时间线不复制事件事实。

### 6.4 文博与方志互通

```text
Artifact Entity
  → Assertion(material / technique / inscription / creator)
  → Occurrence(discovery / collection / creation)
  → Place / Time / Evidence
```

文博不是独立数据库，而是统一实体和时空经历在文物领域的组合视图。

### 6.5 编辑闭环

```text
ResearchFinding / data issue
  → Curation task
  → Decision
  → Canonical revision
  → new Publication Revision
  → all features switch together
```

修订不会只更新某一个页面；新发布版本激活后，所有功能同时读取新事实。

## 7. Shared DataContext

一个运行实例只创建一次：

```text
DataContext
  publicationId
  contractVersion
  contentChecksum
  repositories
  sharedIndexes
```

- 所有 ApplicationServices 引用同一 DataContext；
- sharedIndexes 可包含按 ID、证据、实体、地点、时间的只读索引；
- feature 不得创建自己的 repository 或重新 fetch publication；
- 查询结果必须携带或可追溯到当前 publicationId；
- 切换数据版本时整体替换 DataContext，禁止部分功能热切换。

## 8. 投影可以包含哪些重复字段

为减少渲染查询，投影可以临时携带 `label`、`score`、`geometry`、计数等字段，但必须满足：

1. 不写入 Canonical；
2. 不接受独立人工编辑；
3. 能从规范记录确定性重建；
4. 有明确来源 ID；
5. 缓存时携带 publicationId/contentChecksum；
6. 规范记录变化后整体失效。

## 9. 字段变更决策流程

新增字段前依次回答：

1. 它是事实、来源、审核信息还是投影？
2. 哪个模块拥有唯一权威？
3. 能否用 Assertion 或现有引用表达？
4. 是否与已有字段重复？
5. 哪些功能读取它？
6. 缺失、不确定、争议如何表达？
7. 来源和审核如何记录？
8. 如何迁移旧版本并验证没有数据丢失？

无法回答这些问题的字段不能进入核心契约。

## 10. 示例：方志中的“金陵”

1. 原文分段产生 `passage-123`，`text.original` 含“金陵”。
2. Mention 保存 `passageId=passage-123`、字符范围和词面“金陵”。
3. 对齐后 `entityId=entity-nanjing`，Entity 的规范显示名可以是“南京”，aliases 包含“金陵”。
4. PlaceIdentity 绑定 `entity-nanjing`；HistoricalName 保存“金陵”及适用时期和证据。
5. HistoricalGeometry 保存对应时期的点或区域及 GIS 来源。
6. 某人物在此任官，Occurrence 引用该人物 Entity、PlaceIdentity、时间和原文证据。
7. 阅读器高亮“金陵”；实体页显示异名；地图在相应时代显示“金陵”；时间线显示人物任官；所有入口都回到 `passage-123`。

整个过程中没有为阅读器、地图和人物页分别建立三条“金陵”数据。
