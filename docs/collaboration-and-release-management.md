# 协作审核与发布管理

## 原则

多人协作不能让审核工作台直接改正式事实，也不能用“最后保存者覆盖前人”。协作只交换追加式决策包；
正式事实仍由管线在完整验证后生成。发布管理不覆盖历史发布物，只登记不可变发布并追加激活事件。

## 决策协作包

`DecisionBundle` 是三个审核工作区共用的 envelope：

| 字段                  | 含义                                                  |
| --------------------- | ----------------------------------------------------- |
| `version`             | 当前固定为 1                                          |
| `bundleId`            | 协作包唯一 ID                                         |
| `workspace`           | `candidate_review/entity_alignment/passage_alignment` |
| `publicationId`       | 来源发布包                                            |
| `baseContentChecksum` | 来源发布包精确校验和                                  |
| `batchKey`            | 目标候选/对齐批次的稳定键                             |
| `createdAt/createdBy` | 导出时间和人员                                        |
| `decisions`           | 当前工作区原有决策数组，不复制候选或事实              |
| `sourceBundleIds`     | 合并包可选记录的上游包 ID                             |

同一协作会话要求 `workspace + publicationId + baseContentChecksum + batchKey` 全部相同。
`batchKey` 不另造事实 ID：候选审核取 `generatorId:generatedAt`，实体/地点对齐取
`alignerId:generatedAt`，篇章对齐取 `generatorId:generatedAt`。

## 合并与冲突

每类决策使用稳定目标键：

- 候选审核：`candidateId`；
- 实体/地点对齐：`alignmentId`；
- 篇章对齐：`suggestionId`。

合并比较决策的实质结果，忽略 `reviewer` 与 `decidedAt`。不同审核人作出同一实质决策时可自动合并，
报告仍保留来源 bundle ID 和贡献者；实质结果不同则产生 `REVIEW_CONFLICT`，不得自动选择“最新”。

存在冲突时：

1. 不输出可应用的合并决策；
2. 报告每个目标的全部变体、审核人和来源包；
3. 由有权限的编辑者回到证据形成新的裁决包；
4. 新包与无冲突包重新合并。

## 发布登记簿

发布登记簿只保存元数据，不内嵌发布包：

- `releases`：不可变发布记录，包括数据/契约版本、内容校验和、生成时间、制品路径、门禁报告校验和、
  登记人和登记时间；
- `activations`：追加式激活事件，包括目标校验和、预期当前校验和、操作人、时间和理由。

登记发布必须满足：

- 发布包通过完整结构/语义校验；
- release gate 报告 `passed: true`；
- 报告与发布 `publicationId/contentChecksum` 一致；
- 数据版本和内容校验和未登记过；
- 制品路径是非空的稳定部署引用。

激活采用 compare-and-swap：调用者必须提供自己看到的当前校验和。并发变化时拒绝操作。回滚不是删除或
改写旧记录，而是追加一个指向旧校验和的新 activation。

## 标准流程

1. 每位审核者从同一发布校验和和同一批次导出 DecisionBundle。
2. `merge-decision-bundles` 生成合并包和审计报告；任何冲突返回非零状态并阻止应用。
3. 现有 review/resolve 命令应用无冲突决策，生成新发布包。
4. `gate` 完成来源、审核、权利和发布校验。
5. `register-release` 将不可变制品登记入 registry。
6. `activate-release` 使用预期当前校验和原子追加激活事件。
7. 部署系统只读取 registry 的当前激活项；回滚重复第 6 步并指向旧制品。

三个本地工作台都可以导入/导出决策包并检测冲突；冲突时自动导出报告且不覆盖本机进度。远程协作服务未来只需存储相同包和登记簿，不改变事实契约。

具体命令及参数见 [`pipeline/README.md`](../pipeline/README.md)。决策包和登记簿属于可审计流程制品，
不是第二份知识事实；公众功能仍然只读取唯一 `KnowledgePublication`。
