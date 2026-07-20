# 人工版本段落对齐规范

## 1. 领域归属

`PassageAlignment` 属于 Text 模块，是编辑者对不同 `Edition` 正文结构关系的受控判断。它不是原文事实，也不是页面缓存；正式记录随 `KnowledgePublication` 发布，并与 Passage 使用同一数据版本。

自动按标签或次序配对只生成阅读投影，不能写入正式对齐集合。人工记录存在时，版本对读必须优先使用人工记录，剩余未校定段落才允许自动暂配。

## 2. 数据结构

```text
PassageAlignment
  id
  workId
  relation                 equivalent / partial_overlap / reordered / uncertain
  members[]
    editionId
    passageIds[]           同一版本可一段或多段
  reviewStatus             reviewed / verified / disputed
  reviewedBy
  reviewedAt
  note?
  revision
```

一个组至少连接两个不同版本。`members` 支持一对一、一对多和多对多，但每个成员的段落必须属于其声明版本，并最终属于同一 `workId`。

## 3. 关系语义

| relation          | 含义                                         |
| ----------------- | -------------------------------------------- |
| `equivalent`      | 内容整体对应，允许文字异文                   |
| `partial_overlap` | 内容只有部分重合，不能把未重合部分隐藏       |
| `reordered`       | 内容对应但在版本中的结构或顺序发生变化       |
| `uncertain`       | 编辑者确认值得并列，但对应程度仍待进一步判断 |

对齐关系不裁决哪个版本“正确”，也不能合并或覆盖 Passage。

## 4. 工作流

1. 管线从两个版本生成只读自动建议批次；
2. 工作台并列显示原文和建议理由；
3. 编辑者可以接受、修改段落集合、标记关系或驳回；
4. 决策文件绑定原发布包 `publicationId + contentChecksum`；
5. 管线应用完整决策、执行引用和版本校验，生成新的不可变发布包；
6. 版本对读优先读取已发布人工记录，并明确显示审核状态。

## 5. 永久约束

- 页面不能直接写 `publication.json`；
- 未审核建议不能进入正式 `passageAlignments`；
- 同一版本不能在一个对齐组中出现两次；
- 同一段落不能在同一版本组合中被两个有效对齐组重复占用；
- 决策基线校验和不匹配时必须重新生成建议；
- 删除或改变 Passage 后，引用失效必须阻止发布；
- 对齐说明是编辑说明，不得伪装成原文证据。
