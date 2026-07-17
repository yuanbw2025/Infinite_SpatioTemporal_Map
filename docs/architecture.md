# 核心架构宪章

本文是无限时空图最高级别的技术架构文件。功能设计、代码实现、数据生产和部署方案与本文冲突时，必须先提交 ADR 修改本文，不能用临时代码绕过。

## 1. 架构目标

无限时空图不是地图网站，也不是方志阅读器的功能拼盘。它是以地方志为核心来源、以证据为基础、同时组织文献、知识、时间和空间的历史知识系统。

架构必须同时满足：

1. **学术可信**：任何公开知识都能回到版本、卷章、段落，最终可锚定影印页。
2. **语义统一**：阅读、地图、图谱、时间线、人物和文博共享同一对象，不复制事实。
3. **渐进扩展**：从一部文本型方志起步，扩展到影印本、多方志和全国数据时不重写功能。
4. **可替换基础设施**：静态包、数据库、全文索引、空间服务和瓦片服务可以替换，领域语义不变。
5. **可公开审查**：契约、来源、审核、测试、性能、安全和决策记录都可复现。

## 2. 不可破坏的架构原则

### A1：单一事实源

- `Work / Edition / Volume / Passage` 是文献事实。
- `Entity / Mention / Assertion` 是知识事实。
- `PlaceIdentity / HistoricalGeometry / SpatiotemporalOccurrence` 是时空事实。
- 搜索结果、图谱边、时间线项目、地图观测和研究线索都是投影，不是新的事实模型。

任何模块不得保存上述事实的私有副本。

更严格地说：

- 任一数据版本只有一个 `Canonical Dataset`；
- 任一运行实例只激活一个 `Publication Revision`；
- 所有公众功能共享同一个 `ApplicationRuntime/DataContext` 和同一组仓储实例；
- 模块之间只传递 `WorkId / PassageId / EntityId / PlaceIdentityId` 等稳定引用，不复制完整对象作为持久状态；
- Raw、Staging、Candidate、Decision 是生产与审计材料，不是公众功能可读取的业务数据；
- 搜索索引、地图瓦片、图谱邻接表、时间线缓存属于可丢弃投影，必须标注来源发布 ID 和校验值，版本不一致时拒绝加载；
- 投影只能从规范数据重建，不能反向写回或单独修订。

### A2：证据优先

- 正式主张和时空经历必须有 `EvidenceSpan`。
- 机器结果只能是候选。
- 矛盾记载并列保存，不自动裁决。
- 用户必须能从图谱、地图、时间线和百科返回原文。

### A3：原文不可变

`text.original` 是字符偏移、引用和审核的唯一基准。简体、标点、白话、翻译和 AI 输出只能作为独立派生层。

### A4：依赖只能向内

展示和基础设施依赖应用与领域；领域不依赖 Vue、MapLibre、文件、数据库、网络或具体 AI/OCR 工具。

### A5：所有扩展沿既有边界生长

新增功能先判断属于既有事实、主张、投影还是用例。只有形成新的稳定领域概念时才能扩展契约；不得为单个页面创建平行模型、状态仓库或后端。

### A6：契约必须可执行

跨语言数据不能靠 TypeScript、Python 和文档人工同步。JSON Schema 2020-12 是唯一线协议真相；TypeScript DTO 由它生成，Python 直接执行它。领域品牌 ID 和行为在生成 DTO 之上封装。

### A7：公开发布只能由管线产生

公众应用只读版本化发布物。原件、转录、候选、审核决策和规范数据分别保存；任何 UI 都不能直接改生产发布包。

## 3. 领域模块

| 模块      | 拥有的事实                                                         | 主要职责                               | 不负责             |
| --------- | ------------------------------------------------------------------ | -------------------------------------- | ------------------ |
| Catalog   | Work、Edition、Volume、SourceRecord                                | 书目、版本、来源、馆藏、权利、卷章     | 正文内容、实体知识 |
| Text      | Passage、TextLayers、FacsimilePage、FacsimileAnchor                | 稳定段落、版本文本、影印锚点、引用范围 | 人物档案、地图坐标 |
| Knowledge | Entity、Mention、Assertion                                         | 规范实体、原文提及、带证据主张         | 空间投影、全文索引 |
| Spacetime | PlaceIdentity、HistoricalName、Geometry、Occurrence、TemporalValue | 历史地点身份、时空有效性、行迹与流转   | 地图渲染、瓦片格式 |
| Curation  | Candidate、ReviewDecision、AlignmentDecision、Release              | 候选、审核、消歧、发布门禁             | 公众查询、私改事实 |

### 查询投影

以下能力只读事实模块，不拥有事实：

- Discovery：全文与组合检索；
- Atlas：把地点、几何、经历投影为 `MapObservation`；
- Graph：把带对象的主张投影为节点与边；
- Timeline：把主张和经历投影为时间轨道；
- Research：发现矛盾、争议、缺失和异常，不能自动修改原记录；
- Metrics：计算覆盖率、审核分布和发布质量。

## 4. 分层与依赖方向

```text
┌──────────────────────────────────────────────────────────────┐
│ apps/web（公众只读）       apps/curation（编辑决策）          │
└──────────────────────────────┬───────────────────────────────┘
                               │ use cases / DTO
┌──────────────────────────────▼───────────────────────────────┐
│ application：用例、权限边界、事务边界、查询投影编排          │
├──────────────────────────────────────────────────────────────┤
│ domain：实体规则、值对象、证据/文本/时空不变量、领域服务      │
├──────────────────────────────────────────────────────────────┤
│ ports：事实仓储、搜索、空间查询、发布物、时钟、ID、事务端口   │
└──────────────────────────────┬───────────────────────────────┘
                               │ implementations
┌──────────────────────────────▼───────────────────────────────┐
│ adapters：静态发布物、数据库、全文索引、GIS、HTTP、文件系统   │
└──────────────────────────────────────────────────────────────┘

raw sources → staging → candidates → decisions → canonical data
                                              → publication artifact
```

允许的依赖：

```text
contracts/generated ← domain ← application ← apps
                           ↑          ↑
                           └── ports ─┘ ← adapters（在组合根注入）
```

禁止：

- domain/application 导入 Vue、MapLibre、Node 文件 API、数据库客户端；
- 页面直接导入发布 JSON 或 adapter；组合根除外；
- adapter 实现矛盾判定、时间线语义等领域规则；
- 功能模块互相导入内部组件或状态；
- pipeline 输出页面专用结构。

## 5. 目标代码结构

```text
apps/
  web/                      公众只读应用
  curation/                 审核与对齐应用
packages/
  contracts/
    schema/                 唯一 JSON Schema 源
    generated/              自动生成 DTO，禁止手改
    domain-ids/             品牌 ID 与安全构造器
  domain/
    catalog/ text/ knowledge/ spacetime/ curation/
  application/
    catalog/ reader/ knowledge/ atlas/ graph/ timeline/ research/
  ports/                    技术无关接口
  adapters/
    static-publication/     分模块仓储 + 共享只读索引
pipeline/
  intake/ transcription/ segmentation/ enrichment/
  alignment/ review/ publication/
tests/
  contract/ fixtures/ e2e/
```

当前目录允许渐进迁移，不为追求目录漂亮进行一次性重写；每次迁移必须由测试保护。

## 6. 数据与契约架构

### 运行时唯一数据视图

```text
                    one active Publication Revision
                                  │
                         shared DataContext
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
          Reader               Atlas               Knowledge
             │                    │                    │
          PassageId      PlaceId / EntityId       EntityId
             └────────────────────┼────────────────────┘
                                  │
                       same canonical records
```

Reader、Atlas、Graph、Timeline、Search、Research 和 Metrics 不能分别加载或维护 publication。组合根只创建一次数据上下文，各应用服务共享它。将来换成数据库时也只有一个规范存储；全文索引、空间索引和瓦片只是带版本的派生设施。

### 唯一契约源

1. `packages/contracts/schemas` 保存版本化 JSON Schema。
2. TypeScript DTO 由 Schema 生成，生成文件不可手改。
3. Python 使用标准 Draft 2020-12 校验器读取相同 Schema。
4. 语义校验（跨引用、字符范围、时空顺序）由共享合规测试固定。
5. 破坏性变更升级契约版本并提供迁移器、正反例和变更日志。

### 数据分层

| 层          | 内容                          | 是否可变   | 是否公开  |
| ----------- | ----------------------------- | ---------- | --------- |
| Raw         | 原件、下载信息、校验值、权利  | 只追加     | 否/按权利 |
| Staging     | OCR、转录、无损分段、派生文本 | 可重建     | 否        |
| Candidate   | 机器/规则提案                 | 只追加版本 | 否        |
| Decision    | 人工审核、对齐、修订记录      | 追加式     | 可审计    |
| Canonical   | 已接受的规范事实              | 受控修订   | 内部      |
| Publication | 不可变版本化快照              | 不可修改   | 是        |

这里的多层表示数据生命周期，不表示多份可独立编辑的真相。Canonical 是唯一规范事实；Publication 是它在某一版本上的不可变交付快照，两者之间必须由确定性发布过程连接，不能人工分别维护。

发布必须使用临时目录组装、完整校验、生成清单和校验值，最后原子替换；禁止直接覆盖已有分片。

## 7. 应用与适配器职责

### Domain

负责：原文不变量、证据要求、时空范围、审核状态机、实体合并规则、争议语义。

### Application

负责：打开作品、读取段落、构建档案、投影时间线、生成研究线索、组织发布等用例；只依赖端口。

### Ports

按能力拆分，接口小而稳定。存储端口返回事实；全文/空间等技术查询允许专门端口，但查询含义由 application 定义。

### Adapters

负责文件、数据库、索引、空间引擎和网络协议。静态适配器可以建立共享索引，但不得拥有业务判定。每个适配器必须通过同一套端口合规测试。

### Apps

负责交互、可访问性、路由和视图状态。复杂 IO 与状态进入 composable/controller；组件以展示为主。编辑端只导出决策，不直接写发布物。

## 8. 规模化策略

演进顺序固定：

1. 静态发布包 + 浏览器索引，完成首部方志闭环；
2. 发布包分片与按需加载；
3. 端口后增加全文索引、PostgreSQL/PostGIS、对象存储；
4. 大规模几何改用 PMTiles/矢量瓦片；
5. 只有出现独立扩缩容、权限或团队边界时才拆服务。

任何阶段都不改变领域 ID、证据链和公众用例。

## 9. 架构治理

- 架构变化必须有 ADR，状态为 proposed/accepted/superseded/rejected。
- CI 必须执行依赖边界、契约生成无漂移、适配器合规和发布门禁。
- 单个 PR 只能引入一个清晰架构意图；跨模块变更写明影响面和回滚方式。
- 架构质量标准见 `docs/quality-standard.md`。
- 统一命名、空值、错误、状态与编码规则见 `docs/engineering-rules.md`。
- 字段唯一所有者与目标 0.4 名称见 `docs/field-dictionary.md`。
- 模块公开接口与允许依赖见 `docs/module-catalog.md`。
- 当前代码向本架构迁移的顺序见 `docs/architecture-migration.md`。

### 单一数据源自动检查

CI 至少执行：

1. 禁止功能模块直接导入 `public/data`、数据库客户端或 adapter；只有组合根可以装配 adapter。
2. 检查一个运行时只创建一个活动 `DataContext`，所有服务报告相同 `publicationId` 与校验值。
3. 对搜索、空间和瓦片投影执行版本一致性测试；来源版本不同必须失败。
4. 执行引用完整性测试，禁止把嵌套对象副本当成跨模块引用写入契约。
5. 从 Canonical 重建 Publication 两次必须产生相同内容校验值。
