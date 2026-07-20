# IIIF 深度影像与语义检索

## IIIF 深度影像

### 数据权威

规范数据只保存 `FacsimilePage.canvasUrl`、可选直接 `imageUrl`、页面尺寸和段落 `FacsimileAnchor`。
IIIF Presentation Canvas 与 Image API `info.json` 是远程影像协议投影，不进入第二份方志事实。

### 解析流程

1. `FacsimileImagePort` 读取 Presentation 2/3 Canvas。
2. 适配器只接受 HTTP(S) URL，并提取直接图像、尺寸和 Image API service ID。
3. 有 Image API service 时返回 `infoUrl`；阅读器按需加载瓦片视图。
4. 没有 Image API service 时继续使用安全的直接图像。
5. 同一 Canvas 请求缓存；失败请求从缓存移除，允许用户重试。

瓦片视图支持连续缩放、拖拽、复位、全屏、键盘控制和段落区域覆盖。覆盖区域仍使用规范
`FacsimileAnchor.region: [x, y, width, height]`，不得把查看器坐标写回发布包。

## 语义检索

### 查询契约

`SearchQuery.mode`：

- `lexical`：词面检索；
- `semantic`：语义索引检索；
- `hybrid`：合并词面与语义得分。

`SearchResult` 同时返回 `requestedMode`、`executedMode` 和可选 `notice`。当语义端口未安装时，
`semantic/hybrid` 必须明确回退到 `lexical`；页面不能把回退结果标成语义结果。

### 索引物

静态语义索引由以下内容组成：

- `version`；
- `publicationId + contentChecksum`；
- `modelId` 与向量 `dimensions`；
- 多条 `{kind, id, vector}`，其中 kind 只能是 `work/passage/entity`。

索引不复制标题、原文、实体名或审核状态。适配器用 ID 回到当前 `KnowledgePublication` 解析结果；
缺失 ID、重复 ID、非有限向量、维度错误、零向量或版本不匹配一律拒绝。

### 查询向量端口

`EmbeddingPort` 只负责把用户查询转成固定维度向量。密钥、模型调用和缓存属于部署适配器，不进入页面、
领域层或发布包。静态语义适配器采用余弦相似度，随后仍执行统一的作品、实体类型、时代、地域和审核筛选。

### 混合排序

应用层在同一查询条件下取得词面结果与语义结果，用稳定对象键去重：

- 同时命中：`0.45 × lexical + 0.55 × semantic`；
- 单侧命中：保留该侧的加权得分；
- 分数相同：按 `kind + canonical id` 稳定排序。

混合结果仍返回规范对象，不把搜索片段或向量写回事实。游标只针对最终稳定排序分页。

## 数据接入

真实数据到来时：

1. 为影印页填入 Canvas URL，Image API 能力由适配器自动发现；
2. 从指定发布包生成仅含规范 ID 的向量索引；
3. 记录模型 ID、维度、发布 ID 和校验和；
4. 部署 `EmbeddingPort`，在组合根注入语义适配器；
5. 运行版本绑定、筛选一致性、相关性和性能验收。

更换 IIIF 服务或向量数据库只能替换 adapter/port，不能修改核心事实、页面路由或搜索结果对象。
