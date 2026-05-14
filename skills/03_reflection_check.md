# 技能 03 — 标注反思校验 (Reflection Check v3 · XML)

## 任务
给你两样东西：
1. **原文**（未标注）
2. **上一轮产出的标注版**（XML 标签体系，见 skill 01）

你要在不自己重新标注的前提下，**找出上轮遗漏/错标/误标的点**，输出一份 issues JSON。

## 你**要做**的检查项

1. **Zero-Tampering**：对上轮标注做 `re.sub(r'</?[a-zA-Z][^>]*>', '', x)`，是否与原文字节级相等？
   （若 tamper_check=fail，status 必须是 need_fix，其他检查可略。）

2. **完整性**：原文中下列实体是否都标了？
   - 人名（含别称"项王""沛公""籍"）
   - 行政地名 `<loc>` / 山川水 `<geo>`
   - 官职 `<off>`
   - 时间 `<time>`
   - 有名战役/政变 `<evt>`

3. **规范性**：
   - `<p>` 的 `sub` 属性是否在 {帝王,名将,谋士,宗室,文臣,女性,寒士,人物} 中？
   - `<p>` 的 `name` 是规范名而非原字别称？（如"项王"→`name="项羽"`）
   - 地名是 `<loc>` 还是 `<geo>` 搞对了吗？（城邑/关隘→loc；水/山→geo）

4. **无幻觉**：上轮有没有擅自给出原文没有的公元纪年、人物全名、战役伤亡？

5. **不嵌套/不重叠**：有没有 `<p>...<loc>...</loc>...</p>` 这种标签体内嵌？

## 你**不要做**的事
- 不要自己重新标全文（那是 skill 01 的事）。
- 不要翻译/白话。
- 不要改底本字形。

## 输出格式（**严格**）

首行 ```` ```json ````，尾行 ```` ``` ````，中间合法 JSON：

```json
{
  "status": "ok",
  "tamper_check": "pass",
  "issues": [
    {
      "type": "missing",
      "where": "原文或标注片段（短）",
      "explain": "为什么错",
      "suggested_patch": "建议替换成什么（可空串）"
    }
  ],
  "summary": "一两句话总结"
}
```

取值集：
- `status ∈ {"ok", "need_fix"}`
- `tamper_check ∈ {"pass", "fail"}`
- `issues[].type ∈ {"missing","wrong_type","wrong_canonical","hallucination","nest","tamper"}`

- `status=ok` 表示可以进入 skill 02（JSON 结构化）。
- `status=need_fix` 表示需要把这份 issues 回填给 skill 01 再跑一轮。
- `issues=[]` 且 `status=ok` 表示完美。
- **只输出这一个 JSON 代码块**，前后不要其他文字。
