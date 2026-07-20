# Data policy

- `fixtures/` 只保存来源明确、体积很小、可公开的测试样本。
- `raw/` 保存原始材料，不进入 Git。
- `private/` 保存权利不明确或只限本地研究的数据，不进入 Git。
- `derived/` 保存可重复生成的大型产物，不进入 Git。
- 每个公开数据集必须有来源、版本、权利状态和校验值清单。

可选派生资源放在站点 `public/data` 下，并始终绑定规范发布包：

- `map-resources.json`：历史栅格地图和疆域投影目录；
- `semantic-index.json`：只含规范对象 ID 与向量的语义索引，格式见
  `pipeline/examples/semantic-index.example.json`。
