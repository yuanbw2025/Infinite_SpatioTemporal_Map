# 统一工程规则

本文把架构宪章落实为日常编码规则。它适用于 TypeScript、Vue、Python、JSON Schema、数据管线和文档；任何例外都必须通过 ADR，而不能由单个功能自行决定。

## 1. 权威顺序

发生冲突时按以下顺序处理：

1. 已接受的 ADR 与 `architecture.md`；
2. `packages/contracts/schemas` 中当前版本的 JSON Schema；
3. 本规则、字段字典和模块目录；
4. 自动化测试与示例；
5. 具体实现。

实现与上级规则不一致时，修实现；确需改变规则时，先写 ADR、迁移器和测试。文档不能创造 Schema 中不存在的公开字段。

## 2. 一种概念只有一个名字

### 2.1 线协议

- JSON、生成的 TypeScript DTO 和 HTTP 参数统一使用 `camelCase`。
- 枚举值统一使用小写 `snake_case`，例如 `machine_suggested`。
- Python 内部使用 `snake_case`；只允许在契约编解码边界显式转换为 `camelCase`，禁止业务代码同时接受两套键名。
- 类型、接口、Vue 组件使用 `PascalCase`；函数、变量和 composable 使用 `camelCase`；常量使用 `UPPER_SNAKE_CASE`。
- TypeScript 文件使用 `kebab-case.ts`，Vue 组件使用 `PascalCase.vue`，Python 文件使用 `snake_case.py`。入口文件 `index.ts`、`main.ts`、`router.ts` 和工具约定文件除外。

### 2.2 字段后缀

| 含义         | 规则                                 | 示例              |
| ------------ | ------------------------------------ | ----------------- |
| 当前记录主键 | 固定为 `id`                          | `Entity.id`       |
| 单个外键     | `<concept>Id`                        | `passageId`       |
| 外键集合     | `<concept>Ids`                       | `placeIds`        |
| 时间戳       | `<event>At`，RFC 3339 UTC            | `generatedAt`     |
| 历史时间范围 | `TemporalValue` 或 `validDuring`     | `validDuring`     |
| URL          | `<concept>Url`                       | `imageUrl`        |
| 数量         | `<concept>Count`                     | `mentionCount`    |
| 布尔值       | `is/has/can/should` 开头             | `isTruncated`     |
| 顺序         | `sequence`，从 0 开始                | `Volume.sequence` |
| 字符区间     | `start` 含、`end` 不含               | `[start, end)`    |
| 经纬度       | GeoJSON 顺序 `[longitude, latitude]` | `coordinates`     |

禁止 `workID`、`URL`、`numWorks`、`created_time`、`nameList` 等同义写法。

### 2.3 复数、可空和默认值

- 集合字段使用复数名；公开 DTO 中集合存在时始终为数组，不用 `null`。
- “确实不存在”才使用可选字段；“未知”是领域含义时使用显式枚举（如 `certainty: unknown`），不能混用缺失、空串和 `null`。
- 线协议默认省略可选字段，当前契约禁止 `null`；如果未来需要三态语义，必须在 Schema 中显式建模。
- 空字符串不表示缺失。必填文本在 Schema 中使用 `minLength: 1`。
- 布尔字段不得用 `0/1` 或字符串替代。

## 3. 字段所有权与引用

- 每个事实字段只能由一个规范记录拥有，所有权见 `field-dictionary.md`。
- 跨记录只保存品牌 ID，不嵌套另一条规范记录，也不复制其显示名。
- 可由父链稳定推导的字段不落库。例如 Passage 通过 `volumeId → editionId → workId` 归属作品。
- 页面标题、地图标签、计数、搜索摘要和时间线项目都是投影，可以缓存但不能写回 Canonical。
- 投影必须可从同一 Publication 重建；持久化投影必须携带 `publicationId` 与 `contentChecksum`。
- 原始来源写法进入 `original`、`surface` 或来源定位，不为“看起来统一”而覆盖。

## 4. ID 规则

- TypeScript 领域边界使用 `WorkId`、`EntityId` 等品牌类型，禁止用普通 `string` 代替已知 ID。
- ID 一经公开不得因标题、排序、纠错或文件路径变化而改变。
- 管线生成 ID 必须确定性、带命名空间并能检测碰撞；随机 ID 只用于审核事件等真正新生对象。
- 不从 ID 解析业务字段；ID 的可读前缀仅用于诊断。
- 外部系统 ID 不能直接成为本项目主键，应存为来源记录或对齐关系。

## 5. 模块与依赖

- 依赖方向固定为 `contracts ← domain/ports ← application ← apps`，adapter 从外侧实现 port，并仅在组合根注入。
- 目标模块、公开接口和允许依赖见 `module-catalog.md`。
- 功能目录不得相互导入内部组件、store 或 composable。跨功能协作通过应用用例、路由参数和稳定 ID。
- 页面与组件不得读取 `publication.json`、文件系统、数据库或 adapter；`apps/*/platform` 是唯一组合根。
- adapter 负责读取、索引、协议和性能，不负责矛盾判断、审核状态机、时间线语义等业务规则。
- pipeline 只能输出规范事实、审核材料或带版本投影，不输出页面专用业务真相。
- 禁止循环依赖和 workspace 包深层导入；每个包只通过根导出公开 API。

## 6. 应用状态与功能组合

- 一个运行实例只创建一个活动 `DataContext`；所有用例共享同一 `publicationId/contentChecksum`。
- 规范事实不复制进功能 store。长期 UI 状态只保存 ID、筛选条件、游标和展示偏好。
- URL 是可分享探索状态的权威来源：实体、作品、段落、地图视野和时间范围应可编码到路由或查询参数。
- 同一用户动作跨越多个事实模块时，由 application use case 编排，页面不得自行拼接仓储查询。
- 缓存键必须包含 publication 身份与完整查询参数；切换 publication 时整体失效。

## 7. API、查询与错误

- 端口按用例能力拆分，不暴露具体数据库查询语言。
- 列表查询统一 `cursor/limit`，返回 `items/nextCursor`；`limit` 必须有上限。
- 筛选字段使用复数集合，例如 `entityTypes`、`reviewStatuses`；单个中心对象使用 `<concept>Id`。
- 排序必须稳定并含 ID 作为最终次序，确保分页可复现。
- 领域错误使用稳定错误码和结构化上下文，不用错误文案驱动逻辑。
- 预期错误至少区分：`NOT_FOUND`、`INVALID_ARGUMENT`、`CONTRACT_MISMATCH`、`REFERENCE_INTEGRITY`、`PUBLICATION_MISMATCH`、`REVIEW_CONFLICT`、`RIGHTS_RESTRICTED`。
- 边界处把未知异常转为安全的用户信息，同时保留可诊断 cause；不得吞掉一致性错误。

## 8. 契约与数据校验

- JSON Schema Draft 2020-12 是线协议唯一来源；生成代码禁止手改。
- 结构校验之后必须执行语义校验：引用存在、ID 唯一、Mention/Evidence 范围、Assertion 对象和值二选一、时间顺序、GeoJSON 闭环、审核状态迁移和来源/权利完整性。
- TypeScript 和 Python 必须运行同一组正反黄金样本，结果不得漂移。
- 契约破坏性变化升级版本，提供 `N → N+1` 迁移器；不允许读取端静默猜测旧字段。
- 外部 JSON、URL、影印清单和用户导入文件一律视为不可信输入。

## 9. 管线与发布

- 管线阶段为 intake、transcription、segmentation、derivation、candidate、alignment/review、canonical、publication；阶段产物不可混名。
- Raw、Candidate、Decision 采用追加式记录；Canonical 只能通过已接受决策受控更新。
- 发布先在临时目录完整组装和校验，再生成清单与校验值，最后原子替换。禁止逐文件覆盖活动发布物。
- 同输入、同工具版本和同决策日志必须产生字节稳定的规范内容。
- 日志不得泄露令牌或受限原文，且必须包含 run ID、阶段、记录 ID 和可行动错误。

## 10. 代码组织与大小

- 业务文件目标不超过 300 行，400 行是硬上限；CSS 目标按层拆分，单文件硬上限 600 行。
- 现存超限文件记录在 `config/architecture-debt-baseline.json`。它们只能缩小，不能增长；新增文件没有豁免。
- `src/generated` 下由 Schema 确定性生成的文件不受人工文件行数上限约束，但必须通过 `contracts:check` 漂移门禁，且禁止手改。
- Vue 页面只组装用例和展示状态；复杂 IO 进入 controller/composable，复杂地图进入 renderer/layers，重复 UI 进入组件。
- CSS 按 tokens、base、layout、components、features 分层，功能样式靠近功能。
- Python CLI 只做参数解析和命令调度；领域算法和 IO 各自进入可测试模块。
- 一个函数只表达一个决策层级；圈复杂度超过 15、布尔参数控制多种行为或重复分支时必须拆分。

## 11. 测试、文档和完成定义

- 每个领域不变量必须有正常、边界和失败测试；不能只测“页面能打开”。
- 新 adapter 必须通过共同的 port contract tests；新契约字段必须有 TS/Python 一致性样本。
- 修复缺陷先添加能复现问题的测试。
- 文档中的“已实现”必须有代码和测试证据；计划功能明确标注目标版本。
- `pnpm verify` 是本地和 CI 的统一入口，至少执行架构、格式、类型、测试、样本数据校验与构建门禁。
- 不允许通过扩大债务基线、关闭检查或加入永久 ignore 来让失败变绿；豁免必须有 ADR、负责人和移除期限。

## 12. 评审清单

每次变更至少回答：

1. 新信息属于哪个事实所有者，是否已经有同义字段？
2. 哪个用例需要它，哪些功能只是读取投影？
3. 是否只传 ID，并共享同一 DataContext？
4. 空值、未知、不确定、冲突与错误分别怎样表达？
5. 契约、迁移、测试、性能、权利、可访问性和回滚是否完整？
6. 是否增加跨层依赖、大文件、复制状态或第二事实源？
