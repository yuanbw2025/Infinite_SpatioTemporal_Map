# 模块目录与依赖契约

本文定义每个模块拥有什么、向外暴露什么、允许依赖什么。目录结构可以迁移，模块职责不能漂移。

## 1. 目标工作区

| 工作区                 | 所有权                                              | 允许依赖                                | 禁止事项                                                  |
| ---------------------- | --------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| `packages/contracts`   | JSON Schema、生成 DTO、品牌 ID、跨边界查询/结果类型 | 无其他 workspace 包                     | 业务行为、Vue、存储、手改生成 DTO                         |
| `packages/domain`      | 领域实体和值对象的不变量与纯规则                    | contracts                               | IO、框架、查询编排、页面投影                              |
| `packages/ports`       | 稳定读取端口                                        | contracts                               | 具体数据库、文件实现或业务投影                            |
| `packages/application` | 用例、权限/事务边界、查询投影编排                   | contracts/domain/ports                  | Vue、MapLibre、文件、数据库客户端                         |
| `packages/adapters`    | 静态包、未来数据库/GIS/HTTP/文件系统实现            | contracts/domain/ports                  | application 用例、领域裁决、UI 状态                       |
| `apps/web`             | 公众路由、交互、可访问性、视图状态                  | contracts/application；adapter 仅组合根 | domain/ports 直连、直接数据读取、事实副本、跨功能内部导入 |
| `apps/curation`        | 候选审核与对齐交互、决策导出                        | contracts                               | domain/ports 直连、直接修改 Canonical/Publication         |
| `pipeline`             | 来源接入、转录、分段、候选、决策应用、发布          | 同一 Schema 和领域规则的语言边界        | 页面专用输出、原地覆盖发布物                              |

旧 `packages/core` 已完成一次性迁移并删除。仓库只保留 `domain → ports/application → adapters/composition root` 这一条架构方向，禁止重新建立第二套内核。

## 2. 领域模块

| 模块      | 唯一拥有的事实                                                | 公共能力                                  | 允许调用                            |
| --------- | ------------------------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| Catalog   | Work、Edition、Volume、SourceRecord                           | 书目层级、来源解析、版本比较基础          | Text 只通过 ID 关系                 |
| Text      | Passage、PassageAlignment、TextLayers、FacsimilePage/Anchor   | 段落顺序、跨版本对应、字符范围、影印定位  | Catalog ID                          |
| Knowledge | Entity、Mention、Assertion                                    | 实体身份、提及校验、主张对象/值与证据规则 | Text ID、TemporalValue              |
| Spacetime | PlaceIdentity、HistoricalName、HistoricalGeometry、Occurrence | 历史名称选择、时空有效性、空间事实        | Knowledge/Text 的 ID 与证据值       |
| Curation  | Candidate、ReviewDecision、AlignmentDecision、Release         | 状态机、并发修订、对齐决策、发布准入      | 全部事实类型的候选 DTO，不直接改 UI |

领域模块之间不直接编排用户流程；跨模块流程属于 application。

## 3. 应用用例模块

| 用例模块  | 输入                       | 读取                           | 输出投影/行为                                |
| --------- | -------------------------- | ------------------------------ | -------------------------------------------- |
| Catalog   | WorkQuery、WorkId          | Catalog/Text ports             | 作品列表、版本与卷目录                       |
| Reader    | PassageId、版本对读参数    | Text/Knowledge ports           | PassageContext、人工优先异文投影、提及与证据 |
| Entity    | EntityId                   | Knowledge/Text/Spacetime ports | EntityProfile                                |
| Discovery | SearchQuery                | search port + 事实 ports       | SearchHit page                               |
| Atlas     | AtlasQuery                 | Spacetime/Knowledge ports      | MapObservation page                          |
| Graph     | KnowledgeGraphQuery        | Knowledge ports                | nodes/edges                                  |
| Timeline  | TimelineQuery              | Knowledge/Spacetime ports      | tracks/items                                 |
| Research  | ResearchQuery              | Knowledge/Spacetime ports      | 可解释的冲突与缺失线索                       |
| Metrics   | 无或 publication ID        | 所有只读 ports                 | DatasetOverview                              |
| Curation  | candidate/decision command | curation/canonical ports       | 追加式决策与发布请求                         |

投影类型属于用例输出，不得被 pipeline 当作规范输入，也不得反向写入事实仓储。

## 4. 端口边界

端口按稳定能力拆分：

- `PublicationReadPort`：一次提供活动发布包及其唯一 `DataContext`；
- `SearchIndexPort`：在数据规模扩大后替换内存检索，输入输出仍使用统一查询契约；
- `SpatialQueryPort`：在数据规模扩大后替换内存地图投影，不改变地图观察项语义；
- `FacsimileImagePort`：隔离 IIIF/远程影像协议，阅读用例只接收统一影像资源；
- 新数据库、全文索引、空间数据库或远程 API 必须实现技术适配器，而不是复制用例；
- 写入仍由 Python 发布管线承担，公众读取端保持只读；未来协作写入能力需要独立 ADR 后再新增小端口。

仓储返回规范记录或 ID，不返回页面组件需要的拼装对象。拼装由 use case 完成。

## 5. Web 功能边界

`apps/web/src/features/<feature>` 只能依赖：

- 本功能内部文件；
- `apps/web/src/components` 中无业务所有权的共享展示组件；
- `apps/web/src/composables` 暴露的应用入口；
- contracts 中的只读 DTO 类型。

功能之间通过路由和稳定 ID 联动。例如地图点击只导航到 `entityId/passageId`，不能导入实体页面的 store。只有 `apps/web/src/platform/application.ts` 可以创建 adapter 与 ApplicationRuntime，`main.ts` 只安装该运行时。

## 6. 数据进入与读取边界

```text
source → pipeline stages → canonical → immutable publication
                                      ↓
                           platform composition root
                                      ↓
                              one DataContext
                                      ↓
               application use cases / feature projections
```

- 数据只从 pipeline 进入 Canonical；编辑 UI 输出 Decision，不直接写事实。
- 公众读取只从组合根进入；功能模块不能各自 fetch 数据。
- 所有 ID 引用在 publication 加载时一次性做完整性校验。
- adapter 可建立一套共享只读索引；不得为每个功能复制 publication。

## 7. 变更路由

| 需求       | 应修改                                  | 不应修改                                |
| ---------- | --------------------------------------- | --------------------------------------- |
| 新人物属性 | 优先新增 predicate/Assertion            | Entity 页面私有字段                     |
| 新地图展示 | Atlas use case/renderer                 | 新地点副本                              |
| 新存储     | adapter + port contract tests           | domain/application 语义                 |
| 新来源类型 | SourceRecord enum/Schema/管线           | 页面专用来源对象                        |
| 新审核状态 | Curation 状态机 + Schema + 迁移 ADR     | UI 字符串判断                           |
| 新事实概念 | ADR、字段所有者、Schema、迁移、领域规则 | 任意 `Record<string, unknown>` 长期承载 |
