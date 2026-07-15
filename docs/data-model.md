# 统一数据模型

## 文献轴

- `Work`：抽象作品，如一部地方志。
- `Edition`：可追溯到来源、馆藏与权利说明的具体版本。
- `Volume`：卷、章等有序结构。
- `Passage`：最小稳定引用单元；实体出现、知识证据和搜索结果都回到这里。
- `FacsimileAnchor`：未来影印页及版面区域锚点，文本阶段可以为空。

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

`Passage.text` 分为 `original`、`simplified` 和 `modernTranslation`。原文是不可变基准；简体转换和白话译文是派生层，允许独立修订，永远不能回写原文。

## 发布边界

`KnowledgePublication` 是公众应用唯一可移植数据边界。首批数据可以是静态 JSON；未来切换 SQLite、PostgreSQL、全文搜索或远程 API 时，仓储适配器仍向应用层提供相同端口。

## 扩展规则

人物、地图、时间线和文博模块不得复制核心对象。模块需要的新属性优先表达为带来源的 `Assertion`；只有真正稳定、普遍、高频且有明确迁移价值的属性才升级为核心字段。
