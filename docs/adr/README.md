# 架构决策记录

ADR 记录已经影响或将长期影响项目的技术决定。已接受的 ADR 只有通过新 ADR 才能废止。

| ADR  | 决策                            | 状态                   |
| ---- | ------------------------------- | ---------------------- |
| 0001 | 模块化单体                      | accepted               |
| 0002 | 原创实现与来源治理              | accepted               |
| 0003 | 仓储端口与发布包                | accepted，受 0006 细化 |
| 0004 | MapLibre GIS 引擎与可替换底图   | accepted               |
| 0005 | JSON Schema 作为唯一线契约      | accepted               |
| 0006 | 事实模块、查询投影与用例分离    | accepted               |
| 0007 | 不可变发布物与完整数据血缘      | accepted               |
| 0008 | 自动执行质量门禁                | accepted               |
| 0009 | 唯一规范数据权威与共享运行时    | accepted               |
| 0010 | 字段唯一所有权与 ID 引用模型    | accepted               |
| 0011 | 统一命名、字段所有权与空值语义  | accepted               |
| 0012 | 机器执行模块边界与债务上限      | accepted               |
| 0013 | 规模化查询端口与 IIIF 解析边界  | accepted               |
| 0014 | 版本化核心关系谓词              | accepted               |
| 0015 | 人工版本段落对齐                | accepted               |
| 0016 | 历史地图资源是版本绑定投影      | accepted               |
| 0017 | 地方社会与文博使用专题投影      | accepted               |
| 0018 | 来源谱系与研究规则注册表        | accepted               |
| 0019 | IIIF 瓦片视图与版本绑定语义索引 | accepted               |

## 状态规则

- proposed：讨论中，不能作为实现依据；
- accepted：已接受，必须遵守；
- superseded：被后续 ADR 替代；
- rejected：评审后拒绝；
- deprecated：仍有旧实现，但禁止新增依赖。

ADR 至少包含背景、决策、后果；涉及替代时必须链接前后记录。
