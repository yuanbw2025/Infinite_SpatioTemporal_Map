# 目标 0.6 字段字典

本字典是已实施的 0.6 契约基线，逐一规定字段名、类型、必填性、所有者与引用关系。历史数据差异见末尾迁移表；新代码不得重新引入这些字段。

记号：`!` 必填，`?` 可选，`[]` 数组。所有 ID 均为品牌字符串；所有字符区间为原文 Unicode 索引的 `[start, end)`。

## 1. 发布与来源

### PublicationManifest

| 字段                 | 类型            | 规则                         |
| -------------------- | --------------- | ---------------------------- |
| `contractVersion!`   | semver string   | Schema 版本                  |
| `publicationId!`     | PublicationId   | 不可变发布身份               |
| `datasetVersion!`    | semver string   | 规范数据内容版本             |
| `title!`             | string          | 发布标题，不代替 Work.title  |
| `generatedAt!`       | RFC 3339 string | UTC 生成时间                 |
| `contentChecksum!`   | `sha256:<hex>`  | 对排除本字段后的规范内容计算 |
| `sourceDescription!` | string          | 面向人的总体来源说明         |

### SourceRecord

| 字段                  | 类型            | 规则                                                               |
| --------------------- | --------------- | ------------------------------------------------------------------ |
| `id!`                 | SourceId        | 来源台账主键                                                       |
| `kind!`               | enum            | `facsimile/transcription/catalogue/gis/dataset/bibliography/other` |
| `title!`              | string          | 来源正式名称                                                       |
| `holdingInstitution?` | string          | 持有或发布机构                                                     |
| `url?`                | URI             | 公开定位；敏感凭据禁止进入                                         |
| `rightsStatement!`    | string          | 使用与公开权利                                                     |
| `checksum?`           | `sha256:<hex>`  | 原件或下载对象校验值                                               |
| `accessedAt?`         | RFC 3339 string | 在线来源获取时间                                                   |

### SourceRef（嵌入值对象）

| 字段        | 类型     | 规则                           |
| ----------- | -------- | ------------------------------ |
| `sourceId!` | SourceId | 指向 SourceRecord              |
| `locator?`  | string   | 页、条目号、图层要素号等原定位 |
| `note?`     | string   | 只说明引用，不复制来源元数据   |

`KnowledgePublication` 顶层集合固定为：`manifest`、`sources`、`works`、`editions`、`volumes`、`facsimilePages`、`passages`、`passageAlignments`、`entities`、`mentions`、`assertions`、`places`、`geometries`、`occurrences`。这些集合始终存在且为数组。

## 2. Catalog

### Work

| 字段                 | 类型         | 规则                                          |
| -------------------- | ------------ | --------------------------------------------- |
| `id!`                | WorkId       | 作品身份                                      |
| `title!`             | string       | 规范题名                                      |
| `alternativeTitles!` | string[]     | 不含 title 的异题                             |
| `category!`          | enum         | `gazetteer/history/genealogy/catalogue/other` |
| `abstract?`          | string       | 编辑性简介，不承载可查询事实                  |
| `coverage?`          | WorkCoverage | 作品声称覆盖范围                              |
| `sourceRefs!`        | SourceRef[]  | 作品书目信息依据，至少一条                    |

### WorkCoverage

| 字段            | 类型              | 规则                       |
| --------------- | ----------------- | -------------------------- |
| `temporal?`     | TemporalValue     | 记述范围，不是版本出版时间 |
| `regionLabels!` | string[]          | 来源或编目使用的区域标签   |
| `placeIds!`     | PlaceIdentityId[] | 已对齐地点，可为空         |

### Edition

| 字段                    | 类型        | 规则                                     |
| ----------------------- | ----------- | ---------------------------------------- |
| `id!`                   | EditionId   | 版本身份                                 |
| `workId!`               | WorkId      | 所属作品                                 |
| `label!`                | string      | 版本显示名                               |
| `publicationStatement?` | string      | 刊刻/出版原说明                          |
| `sourceRefs!`           | SourceRef[] | 馆藏、影印、编目信息均由此追溯，至少一条 |

### Volume

| 字段              | 类型                 | 规则                |
| ----------------- | -------------------- | ------------------- |
| `id!`             | VolumeId             | 卷章节点身份        |
| `editionId!`      | EditionId            | 所属版本            |
| `parentVolumeId?` | VolumeId             | 同 Edition 内父节点 |
| `label!`          | string               | 原卷章名            |
| `sequence!`       | non-negative integer | 同级稳定顺序        |

## 3. Text 与影印

### FacsimilePage

| 字段         | 类型                 | 规则          |
| ------------ | -------------------- | ------------- |
| `id!`        | FacsimilePageId      | 页面/画布身份 |
| `volumeId!`  | VolumeId             | 所属卷章      |
| `sourceId!`  | SourceId             | 影印来源      |
| `label?`     | string               | 原页码或叶码  |
| `sequence!`  | non-negative integer | 卷内顺序      |
| `canvasUrl?` | URI                  | IIIF Canvas   |
| `imageUrl?`  | URI                  | 直接图像地址  |
| `width?`     | positive integer     | 像素宽        |
| `height?`    | positive integer     | 像素高        |

`canvasUrl` 与 `imageUrl` 至少一个存在；宽高必须同时存在或同时省略。
`imageUrl` 直接用于展示；仅有 `canvasUrl` 时，由 `FacsimileImagePort` 解析 IIIF Presentation 2/3 Canvas。协议解析结果是运行时资源，不写回发布包。

### Passage

| 字段                | 类型                 | 规则                              |
| ------------------- | -------------------- | --------------------------------- |
| `id!`               | PassageId            | 最小稳定引用单元                  |
| `volumeId!`         | VolumeId             | 唯一归属；Work/Edition 由父链推导 |
| `sectionLabel?`     | string               | 不足以成为 Volume 的局部标题      |
| `sequence!`         | non-negative integer | Volume 内稳定顺序                 |
| `text!`             | TextLayers           | 多文本层                          |
| `facsimileAnchors!` | FacsimileAnchor[]    | 文本阶段可为空                    |
| `revision!`         | positive integer     | 受控修订号                        |

### TextLayers

| 字段                 | 类型   | 规则                   |
| -------------------- | ------ | ---------------------- |
| `original!`          | string | 不可覆盖的字符偏移基准 |
| `simplified?`        | string | 简体派生层             |
| `punctuated?`        | string | 标点派生层             |
| `modernTranslation?` | string | 现代汉语释义层         |

### FacsimileAnchor

| 字段      | 类型                 | 规则                                       |
| --------- | -------------------- | ------------------------------------------ |
| `pageId!` | FacsimilePageId      | 指向页面                                   |
| `region?` | `[x,y,width,height]` | 非负像素或 IIIF 区域；坐标系由页面来源规定 |

同一段落可按阅读顺序引用多个页面。提供 `region` 时应同时提供页面 `width/height`，阅读器会在缩放和拖拽过程中保持高亮区域与影像同步。

### PassageAlignment

| 字段            | 类型                         | 规则                                             |
| --------------- | ---------------------------- | ------------------------------------------------ |
| `id!`           | PassageAlignmentId           | 人工对齐记录身份                                 |
| `workId!`       | WorkId                       | 所有成员版本必须属于该作品                       |
| `relation!`     | enum                         | `equivalent/partial_overlap/reordered/uncertain` |
| `members!`      | PassageAlignmentMember[]     | 至少两个不同版本                                 |
| `reviewStatus!` | `reviewed/verified/disputed` | 未审核机器建议不能进入正式集合                   |
| `reviewedBy!`   | string                       | 人工裁决责任人                                   |
| `reviewedAt!`   | RFC 3339 string              | 人工裁决时间                                     |
| `note?`         | string                       | 编辑说明，不是原文证据                           |
| `revision!`     | positive integer             | 受控修订号                                       |

`PassageAlignmentMember` 由 `editionId!` 与非空、去重的 `passageIds!` 组成，支持一对一、一对多和多对多。同一成员中的段落必须属于声明版本；同一版本组合内，同一段落不得被两个有效对齐组重复占用。机器建议是校勘批次，不属于发布包；完整人工裁决由管线物化后才成为本集合中的事实。

## 4. Knowledge

### Entity

| 字段             | 类型         | 规则                               |
| ---------------- | ------------ | ---------------------------------- |
| `id!`            | EntityId     | 跨文献规范身份                     |
| `type!`          | EntityType   | 受控枚举                           |
| `preferredName!` | string       | 唯一规范显示名所有者               |
| `aliases!`       | string[]     | 不含 preferredName                 |
| `summary?`       | string       | 编辑性摘要；结构事实仍用 Assertion |
| `reviewStatus!`  | ReviewStatus | 不能靠字段缺失隐含 raw             |

### Mention

| 字段            | 类型                 | 规则                           |
| --------------- | -------------------- | ------------------------------ |
| `id!`           | MentionId            | 提及身份                       |
| `passageId!`    | PassageId            | 原文段落                       |
| `entityId!`     | EntityId             | 已对齐实体                     |
| `start!`        | non-negative integer | 含起点                         |
| `end!`          | positive integer     | 不含终点且大于 start           |
| `surface!`      | string               | 必须等于 `original[start:end]` |
| `confidence?`   | number 0..1          | 机器置信度，不代表审核状态     |
| `reviewStatus!` | ReviewStatus         | 审核状态                       |

### Assertion

| 字段            | 类型           | 规则                       |
| --------------- | -------------- | -------------------------- |
| `id!`           | AssertionId    | 主张身份                   |
| `subjectId!`    | EntityId       | 主语                       |
| `predicate!`    | PredicateId    | 0.5 核心受控谓词           |
| `objectId?`     | EntityId       | 与 literalValue 严格二选一 |
| `literalValue?` | string         | 与 objectId 严格二选一     |
| `temporal?`     | TemporalValue  | 主张有效或发生时间         |
| `evidence!`     | EvidenceSpan[] | 至少一条                   |
| `reviewStatus!` | ReviewStatus   | 审核状态                   |

谓词 ID、值类型、方向、反向关系和适用实体类型统一定义在 `packages/contracts/vocabularies/predicates.json`，说明见 `docs/predicate-vocabulary.md`。正式发布拒绝未知谓词、实体/文字值类型错误以及不适用的主体或对象类型。

### EvidenceSpan

| 字段         | 类型                 | 规则         |
| ------------ | -------------------- | ------------ |
| `passageId!` | PassageId            | 证据段落     |
| `start!`     | non-negative integer | 原文含起点   |
| `end!`       | positive integer     | 原文不含终点 |
| `note?`      | string               | 证据使用说明 |

## 5. 时间与空间

### TemporalValue

| 字段                             | 类型     | 规则                              |
| -------------------------------- | -------- | --------------------------------- |
| `original!`                      | string   | 史料原纪年，不可丢失              |
| `startYear/startMonth/startDay?` | integers | 查询用公历下界                    |
| `endYear/endMonth/endDay?`       | integers | 查询用公历上界                    |
| `certainty!`                     | enum     | `exact/approximate/range/unknown` |
| `calendar?`                      | string   | 原历法/换算体系                   |

月份或日期存在时对应年份必须存在；结束不得早于开始；不能可靠换算时只保留 original 与 unknown。

### PlaceIdentity

| 字段               | 类型              | 规则                                   |
| ------------------ | ----------------- | -------------------------------------- |
| `id!`              | PlaceIdentityId   | 历史地点身份                           |
| `entityId!`        | EntityId          | 必须指向 `type=place` 的 Entity        |
| `historicalNames!` | HistoricalName[]  | 分时期名称                             |
| `parentPlaceIds!`  | PlaceIdentityId[] | 多重历史隶属，具体有效期由关系主张表达 |

### HistoricalName

| 字段           | 类型           | 规则                                       |
| -------------- | -------------- | ------------------------------------------ |
| `name!`        | string         | 历史原名                                   |
| `validDuring?` | TemporalValue  | 使用时期                                   |
| `kind?`        | string         | 正名、俗名、旧名等受控词表候选             |
| `evidence!`    | EvidenceSpan[] | 文本依据，可为空                           |
| `sourceRefs!`  | SourceRef[]    | 外部依据，可为空；与 evidence 至少一个非空 |

### HistoricalGeometry

| 字段            | 类型                               | 规则                             |
| --------------- | ---------------------------------- | -------------------------------- |
| `id!`           | GeometryId                         | 几何身份                         |
| `placeId!`      | PlaceIdentityId                    | 地点身份                         |
| `geometry!`     | GeoJSON Point/Polygon/MultiPolygon | WGS84 `[longitude, latitude]`    |
| `validDuring?`  | TemporalValue                      | 适用时期                         |
| `precision!`    | enum                               | `site/settlement/region/unknown` |
| `sourceRefs!`   | SourceRef[]                        | 至少一条外部几何依据             |
| `reviewStatus!` | ReviewStatus                       | 审核状态                         |

### SpatiotemporalOccurrence

| 字段            | 类型                 | 规则                           |
| --------------- | -------------------- | ------------------------------ |
| `id!`           | OccurrenceId         | 时空经历身份                   |
| `entityId!`     | EntityId             | 人物、事件或文博对象           |
| `placeId!`      | PlaceIdentityId      | 历史地点                       |
| `kind!`         | OccurrenceKind       | 受控枚举                       |
| `label?`        | string               | 面向人的事件标题，不复制实体名 |
| `temporal?`     | TemporalValue        | 时间                           |
| `sequence?`     | non-negative integer | 同一实体经历顺序               |
| `evidence!`     | EvidenceSpan[]       | 至少一条文本/目录证据          |
| `reviewStatus!` | ReviewStatus         | 审核状态                       |

## 6. 审核记录

规范命名如下：记录主键仍叫 `id`，引用才叫 `<concept>Id`。

- `CurationCandidate`: `id/kind/payload/evidence/status/confidence?/notes?/reviewHistory`；`id` 为 CandidateId，payload 必须按 kind 由 Schema 判别，不能无限期保持任意对象。
- `ReviewDecision`: `id/candidateId/status/reviewer/decidedAt/note?/correctedPayload?`；追加式、不可覆盖。
- `AlignmentItem`: `id/candidateId/kind/sourceLabel/sourcePayload/matches/suggestion`；`id` 为 AlignmentId。
- `AlignmentDecision`: `id/alignmentId/resolution/reviewer/decidedAt/targetId?/note?`；`merge_existing` 必须有 targetId。
- 批次统一使用 `contractVersion/id/publicationId/generatedAt/producerId/items`；`id` 使用 BatchId，不再混用裸 `version`、`generatorId`、`alignerId` 和不同集合名。

审核状态固定为 `raw/machine_suggested/reviewed/verified/disputed/rejected`；状态迁移由 Curation domain 维护，UI 不得自己判断。

## 7. 查询投影

- 分页统一 `PageRequest(cursor?, limit?) → Page(items, nextCursor?)`。
- 布尔投影字段遵守 `is/has/can` 前缀，例如 `isTruncated`，不使用裸 `truncated`。
- `MapObservation`、`TimelineItem`、`KnowledgeGraphEdge`、`SearchHit`、`ResearchFinding` 是临时只读投影，不进入 KnowledgePublication。
- 投影记录允许包含显示 label，但必须从同一 Publication 的事实生成。
- 持久化投影使用 `ProjectionManifest(publicationId, contentChecksum, projectionKind, generatedAt, toolVersion)`，版本不匹配拒绝加载。
- UI store 只保存投影、ID 和查询状态，不把规范记录修改后当作新事实。

## 8. 0.3 → 0.4 必迁移项

| 0.3 字段/行为                                             | 0.4 决策                                            |
| --------------------------------------------------------- | --------------------------------------------------- |
| `Work.describedRegion`                                    | 删除，统一为 `coverage`                             |
| `Passage.source.workId/editionId/volumeLabel/passageId`   | 删除；只保留 `volumeId` 与 `sectionLabel`           |
| `FacsimileAnchor` 自带 URL                                | URL 移入 FacsimilePage，Anchor 只引用 pageId/region |
| `PlaceIdentity.preferredName`                             | 删除，读取 Entity.preferredName                     |
| Edition 内 `sourceUrl/holdingInstitution/rightsStatement` | 移入 SourceRecord/SourceRef                         |
| Geometry 无来源                                           | 增加非空 `sourceRefs`                               |
| Entity.reviewStatus 可选                                  | 改为必填                                            |
| Assertion TS/Python 可同时有对象和值                      | 与 Schema 对齐为严格二选一                          |
| curation ID 使用 string                                   | 增加 CandidateId/DecisionId/AlignmentId/BatchId     |
| 批次字段各自命名                                          | 统一批次 envelope                                   |
| 查询结果使用 `truncated`                                  | 统一为 `isTruncated`                                |
| 三处手写契约常量/枚举                                     | 从 Schema 生成或直接读取                            |

## 9. 0.4 → 0.5 必迁移项

| 0.4 字段/行为                  | 0.5 决策                               |
| ------------------------------ | -------------------------------------- |
| Assertion.predicate 任意字符串 | 改为版本化 PredicateId                 |
| 页面直接显示机器谓词           | 统一从谓词注册表读取中文标签           |
| 页面自行理解关系方向           | 使用 directionality/inversePredicateId |
| 旧谓词按字符串猜测迁移         | 禁止；除明确旧值外必须提供人工映射     |

## 10. 0.5 → 0.6 必迁移项

| 0.5 字段/行为          | 0.6 决策                                   |
| ---------------------- | ------------------------------------------ |
| 无正式人工篇章对齐集合 | 新增必备空集合 `passageAlignments`         |
| 页面私有或自动版本配对 | 自动结果仅作投影；人工结果进入统一发布契约 |
| 只支持一段对一段       | `members[].passageIds` 支持一对多和多对多  |
| 建议与数据版本脱离     | 批次绑定 `publicationId + contentChecksum` |
