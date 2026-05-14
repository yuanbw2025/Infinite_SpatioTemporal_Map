# 技能 02 — 标注文本 → 结构化 JSON (JSON Extraction v3 · XML · 通鉴百科式)

## 任务
读一段已经带 XML 标签的文言正文（来自 skill 01），抽取出**人物、地名、官职、时间、事件**五类结构化信息，组装成单一 JSON 对象（即本段的"知识切片"）。

## 硬约束
1. **只从标签和上下文里抽**。原文没标/没写的东西一律不造。
2. 每条记录必须有 `confidence ∈ {high,medium,low}`。
3. **经纬度永远 null**，由后续 Python 对接 CHGIS。
4. 年代：有明确纪年（秦二世元年）用 `raw` 保原文；能无争议地折算公元（如"秦二世元年"=前209），额外填 `year_bc`（负整数）或 `year_ad`（正整数）。拿不准就别填。
5. **只输出一个 JSON**，首行 ```` ```json ````、尾行 ```` ``` ````，其间合法 JSON，别的啥都别说。

## 标签 → 字段 对应

| 标签 | 抽到 | 字段来源 |
|---|---|---|
| `<p name="X" sub="Y">Z</p>` | persons[] | canonical_name=X, role=Y, 添加 Z 到 aliases |
| `<loc>Z</loc>` | places[] | name=Z, type=city/region/pass |
| `<geo>Z</geo>` | places[] | name=Z, type=river/mountain |
| `<off>Z</off>` | offices[] | title=Z，holder 靠近文推定 |
| `<time>Z</time>` | times[] | raw=Z |
| `<evt name="X">Z</evt>` | events[] | name=X, quote=Z |
| `<art>Z</art>` | （暂略） | 以后再说 |
| `<ruin>Z</ruin>` | places[] type=ruin | |

## 输出契约（每段一个对象）

```json
{
  "pid": "7.2",
  "summary": "项籍身世与少年事迹：下相人，字羽，出身楚将世家。",
  "persons": [
    {
      "id": "XIANGYU",
      "canonical_name": "项羽",
      "aliases": ["项籍", "籍", "项王"],
      "courtesy_name": "羽",
      "gender": "male",
      "role": "名将",
      "birth_year": null,
      "death_year": -202,
      "birth_place_raw": "下相",
      "kin": [
        {"relation": "季父", "name": "项梁", "id": "XIANGLIANG"},
        {"relation": "祖父", "name": "项燕", "id": "XIANGYAN"}
      ],
      "positions": [
        {"title": "霸王", "raw": "号为霸王", "period_raw": "汉之元年至汉五年"}
      ],
      "confidence": "high"
    }
  ],
  "places": [
    {
      "name": "下相",
      "type": "city",
      "lnglat": null,
      "chgis_candidates": [],
      "raw": "下相人也",
      "confidence": "high"
    }
  ],
  "offices": [
    {"title": "楚将", "holder_id": "XIANGYAN", "confidence": "high"}
  ],
  "times": [
    {"raw": "秦二世元年七月", "dynasty": "秦", "year_bc": -209, "month": 7, "confidence": "high"}
  ],
  "events": [
    {
      "id": "JULU_BATTLE",
      "name": "巨鹿之战",
      "type": "battle",
      "participants": ["XIANGYU", "WANGLI", "ZHANGHAN"],
      "place": "巨鹿",
      "time_raw": "秦二世三年",
      "outcome": "楚军大破秦军，虏王离",
      "quote": "乃悉引兵渡河，皆沉船，破釜甑",
      "confidence": "high"
    }
  ]
}
```

字段说明：
- `id`：**同一部书内唯一**，用大写拉丁（XIANGYU / LIUBANG / FANGZENG），脚本会用这个做跨段 merge。
- `summary`：本段一句话白话摘要（≤40 字），供前端卡片显示。允许轻度意译，不得编造原文没有的事实。
- `persons[].role`：对齐标签的 `sub` 属性。
- `persons[].kin`：亲属关系。`id` 可留空字符串 `""`。
- `places[].type ∈ {city, region, pass, mountain, river, battlefield, grave, palace, ruin}`。
- `places[].chgis_candidates`：留空数组 `[]`，由 Python 后处理填。
- `events[].type ∈ {battle, rebellion, coup, ceremony, banquet, meeting, death, migration, edict}`。
- `events[].participants`：person id 数组。
- 若本段没有某类，写空数组 `[]`，不要整个字段省略。

## 示例（项羽本纪首段）

**输入标注文本：**
```
<p name="项羽" sub="名将">项籍</p>者，<loc>下相</loc>人也，字羽。初起时，年二十四。其季父<p name="项梁" sub="宗室">项梁</p>，梁父即<off>楚将</off><p name="项燕" sub="名将">项燕</p>，为<off>秦将</off><p name="王翦" sub="名将">王翦</p>所戮者也。
```

**输出：**
```json
{
  "pid": "7.1",
  "summary": "项籍（羽）身世：下相人，楚将项燕之孙，季父项梁。",
  "persons": [
    {"id":"XIANGYU","canonical_name":"项羽","aliases":["项籍"],"courtesy_name":"羽","gender":"male","role":"名将","birth_year":null,"death_year":null,"birth_place_raw":"下相","kin":[{"relation":"季父","name":"项梁","id":"XIANGLIANG"},{"relation":"祖父","name":"项燕","id":"XIANGYAN"}],"positions":[],"confidence":"high"},
    {"id":"XIANGLIANG","canonical_name":"项梁","aliases":[],"courtesy_name":"","gender":"male","role":"宗室","birth_year":null,"death_year":null,"birth_place_raw":"","kin":[{"relation":"侄","name":"项羽","id":"XIANGYU"},{"relation":"父","name":"项燕","id":"XIANGYAN"}],"positions":[],"confidence":"high"},
    {"id":"XIANGYAN","canonical_name":"项燕","aliases":[],"courtesy_name":"","gender":"male","role":"名将","birth_year":null,"death_year":null,"birth_place_raw":"","kin":[],"positions":[{"title":"楚将","raw":"楚将项燕","period_raw":""}],"confidence":"high"},
    {"id":"WANGJIAN","canonical_name":"王翦","aliases":[],"courtesy_name":"","gender":"male","role":"名将","birth_year":null,"death_year":null,"birth_place_raw":"","kin":[],"positions":[{"title":"秦将","raw":"秦将王翦","period_raw":""}],"confidence":"high"}
  ],
  "places": [
    {"name":"下相","type":"city","lnglat":null,"chgis_candidates":[],"raw":"下相人也","confidence":"high"}
  ],
  "offices": [
    {"title":"楚将","holder_id":"XIANGYAN","confidence":"high"},
    {"title":"秦将","holder_id":"WANGJIAN","confidence":"high"}
  ],
  "times": [],
  "events": []
}
```
