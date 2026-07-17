# Infinite SpatioTemporal Map

无限时空图是一座面向中国地方志的时空博览库。项目从可靠文本起步，把方志中的地点、人物、事件与文博资料组织为可追溯的知识，并最终支持跨朝代的地图漫游。

## 当前阶段

这是全新原创架构的首个可运行产品版本。方志书库、单层与并列阅读、实体档案、证据回溯、知识图谱、历史时间线、人物行迹、时空地图、文博浏览、研究线索、全库检索和数据状态页面均已接入统一应用服务。

公众探索面和数据生产面已经具备主要原型，但当前实现尚未达到正式发布质量。项目现阶段优先统一可执行契约、修复发布安全、恢复分层边界、建立完整测试门禁，再接入真实方志完成证据闭环。详见[原始愿景与现状差距审计](docs/vision-gap-analysis.md)。

## 架构约束

- 单一领域内核：所有模块共享同一套文献、段落、实体、地点、事件和证据模型。
- 模块化单体：书库、阅读器、地图和文博是同一应用中的功能模块，不建立平行技术栈。
- 依赖方向固定：展示层 → 应用内核 → 数据契约；数据管线也只能输出同一契约。
- 证据优先：任何知识主张都必须指向来源段落。
- 文本分层：原文、简体转换、句读、白话译文分别保存，派生层永不覆盖原文。
- 渐进扩展：现成文本先行，影印页后续通过预留锚点接入。

当前冻结非必要功能扩张，优先执行契约统一、发布安全、分层重构和测试门禁。目标架构与参赛级质量基线分别见[核心架构宪章](docs/architecture.md)、[架构迁移路线](docs/architecture-migration.md)和[质量标准](docs/quality-standard.md)。

## 工作区

```text
apps/web              公众博览应用
apps/curation         本地优先的候选审核工作台
packages/contracts    唯一的数据交换契约
packages/core         领域规则、应用端口和模块内核
packages/adapters     静态发布包及未来存储的适配层
pipeline              数据导入、校验与发布管线
docs                  愿景、架构、数据和决策文档
data/fixtures          可公开的小型测试样本
```

## 本地命令

```bash
pnpm install
pnpm dev
pnpm dev:curation
pnpm data:validate
pnpm verify
```

地图使用 MapLibre GL JS。默认底图无需密钥，也可通过 `VITE_MAP_STYLE_URL` 切换为自建或其他兼容样式。

## 从哪里继续

- [总体架构](docs/architecture.md)
- [架构迁移路线](docs/architecture-migration.md)
- [参赛级质量标准](docs/quality-standard.md)
- [项目治理与交付机制](docs/project-governance.md)
- [数据进入、字段所有权与功能组合蓝图](docs/data-feature-blueprint.md)
- [0.4 字段字典](docs/field-dictionary.md)
- [统一工程规则](docs/engineering-rules.md)
- [模块目录与依赖契约](docs/module-catalog.md)
- [架构决策记录](docs/adr/README.md)
- [功能架构](docs/functional-architecture.md)
- [统一数据模型](docs/data-model.md)
- [数据接入手册](docs/data-onboarding.md)
- [扩展指南](docs/extension-guide.md)
- [开发路线](docs/roadmap.md)
- [原始愿景与现状差距审计](docs/vision-gap-analysis.md)

## 权利说明

项目暂未授予开源许可证。第三方通用依赖按各自许可证使用，业务代码、数据和文档不得混入来源不清的参考项目内容。
