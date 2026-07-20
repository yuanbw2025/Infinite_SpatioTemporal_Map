# 核心关系谓词规范

## 1. 目标

`Assertion.predicate` 表达跨功能共享的知识语义。它不是页面标签，也不是导入器可以任意填写的备注。人物、图谱、时间线、地方社会、文博和研究工具必须使用同一谓词身份与同一解释。

0.5 起，正式发布包只接受本文件登记的核心谓词。新增谓词必须同时完成契约版本、定义元数据、语义校验、迁移和文档变更；不得只在某个组件中增加字符串判断。

## 2. 命名与行为

- ID 使用 `领域.关系` 小写命名，例如 `family.parent_of`。
- ID 表达稳定机器语义；中文标签只用于显示。
- `valueKind=entity` 必须使用 `objectId`。
- `valueKind=literal` 必须使用 `literalValue`。
- 对称关系不生成方向相反但含义重复的第二条事实。
- 有反向谓词时，反向关系只用于查询投影；不得为方便显示复制一条无独立证据的 Assertion。
- 地点经历优先使用 `SpatiotemporalOccurrence`；只有来源明确表达稳定关系时才使用地点关系谓词。
- 生卒、任官、制作、发现和收藏等带地点的过程优先使用 Occurrence；Assertion 表达其对象关系或文字属性。

## 3. 核心谓词

| ID                          | 中文标签 | 值类型  | 方向 | 主要用途                          |
| --------------------------- | -------- | ------- | ---- | --------------------------------- |
| `family.parent_of`          | 子女     | entity  | 有向 | 父母主体指向子女                  |
| `family.child_of`           | 父母     | entity  | 有向 | 子女主体指向父母                  |
| `family.spouse_of`          | 配偶     | entity  | 对称 | 婚姻关系                          |
| `family.sibling_of`         | 兄弟姊妹 | entity  | 对称 | 同辈关系                          |
| `family.clan_member_of`     | 所属宗族 | entity  | 有向 | 人物到家族/机构实体               |
| `education.teacher_of`      | 弟子     | entity  | 有向 | 教师主体指向学生                  |
| `education.student_of`      | 老师     | entity  | 有向 | 学生主体指向教师                  |
| `education.affiliated_with` | 就学于   | entity  | 有向 | 人物与书院、机构                  |
| `office.held_position`      | 担任官职 | entity  | 有向 | 人物到 office 实体                |
| `office.held_title`         | 官职原称 | literal | 有向 | 尚未实体对齐的原文官职            |
| `office.served_at`          | 任职机构 | entity  | 有向 | 人物到机构                        |
| `office.rank`               | 品秩     | literal | 有向 | 来源记载的品级                    |
| `social.friend_of`          | 友人     | entity  | 对称 | 交游关系                          |
| `social.associated_with`    | 交往     | entity  | 对称 | 无法细分的有证据交往              |
| `place.native_place`        | 籍贯     | entity  | 有向 | 人物到 place Entity               |
| `place.resided_at`          | 居住于   | entity  | 有向 | 稳定居住关系；行迹仍用 Occurrence |
| `event.participated_in`     | 参与事件 | entity  | 有向 | 人物/机构到事件                   |
| `heritage.creator`          | 制作者   | entity  | 有向 | 文博对象到人物/机构               |
| `heritage.material`         | 材质     | entity  | 有向 | 文博对象到 material               |
| `heritage.technique`        | 工艺     | entity  | 有向 | 文博对象到 technique              |
| `heritage.motif`            | 纹样     | entity  | 有向 | 文博对象到 motif                  |
| `heritage.inscription`      | 铭文     | entity  | 有向 | 文博对象到 inscription            |
| `heritage.collection`       | 馆藏机构 | entity  | 有向 | 文博对象到 institution            |
| `heritage.public_name`      | 公众名称 | literal | 有向 | 与规范专家名并存的展示名称        |
| `heritage.catalogue_number` | 藏品编号 | literal | 有向 | 来源中的馆藏编号                  |
| `society.population`        | 人口     | literal | 有向 | 地点/机构的人口史料原值           |
| `society.households`        | 户口     | literal | 有向 | 地点/机构的户口史料原值           |
| `society.taxation`          | 赋役税粮 | literal | 有向 | 不擅自统一单位的赋役原值          |
| `society.local_product`     | 地方物产 | entity  | 有向 | 地点/机构到材料或器物             |
| `society.tribute_product`   | 贡物     | entity  | 有向 | 地点/机构到材料或器物             |
| `society.custom`            | 风俗     | literal | 有向 | 有证据的地方风俗概述              |
| `event.kind`                | 事件类型 | literal | 有向 | 灾异、庆典等来源分类              |
| `classification.member_of`  | 属于     | entity  | 有向 | 无独立专门字段的稳定分类          |
| `descriptive.note`          | 来源描述 | literal | 有向 | 有证据但暂不能结构化的文字属性    |
| `other.related_to`          | 相关     | entity  | 对称 | 最低限度关系；不得替代可明确谓词  |

## 4. 迁移规则

0.4 → 0.5 迁移只自动处理语义明确的旧值：

| 旧值        | 0.5 值              |
| ----------- | ------------------- |
| `friend_of` | `social.friend_of`  |
| `office`    | `office.held_title` |
| `residedAt` | `place.resided_at`  |
| `relatedTo` | `other.related_to`  |

其他旧值必须由数据维护者提供显式映射。迁移器不得根据字符串相似度猜测学术语义。

0.6 → 0.7 只扩展 `society.*` 与 `event.kind`，不改写任何已有主张；迁移报告明确列出新增谓词。当前机器词表版本为 1.1.0。

## 5. 验收条件

- Schema 拒绝未登记谓词；
- TypeScript/Python 同时执行相同规则；
- application 使用词表标签，不直接显示机器 ID；
- 值类型和实体类型不合法时发布失败；
- 图谱反向查询不复制规范事实；
- 旧数据迁移产生可审计报告。
