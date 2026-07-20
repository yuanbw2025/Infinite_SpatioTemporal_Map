# 核心架构迁移路线

目标是在不推翻现有领域模型和功能成果的前提下，把当前原型迁移到架构宪章。迁移期间冻结非必要新功能。

## 完成基线（2026-07-20）

| 方面     | 当前事实                                         | 目标                       | 状态              |
| -------- | ------------------------------------------------ | -------------------------- | ----------------- |
| 规则     | 架构、字段、模块和工程规则已成文                 | 规则可由 CI 执行           | 第一层完成        |
| 依赖     | domain/ports/application 已物理分离              | 固定单向依赖并由 CI 执行   | P1 完成           |
| 契约     | Schema 生成 TS DTO，Python/浏览器执行同一 Schema | Schema 单一生成源          | P0.1 完成         |
| 字段     | 0.4 已删除重复字段，0.3 由显式迁移器接入         | 0.4 字段字典               | P0.2 完成         |
| 发布     | 全量暂存、碰撞检查、校验和与原子替换             | 失败不改变活动发布         | P0.3 完成         |
| 运行时   | web 与审核批次绑定 publicationId/contentChecksum | 唯一 DataContext           | P0.4 完成         |
| 业务规则 | 图谱/时间线/研究规则位于 application/domain      | adapter 只做技术读取       | P1 完成           |
| 文件规模 | 原 6 个锁定债务文件全部拆分                      | 新文件均遵守硬上限         | P2 完成，债务为零 |
| 测试     | TS、地图控制器、审核边界和 Python 管线均有回归   | 测试矩阵与覆盖率门禁       | P2 完成           |
| CI       | verify 已含契约、覆盖率、密钥与许可证门禁        | 继续加入 SBOM 与端到端检查 | P0.6 完成         |

锁定债务仍以 `config/architecture-debt-baseline.json` 为准；当前 `files` 为空，新债务不得加入而不经过 ADR。

## 执行规则

1. 严格按 P0 → P1 → P2 执行；P0 未退出前不扩张新的公众功能。
2. 每个工作包只能有一个架构意图，先提交测试/样本，再迁移实现。
3. 新结构接管全部调用并通过门禁后，立即删除旧结构；不长期维护两套并行架构。
4. 契约迁移先生成 0.4 正反例和迁移器，再切换 pipeline，最后切换应用读取。
5. 每个工作包必须更新状态、ADR/文档、风险与回滚方式，不能以“代码已写”代替验收。

## P0：先恢复可信性

1. 选定 JSON Schema 为唯一线契约，生成 TypeScript DTO，Python 执行同一 Schema。
2. 统一 `Assertion` 等已漂移规则，增加契约正反例。
3. 设计 0.4 契约迁移器：删除 Passage/Place/Work 重复字段，增加 SourceRecord/SourceRef，并用只读索引替代冗余归属字段。
4. 修复 `promote` 覆盖既有分片：临时目录、合并、碰撞检查、完整校验、原子发布。
5. 为 segmentation、publication、curation、alignment、release 增加 Python 测试。
6. CI 加入依赖边界、契约漂移、测试覆盖率和发布门禁。
7. 引入唯一 `DataContext` 身份，验证所有服务共享同一 `publicationId/contentChecksum`。

退出条件：三套契约不再漂移；发布命令不能破坏旧数据；关键管线有测试。

### P0 工作包与验收

| ID   | 工作包        | 必须产物                                                            | 验收证据                                      |
| ---- | ------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| P0.1 | Schema 权威化 | 0.4 Schema、生成脚本、生成 DTO、Python validator                    | 完成：TS/Python 共用金标准样例与漂移门禁      |
| P0.2 | 字段迁移      | 0.3→0.4 迁移器、迁移报告、ID/引用校验                               | 完成：冲突或来源不明时拒绝猜测                |
| P0.3 | 发布安全      | staging builder、collision check、manifest/checksum、atomic replace | 完成：失败不修改活动文件的回归测试            |
| P0.4 | DataContext   | publication identity、共享索引、版本不匹配错误                      | 完成：运行时和审核批次绑定 ID + checksum      |
| P0.5 | 管线保护      | segmentation/publication/curation/alignment/release 测试            | 完成：关键成功、失败与回滚路径可重复          |
| P0.6 | 门禁增强      | contract drift、Python test、coverage、secret/license checks        | 完成：初始阈值与仓库卫生进入 verify，只可上调 |

## P1：恢复六边形边界

1. 把 1121 行静态仓储拆成共享 `PublicationIndex` 和按端口独立适配器。
2. 把时间线、研究规则、质量推导移入 domain/application。
3. 应用服务从简单转发改为明确用例；adapter 只做读取、索引和技术查询。
4. 所有适配器运行统一合规测试。

退出条件：adapter 不包含领域裁决；新增存储不要求复制业务逻辑。

### P1 工作包与验收

| ID   | 工作包              | 必须产物                                                 | 验收证据                                   |
| ---- | ------------------- | -------------------------------------------------------- | ------------------------------------------ |
| P1.1 | 建立 domain 包      | catalog/text/knowledge/spacetime/curation 纯规则         | 无框架/IO 依赖；关键不变量测试             |
| P1.2 | 建立 ports 包       | 小型事实仓储与基础能力端口                               | 无 adapter 类型泄漏；端口职责单一          |
| P1.3 | 建立 application 包 | reader/entity/atlas/graph/timeline/research/metrics 用例 | 跨模块组合只发生在 use case                |
| P1.4 | 拆静态 adapter      | PublicationIndex + 各 port 实现                          | 千行文件退出债务；共同合规测试通过         |
| P1.5 | 移除 core           | 导出迁移与调用方切换                                     | 仓库不再出现第二套 core/application/domain |

## P2：整理展示与编辑应用

1. 拆分审核应用的文件导入、持久化、决策状态机和视图组件。
2. 拆分地图 renderer、图层配置、视野控制和时间控制。
3. 将全局 CSS 拆为 tokens/base/layout/components/features。
4. 增加组件测试、键盘操作和错误恢复测试。

退出条件：核心页面可独立测试；大文件降到质量基线；WCAG 核心路径通过。

### P2 工作包与验收

| ID   | 工作包       | 必须产物                                            | 验收证据                                 |
| ---- | ------------ | --------------------------------------------------- | ---------------------------------------- |
| P2.1 | Web 控制器化 | 页面 controller/composable、展示组件                | 页面不做 IO/业务拼装；组件测试通过       |
| P2.2 | 地图拆分     | renderer、layers、viewport、time/filter controllers | 地图文件退出债务；替代列表与键盘路径可用 |
| P2.3 | 审核端拆分   | import、persistence、decision state machine、views  | 决策不可覆盖；冲突与恢复有测试           |
| P2.4 | 样式分层     | tokens/base/layout/components/features              | 两个 CSS 文件退出债务；无全局泄漏        |
| P2.5 | E2E 与性能   | 关键用户链、bundle/interaction budgets              | 证据回溯链通过；性能预算不退化           |

## P3：真实数据闭环

1. 选一部来源与权利清晰的方志作为公开黄金样本。
2. 跑通来源→转录→分段→提取→审核→对齐→发布→公众回溯。
3. 建立数据回归、性能基准和可复现演示。

退出条件：从零可重复生成同一发布物；任何展示知识都能回到原文。

## P4：参赛与公开治理

补齐双语文档、许可证、贡献指南、安全政策、行为准则、变更日志、SBOM、演示站和架构说明视频，并邀请外部开发者与方志领域专家分别评审。
