# ADR 0019：IIIF Image API 瓦片视图与版本绑定语义索引

- 状态：已接受
- 日期：2026-07-20

## 背景

现有阅读器能解析 IIIF Presentation 2/3 Canvas，但只显示整张图像；大幅影印本会造成高内存和低清缩放。
现有 `SearchIndexPort` 可替换，却没有声明词面、语义或混合执行模式，也没有语义索引物的版本约束。

## 决策

1. `FacsimileImageResource` 可携带 Image API service ID 和 `infoUrl`；协议解析仍属于 adapter。
2. Web 使用独立瓦片查看器消费 `infoUrl`，直接图像仍作为无 Image API 时的回退。
3. 段落区域继续读取唯一 `FacsimileAnchor.region`，查看状态不写回事实。
4. `SearchQuery` 增加 `lexical/semantic/hybrid` 模式，`SearchResult`公开实际执行模式与回退说明。
5. `SearchIndexPort` 必须声明支持模式；应用层只向支持目标模式的端口委派。
6. 静态语义索引只保存规范对象 ID 与向量，严格绑定 `publicationId + contentChecksum`。
7. 查询向量由独立 `EmbeddingPort` 产生；语义适配器校验维度并解析回当前发布包对象。
8. 混合检索由 application 合并词面与语义得分，不建立第二套搜索页面或结果模型。

## 后果

- 高清影印可使用 Image API 分块加载和深度缩放。
- 向量索引或远程搜索引擎可替换，事实和 UI 契约保持不变。
- 未配置语义基础设施时仍可使用词面检索，并明确告知回退。
- 契约查询类型扩展但规范发布包字段不变，因此不升级 publication contract。

## 被拒绝的方案

- 把 IIIF JSON、瓦片 URL 或查看器状态写入发布包。
- 在语义索引中复制全文和实体元数据，形成第二数据权威。
- 页面直接调用嵌入模型或向量数据库。
- 未安装语义索引时静默把普通检索标为“AI/语义检索”。
