# 来源链与研究规则

## 目标

无限时空图必须同时回答两个问题：

1. 一条数据由哪一份史料、哪一版整理或哪一次数字化而来；
2. 哪些记录值得研究者回到原文复核，以及触发提示的规则是什么。

来源链和研究线索都不得成为第二套事实系统。来源链引用唯一的 `SourceRecord` 注册表；研究规则只读同一
`KnowledgePublication`，输出临时的 `ResearchFinding` 投影，不写回史实。

## 唯一来源模型

### SourceRecord

`SourceRecord` 仍是所有来源的唯一身份记录。影印本、转录本、目录、GIS 数据、外部数据集和参考文献都在
`sources` 中登记，其他集合只能通过 `sourceId` 或 `SourceRef` 引用它。

### SourceRelation

`sourceRelations` 只描述两个已登记来源之间的可审核关系：

| 字段              | 含义                                                 |
| ----------------- | ---------------------------------------------------- |
| `id`              | 全发布包唯一关系 ID                                  |
| `subjectSourceId` | 关系起点来源                                         |
| `relationType`    | 受控关系类型                                         |
| `objectSourceId`  | 关系终点来源                                         |
| `sourceRefs`      | 证明这条关系的来源及页码、条目号等定位信息，至少一条 |
| `evidence`        | 可选的原文字符区间；只能指向本发布包段落             |
| `note`            | 可选编辑说明，不承载新的结构化事实                   |
| `reviewStatus`    | 审核状态                                             |

关系方向固定，不靠页面猜测：

| `relationType` | 方向示例                               |
| -------------- | -------------------------------------- |
| `cites`        | 主体来源引用客体来源                   |
| `derived_from` | 主体来源的数据或文字派生自客体来源     |
| `edition_of`   | 主体来源是客体来源所代表内容的一个版本 |
| `reproduces`   | 主体来源复制、翻拍或重印客体来源       |
| `catalogues`   | 主体来源著录客体来源                   |
| `digitizes`    | 主体来源是客体来源的数字化产物         |

同一 `subjectSourceId + relationType + objectSourceId` 不得重复；起点和终点不得相同。关系不做传递闭包，
例如 A 派生自 B、B 派生自 C，不自动断言 A 派生自 C。

## 查询投影

`provenance.openSource(sourceId, depth)` 从唯一来源注册表和 `sourceRelations` 生成：

- 中心来源；
- 指定深度内的来源节点；
- 节点之间的直接关系；
- 引用该来源的作品和版本。

深度限制为 0–4，默认 2；遍历同时沿入边和出边进行，但原始关系方向保持不变。页面不得自行遍历发布包。

## 研究规则注册表

### 内置规则

现有四项检查拆分为有稳定 ID 的独立规则：

- `core.contradictory-assertions`
- `core.disputed-records`
- `core.unresolved-geometry`
- `core.chronology-conflicts`

每条 `ResearchFinding` 必须记录 `ruleId`，使研究者知道提示由哪条规则产生。

### 外部规则端口

可选 `ResearchRulePort` 接收：

- 当前不可变 `DataContext`；
- 当前 `KnowledgePublication`；
- 研究查询条件。

端口返回研究线索，不得返回修改后的发布包。应用层在合并结果前验证：

- `ruleId`、finding ID、标题和说明不能为空；
- entity、assertion、passage 引用必须存在；
- finding kind 必须属于受控类型；
- 同一 finding ID 不得覆盖另一条结果。

外部规则失败时整个研究请求明确失败，不静默伪装为“没有线索”。规则端口是替换点，不是页面插件；
UI 始终消费同一 `ResearchReport`。

## 数据进入路径

1. 采集阶段先将来源登记为 `SourceRecord`。
2. 编辑者提出 `SourceRelation` 候选，并填写能复核的 `sourceRefs`。
3. 管线验证引用、方向、自环、重复关系和证据区间。
4. 发布时关系与来源一起进入同一不可变发布包并参与校验和。
5. 应用建立共享索引，来源页、作品页和研究功能读取同一索引。
6. 研究规则只产生运行时投影；若要形成正式事实，必须回到正常编辑审核流程。

## 明确禁止

- 不把来源伪装成 `Entity`，也不使用普通 `Assertion` 表示版本或数字化谱系。
- 不从 URL、标题相似度或数组顺序自动断言来源关系。
- 不让规则插件直接写 `assertions`、`occurrences` 或 `sourceRelations`。
- 不在页面中实现另一套来源图或研究判断。
- 不把“未发现线索”解释成“史料不存在问题”。
