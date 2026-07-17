# ADR 0006：事实模块、查询投影与用例分离

状态：已接受
日期：2026-07-16

## 背景

静态仓储逐渐同时承担存储索引、搜索语义、时间线组织和研究判断，导致适配器变成业务巨石。

## 决策

Catalog、Text、Knowledge、Spacetime、Curation 拥有事实。Atlas、Graph、Timeline、Research、Metrics 是只读投影。

- 领域不变量和研究判定进入 domain；
- 用例和投影编排进入 application；
- ports 描述所需事实或技术查询能力；
- adapters 只实现 IO、索引、数据库/搜索/GIS 技术查询；
- apps 只通过用例访问系统。

## 后果

- 静态适配器必须拆分；
- 时间线和研究规则不再随存储实现复制；
- 全文相关性和空间索引等基础设施算法仍可留在 adapter，但语义与返回契约由 application 定义；
- 所有 adapter 必须通过相同端口合规测试。
