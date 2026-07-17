# ADR 0005：JSON Schema 作为唯一线契约

状态：已接受
日期：2026-07-16

## 背景

发布物同时由 TypeScript 公众应用和 Python 数据管线消费。手写 TypeScript、JSON Schema 和 Python 校验已经产生规则漂移。

## 决策

JSON Schema 2020-12 是跨进程、跨语言数据的唯一权威来源。TypeScript DTO 从 Schema 生成；Python 使用标准校验器直接执行同一 Schema。跨引用、字符范围和时空顺序等 Schema 难以表达的语义规则，通过共享黄金样本和语义合规测试固定。

领域品牌 ID、行为和值对象位于生成 DTO 之上，不能反向成为第二套线协议。

## 后果

- 禁止手工同步三套枚举和结构；
- 契约变更必须生成代码、迁移器、变更日志及正反例；
- CI 检查生成结果无漂移；
- 当前手写 TypeScript DTO 和 Python结构校验需要渐进迁移。
