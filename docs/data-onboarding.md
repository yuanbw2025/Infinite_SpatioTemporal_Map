# 数据接入手册

项目已经具备公众探索面的主要功能骨架，但仍处于架构与质量加固阶段。正式内容通过一个版本化 `KnowledgePublication` 发布包接入，默认文件位于：

```text
apps/web/public/data/publication.json
```

机器可读结构定义位于 `packages/contracts/schemas/publication.schema.json`；跨记录引用和原文字符范围由数据管线执行更严格的语义校验。

历史发布包统一迁移到当前契约：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline migrate-to-current \
  OLD_PUBLICATION publication.current.json \
  --predicate-map predicate-map.json \
  --report migration-report.json
```

只有存在无法自动判定的旧谓词时才需要 `--predicate-map`。映射目标必须来自核心词表，迁移报告会保留每种替换的数量。

## 发布包组成

```text
manifest     数据集身份、契约版本、数据版本、生成时间和内容校验和
sources      原件、转录、目录、GIS 等来源与权利说明
works        方志与其他文献及其来源引用
editions     文献版本与来源引用
volumes      卷章结构
facsimilePages 独立影印页、图像地址与所属来源
passages     原文、简体、白话与影印锚点
passageAlignments 经人工核定的跨版本篇章对应组
entities     人物、地点、事件、官职、机构与文博对象
mentions     实体在原文中的字符位置
assertions   带证据的关系和属性主张
places       跨时期地点身份和历史名称
geometries   带时代、精度和审核状态的坐标/范围
occurrences  人物、事件、文物与地点/时代之间的带证据经历
```

## 推荐工作方式

大型数据不要手工维护一个巨型 JSON。可以在独立目录维护 `manifest.json`、`works.json`、`passages.json` 等分片，再通过管线组装：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline assemble DATA_DIR apps/web/public/data/publication.json
```

已有完整发布包时先校验：

```bash
pnpm data:validate
```

校验器会检查契约版本、重复 ID、文献引用、版本/卷章关系、实体引用、原文字符范围、地点父级、几何引用以及每条主张的证据。

## 从原始文件到稳定段落

来源文件先建立带权利信息和 SHA-256 的清单，再提取为审计记录，最后按逻辑卷册键无损分段：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline sources \
  SOURCE_ROOT workspace/source-manifest.json \
  --publication-id PUBLICATION_ID --metadata SOURCE_METADATA_JSON
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline extract SOURCE_FILE workspace/source.json
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline segment \
  workspace/source.json workspace/segments.json \
  --publication-id PUBLICATION_ID \
  --source-key WORK_ID/EDITION_ID/VOLUME_ID
```

扫描件会停在 `requires_ocr=true`，完成 OCR 或人工转录前不能进入分段。`transcribe` 会保存原件与转录件的双重校验值及责任人。简体、句读与白话使用 `layer` 命令按稳定段落 ID 接入，不能直接编辑原文层。分段输出保留每段在提取正文中的 `start/end`，便于之后生成 `Mention` 和 `EvidenceSpan`。

## 从机器候选到正式发布

任何提取器都只产生带原文范围的候选，不能直接写入正式知识集合。候选通过统一命令生成稳定 ID，再接收追加式人工审核决策：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline extract-mentions \
  segments.json entity-lexicon.json proposals.json
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline candidates \
  proposals.json candidates.json \
  --publication apps/web/public/data/publication.json \
  --generator-id GENERATOR_AND_VERSION
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline review \
  candidates.json decisions.json candidates.reviewed.json
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline promote \
  candidates.reviewed.json apps/web/public/data/publication.json \
  apps/web/public/data/publication.next.json
```

内置提及提取器只进行原文精确匹配，优先最长词面，完全不覆盖或转换 `text.original`；同名实体会保留为多个低置信候选交给人工消歧。将来替换为规则、NLP 或大模型提取器时，输入输出边界和审核流程不变。

候选批次绑定原发布包的 ID 和内容校验和，审核端会拒绝混用其他版本。`promote` 在临时文件内合并已复核候选，检查全局 ID 碰撞和全部引用，重算校验和并原子替换目标；仍有未审核候选时会拒绝继续。正式发布除了 `validate`，还必须运行 `gate`。正式门禁拒绝权利不明或校验值变化的原件、尚未人工审核的候选、`raw/machine_suggested` 知识记录以及缺少来源权利说明的发布包；争议记录可以保留，但会明确告警。

实体和历史地点候选在普通内容审核前先运行 `align`。系统只给出带评分与理由的匹配建议，人工必须逐项选择合并、新建或保持分立；`resolve-alignments` 在合并异名和重写候选引用后再次执行发布包校验，未完整裁决、目标越权或引用冲突都会停止处理。

跨版本篇章先运行 `suggest-passage-alignments`。建议批次包含两版原文、匹配理由和置信度，并绑定当前发布包校验和；在校勘工作台接受、改为一对多/多对多或驳回后，用 `apply-passage-alignments` 生成新发布包：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline suggest-passage-alignments \
  publication.json passage-alignments.json \
  --work-id WORK_ID --left-edition-id EDITION_A --right-edition-id EDITION_B \
  --generator-id matcher-name-and-version
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline apply-passage-alignments \
  publication.json passage-alignments.json passage-decisions.json publication.next.json
```

决策必须覆盖整批。页面自动配对仍只用于尚未校定的段落，不能写回或覆盖原文。

## 接入后的功能映射

| 数据                            | 自动启用的功能                         |
| ------------------------------- | -------------------------------------- |
| works + editions + volumes      | 书库、版本与卷章导航                   |
| passages                        | 原文目录、分层阅读、全文与组合检索     |
| passageAlignments               | 优先采用人工核定关系的版本对读         |
| entities + mentions             | 实体高亮、人物/文博列表、原文出现      |
| assertions + evidence           | 实体档案、关系、时代与出处回溯         |
| places + geometries             | 随时代切换的历史名称、单区与不连续辖区 |
| occurrences                     | 人物游历、事件现场与文物流转           |
| facsimile pages + anchors       | 多页影印、IIIF 解析与版面区域联动      |
| object assertions               | 知识图谱与实体关系展开                 |
| temporal assertions/occurrences | 历史时间线与人物生平轨道               |
| disputed/conflicting records    | 研究工具中的待核验线索                 |

## 永久约束

- 简体和白话不能覆盖 `text.original`。
- `Mention.start/end` 必须以原文 Unicode 字符索引为准。
- 正式 `Assertion` 至少有一个 `EvidenceSpan`。
- `Assertion.predicate` 必须来自核心词表，且对象/文字值和实体类型符合定义。
- 页面功能不得直接修改发布包；数据修订必须回到管线重新发布。
- 机器候选不得绕过人工审核直接进入正式发布。
- 篇章对齐建议不得直接进入 `passageAlignments`；正式记录必须包含裁决人、时间和审核状态。
- 原件校验值变化后必须重新提取、分段和审核，不能沿用旧审计结论。
- `Polygon` 和 `MultiPolygon` 的每个环至少四点且首尾闭合，坐标使用 WGS 84 经度、纬度顺序。

## 影印页接入

每个影印页必须登记 `sourceId`，并提供直接 `imageUrl` 或 IIIF Presentation 2/3 `canvasUrl`。直接图像无需额外处理；IIIF Canvas 由读取适配器按需解析并缓存。段落可用多个 `facsimileAnchors` 跨页关联，`pageId` 指向页面，`region: [x, y, width, height]` 表示段落在该页的像素区域。

若需要区域高亮，应同时登记页面 `width` 和 `height`，且区域不得超出页面边界。数据管线负责引用与尺寸的语义校验；阅读器负责翻页、缩放、拖拽和区域叠加，不产生新的影印定位数据。

## 地图底图

时空数据层由 MapLibre 在浏览器中渲染，点、面、多面、聚合和行迹均来自发布包。默认使用公开矢量底图；如需部署自有瓦片或适配特定网络环境，在 `apps/web/.env` 设置 `VITE_MAP_STYLE_URL` 即可，更换底图不会改变历史数据契约。外部底图不可用时页面会切换到本地空白样式，历史数据层仍能工作。

历代扫描地图与疆域投影登记在 `apps/web/public/data/map-resources.json`。目录必须填写当前发布包的 `publicationId/contentChecksum`；扫描地图必须引用 `SourceRecord`，疆域 GeoJSON 必须引用发布包中已有的 `geometryIds`。时间轴会按 `validDuring` 自动筛选适用资源，用户可以逐层开关和调整透明度。目录的完整字段和接入步骤见[历史底图与疆域投影资源规范](historical-map-resources.md)。
