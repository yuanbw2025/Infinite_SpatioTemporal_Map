# ADR 0013：规模化查询端口与 IIIF 影像解析边界

- 状态：accepted
- 日期：2026-07-20

## 背景

首部方志可以在浏览器内从单一发布包完成检索、地图投影和影印阅读；数据扩展到多地区、多朝代和大量高清影像后，全文检索、空间查询与 IIIF 网络访问需要独立基础设施。若页面直接接入搜索引擎、空间数据库或 IIIF JSON，功能语义会与具体技术绑定，并形成第二套数据读取路径。

## 决策

应用层为三类可替换能力定义小端口：

- `SearchIndexPort` 接受统一 `SearchQuery`，返回既有 `SearchResult`；
- `SpatialQueryPort` 接受统一 `AtlasQuery`，返回既有 `AtlasResult`；
- `FacsimileImagePort` 根据 `FacsimilePage.canvasUrl` 解析可展示影像。

静态发布包仍是默认事实读取实现。未注入检索或空间端口时，应用服务使用同一 `DataContext` 的内存投影；注入端口后只替换查询执行方式，不改变领域 ID、查询含义或页面结果契约。

IIIF 适配器属于基础设施层，负责解析 Presentation 2/3 Canvas、校验 HTTP(S) 资源、生成 Image API 请求地址并缓存同一 Canvas 请求。阅读器只认识 `FacsimilePage`、`FacsimileAnchor` 与解析后的 `FacsimileImageResource`，不解析远程协议。

所有规模化派生设施必须绑定 `publicationId` 与 `contentChecksum`；版本不符时拒绝使用，且不得将索引结果反写为规范事实。

## 后果

- 从浏览器内存检索迁移到全文索引或 PostGIS 时，页面和领域模型不变。
- 直接图像与 IIIF 影像共用同一阅读器，并支持多页锚点和版面区域联动。
- 网络失败只影响对应影像或可替换查询能力，不产生第二份事实。
- 后续适配器必须通过端口契约测试，并落实发布版本绑定。
