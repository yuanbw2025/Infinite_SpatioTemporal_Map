# 统一数据模型

## 文献轴

- `Work`：抽象作品，如一部地方志。
- `SourceRecord/SourceRef`：统一登记来源、馆藏、权利、URL 与校验值，其他记录只引用。
- `SourceRelation`：连接已登记来源的引用、派生、版本、复制、著录和数字化谱系；关系自身保留审核依据。
- `Edition`：通过 SourceRef 可追溯到来源、馆藏与权利说明的具体版本。
- `Volume`：卷、章等有序结构。
- `Passage`：最小稳定引用单元；实体出现、知识证据和搜索结果都回到这里。
- `PassageAlignment`：人工核定的跨版本段落对应组，可表达一对一、一对多和多对多；自动匹配不进入正式事实。
- `FacsimilePage/FacsimileAnchor`：影印页面及段落版面区域锚点，文本阶段可以为空。

## 知识轴

- `Entity`：人物、地点、机构、事件、官职、文物、遗址等规范对象。
- `Mention`：实体在原文中的一次出现，字符偏移永远以 `original` 为准。
- `Assertion`：主语—谓词—对象/值形式的知识主张，必须携带证据和审核状态。
- `EvidenceSpan`：主张所依据的段落与原文字符范围。

## 时空轴

- `TemporalValue`：保留史料时间原文，同时容纳可查询的起止年与不确定性。
- `PlaceIdentity`：跨时期相对稳定的地点身份。
- `HistoricalPlaceName`：某时期使用的地名。
- `HistoricalGeometry`：带有效时期、精度与审核状态的点或面。
- `MapObservation`：地图查询返回的轻量观测，不是新的领域实体。
- `SpatiotemporalOccurrence`：把人物、事件或文博对象连接到历史地点和时间，并携带证据；籍贯、任职、游历、事件现场和文物流转都使用这一结构。

## 文本层

`Passage.text` 分为 `original`、`simplified`、`punctuated` 和 `modernTranslation`。原文是不可变基准；简体转换、标点和白话译文是派生层，允许独立修订，永远不能回写原文。

`TemporalValue` 在保留 `original` 的同时，可使用 `startYear/startMonth/startDay` 与 `endYear/endMonth/endDay` 表达公元范围。缺少可靠换算时只保留原文和 `unknown`，不得猜算。

## 发布边界

`KnowledgePublication` 是公众应用唯一可移植数据边界。首批数据可以是静态 JSON；未来切换 SQLite、PostgreSQL、全文搜索或远程 API 时，仓储适配器仍向应用层提供相同端口。

## 扩展规则

人物、地图、时间线和文博模块不得复制核心对象。模块需要的新属性优先表达为带来源的 `Assertion`；只有真正稳定、普遍、高频且有明确迁移价值的属性才升级为核心字段。

## 目标契约迁移说明

0.8 契约继续遵守 ADR 0010：`Passage` 只保留 `volumeId`，`Volume → Edition → Work` 负责归属；`PassageAlignment` 只引用已有 Work、Edition 与 Passage；地点规范名由 Entity 唯一拥有；作品地域统一进入 coverage；来源统一进入 Source Registry，`SourceRelation` 只连接已有来源；`Assertion.predicate` 使用版本化核心词表。地方社会与文博只生成临时专题投影，不新增平行事实集合。历史数据必须通过迁移器逐版本进入当前契约，不能手工猜测或删改字段。

0.8 的逐字段名称、类型、必填性和引用关系以 `field-dictionary.md` 为准。
