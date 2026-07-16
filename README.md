# Infinite SpatioTemporal Map

无限时空图是一座面向中国地方志的时空博览库。项目从可靠文本起步，把方志中的地点、人物、事件与文博资料组织为可追溯的知识，并最终支持跨朝代的地图漫游。

## 当前阶段

这是全新原创架构的首个可运行产品版本。方志书库、分层阅读、实体档案、证据回溯、人物行迹、时空地图、文博浏览、全库检索和数据状态页面均已接入统一应用服务；目前唯一缺少的是正式方志发布包。

## 架构约束

- 单一领域内核：所有模块共享同一套文献、段落、实体、地点、事件和证据模型。
- 模块化单体：书库、阅读器、地图和文博是同一应用中的功能模块，不建立平行技术栈。
- 依赖方向固定：展示层 → 应用内核 → 数据契约；数据管线也只能输出同一契约。
- 证据优先：任何知识主张都必须指向来源段落。
- 文本分层：原文、简体转换、白话译文永不混存。
- 渐进扩展：现成文本先行，影印页后续通过预留锚点接入。

## 工作区

```text
apps/web              公众博览应用
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
pnpm data:validate
pnpm verify
```

地图使用 MapLibre GL JS。默认底图无需密钥，也可通过 `VITE_MAP_STYLE_URL` 切换为自建或其他兼容样式。

## 从哪里继续

- [总体架构](docs/architecture.md)
- [功能架构](docs/functional-architecture.md)
- [统一数据模型](docs/data-model.md)
- [数据接入手册](docs/data-onboarding.md)
- [扩展指南](docs/extension-guide.md)
- [开发路线](docs/roadmap.md)

## 权利说明

项目暂未授予开源许可证。第三方通用依赖按各自许可证使用，业务代码、数据和文档不得混入来源不清的参考项目内容。
