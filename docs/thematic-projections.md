# 地方社会与文博专题投影规范

## 1. 目标

地方社会和文博不是两套新数据库，而是同一规范事实在不同研究问题下的组合视图。页面只能读取：

- `Entity`：人物、地点、事件、机构、官职、文物、遗址、材料、工艺、纹样、铭文；
- `Assertion`：受控关系或属性，必须带原文证据；
- `SpatiotemporalOccurrence`：实体在某地点和时间的经历；
- `Mention/Passage`：原文出现与证据回链。

专题投影不持久化，不允许复制 preferredName、地点坐标或原文。

## 2. 地方社会专题

| topic         | 事实来源                                        |
| ------------- | ----------------------------------------------- |
| `kinship`     | `family.*` 主张                                 |
| `education`   | `education.*` 主张                              |
| `office`      | `office.*` 主张与 `kind=office` 经历            |
| `association` | `social.*` 主张                                 |
| `mobility`    | 籍贯、居住、游历类经历与地点主张                |
| `events`      | event 实体、参与事件主张和 `kind=event` 经历    |
| `livelihood`  | 人口、户口、赋役、物产、风俗等 `society.*` 主张 |

新增方志高频谓词：

| predicate                 | 值类型 | 主体              | 对象/值            |
| ------------------------- | ------ | ----------------- | ------------------ |
| `society.population`      | 文字   | place/institution | 史料人口原值       |
| `society.households`      | 文字   | place/institution | 史料户口原值       |
| `society.taxation`        | 文字   | place/institution | 赋役、税粮原文值   |
| `society.local_product`   | 实体   | place/institution | material/artifact  |
| `society.tribute_product` | 实体   | place/institution | material/artifact  |
| `society.custom`          | 文字   | place/institution | 风俗原文概述       |
| `event.kind`              | 文字   | event             | 灾异、庆典等原分类 |

人口、户口和赋役暂存史料原值，不擅自统一单位；可比较的数值模型必须在真实数据审查后另立 ADR。

## 3. 文博专题

文博主记录以 `artifact/site` 为中心，专题用例同时汇集：

- `heritage.creator/material/technique/motif/inscription/collection`；
- `heritage.public_name/catalogue_number`；
- creation、discovery、collection 和 other 经历；
- 关联人物、机构、地点、材料、工艺、纹样、铭文；
- 所有主张与经历的证据段落。

材料、工艺、纹样和铭文仍是共享 Entity，可以独立进入知识档案、图谱、检索和时间线。文博页面不得创建自己的“藏品对象”副本。

## 4. 查询与组合

`ThematicRecord` 是只读应用投影，统一包含规范实体、命中的专题、相关主张、时空经历、相关实体和去重证据段落 ID。地方社会支持专题、文字、时间和审核状态组合查询；文博支持对象类型、文字、时间和审核状态组合查询。

点击专题记录进入统一实体档案；点击时间地点进入地图；点击证据进入阅读器。所有功能继续读取同一 `DataContext`。
