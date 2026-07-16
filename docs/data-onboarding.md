# 数据接入手册

项目已经具备全部公众功能，正式内容通过一个 `KnowledgePublication` 发布包接入。默认文件位于：

```text
apps/web/public/data/publication.json
```

机器可读结构定义位于 `packages/contracts/schemas/publication.schema.json`；跨记录引用和原文字符范围由数据管线执行更严格的语义校验。

## 发布包组成

```text
manifest     数据集身份、契约版本、生成时间和来源说明
works        方志与其他文献
editions     文献版本、馆藏与权利说明
volumes      卷章结构
passages     原文、简体、白话与影印锚点
entities     人物、地点、事件、官职、机构与文博对象
mentions     实体在原文中的字符位置
assertions   带证据的关系和属性主张
places       跨时期地点身份和历史名称
geometries   带时代、精度和审核状态的坐标/范围
occurrences  人物、事件、文物与地点/时代之间的带证据经历
```

## 推荐工作方式

大型数据不要手工维护一个巨型 JSON。可以在独立目录维护 `manifest.json`、`works.json`、`passages.json` 等分片，再通过管线组装：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline assemble DATA_DIR apps/web/public/data/publication.json
```

已有完整发布包时先校验：

```bash
pnpm data:validate
```

校验器会检查契约版本、重复 ID、文献引用、版本/卷章关系、实体引用、原文字符范围、地点父级、几何引用以及每条主张的证据。

## 接入后的功能映射

| 数据                       | 自动启用的功能                    |
| -------------------------- | --------------------------------- |
| works + editions + volumes | 书库、版本与卷章导航              |
| passages                   | 原文目录、分层阅读、全文检索      |
| entities + mentions        | 实体高亮、人物/文博列表、原文出现 |
| assertions + evidence      | 实体档案、关系、时代与出处回溯    |
| places + geometries        | 历史地点、名称、单区与不连续辖区  |
| occurrences                | 人物游历、事件现场与文物流转      |
| facsimile anchors          | 阅读器影印联动                    |

## 永久约束

- 简体和白话不能覆盖 `text.original`。
- `Mention.start/end` 必须以原文 Unicode 字符索引为准。
- 正式 `Assertion` 至少有一个 `EvidenceSpan`。
- 页面功能不得直接修改发布包；数据修订必须回到管线重新发布。
- `Polygon` 和 `MultiPolygon` 的每个环至少四点且首尾闭合，坐标使用 WGS 84 经度、纬度顺序。

## 地图底图

时空数据层由 MapLibre 在浏览器中渲染，点、面、多面、聚合和行迹均来自发布包。默认使用公开矢量底图；如需部署自有瓦片或适配特定网络环境，在 `apps/web/.env` 设置 `VITE_MAP_STYLE_URL` 即可，更换底图不会改变历史数据契约。外部底图不可用时页面会切换到本地空白样式，历史数据层仍能工作。
