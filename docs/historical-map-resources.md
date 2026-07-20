# 历史底图与疆域投影资源规范

## 1. 边界

历史地点、有效时期和疆域几何的唯一事实源仍是 `KnowledgePublication` 中的 `places/geometries`。地图资源目录只登记如何呈现这些事实或如何叠加一幅有出处的历史地图，不得成为第二套地点、人物或疆域数据库。

资源目录属于可重建投影，必须绑定 `publicationId + contentChecksum`。发布包变化后，旧瓦片、旧 GeoJSON 和旧目录全部视为失效；公众应用拒绝混用。

## 2. 首批资源类型

| kind               | 用途                             | 数据边界                                                 |
| ------------------ | -------------------------------- | -------------------------------------------------------- |
| `raster_map`       | 扫描历史地图、地理配准图或瓦片   | 仅提供瓦片 URL；`sourceId` 指向发布包来源台账            |
| `boundary_geojson` | 由规范历史几何生成的疆域展示投影 | GeoJSON 是当前发布包几何的可重建投影，不拥有新的地点身份 |

资源公共字段：

```text
id
title
kind
validDuring?
defaultOpacity
isDefault
attribution?
sourceId?
```

`raster_map` 另含 `tiles[]/tileSize?/minZoom?/maxZoom?`；`boundary_geojson` 另含 `dataUrl/geometryIds[]/fillColor?/lineColor?`。`geometryIds` 必须引用当前发布包的规范历史几何，网络地址和颜色只是技术呈现配置。

## 3. 时间与交互

- 资源的 `validDuring` 使用与正式数据相同的 `TemporalValue`；
- 时间轴变化时由应用用例筛选适用资源，不由 Vue 页面自行解释年代；
- 用户可以逐层开关并调整透明度；
- 地点点位、历史区域、路线和标签继续读取同一 `MapObservation`；
- 资源图层始终位于知识图层下方，不能遮蔽选择、高亮和证据导航；
- 外部资源失败时只降级该图层，不影响规范历史数据。

## 4. 接入流程

1. 先把来源登记为 `SourceRecord`，确认权利和出处；
2. 历史地图完成地理配准或把规范 `HistoricalGeometry` 生成投影；
3. 生成带发布包 ID、内容校验和、工具版本和时间的资源目录；
4. 用静态资源适配器校验目录、来源引用、ID、URL 和透明度；
5. 将目录部署为 `apps/web/public/data/map-resources.json`，大文件可由对象存储或瓦片服务承载；
6. 发布包内容变化后重新生成目录，不允许沿用旧校验和。

资源规模扩大后可以新增矢量瓦片适配器，但必须实现同一端口；不得在地图页面引入另一个人物/地点模型。
