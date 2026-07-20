# Data pipeline

数据管线只负责把来源材料生产成 `packages/contracts` 定义的发布包，绝不为某个页面生成私有结构。

固定阶段为：导入 → 规范化 → 分段 → 文本分层 → 实体/关系候选 → 对齐消歧 → 人工审核 → 契约校验 → 发布。每一步实现 `PipelineStage`，可以替换工具，但不能绕过统一发布边界。

将来接入一批数据时，只需新增来源适配器和必要的阶段实现；公众应用与领域内核不随数据来源改变。

## 发布命令

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline validate ../apps/web/public/data/publication.json
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline assemble path/to/shards ../apps/web/public/data/publication.json
```

`assemble` 会读取 `manifest.json` 和各类可选集合文件，组装前执行引用、时空范围与证据校验。任一错误都会阻止发布。

## 来源提取

先为整批原件建立来源清单。`source-metadata.example.json` 展示了逻辑来源键、权利状态、来源链接和馆藏机构的填写方式：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline sources \
  path/to/source-root workspace/source-manifest.json \
  --publication-id gazetteer-demo-v1 \
  --metadata pipeline/examples/source-metadata.example.json

PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline verify-sources \
  workspace/source-manifest.json path/to/source-root \
  --require-publishable-rights
```

来源清单记录 SHA-256、文件长度、媒体类型与权利信息。原件变化、路径越界、重复来源键、权利不明或受限都会在正式发布门禁中被发现。

来源进入分段和知识提取前，先生成包含原文件 SHA-256、媒体类型、提取器、正文和警告的可审计中间记录：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline extract path/to/source.epub workspace/source.json
```

当前入口支持 TXT、Markdown、HTML/XHTML、DOCX、EPUB、文本型 PDF 和常见图片。扫描 PDF 与图片只登记原件并标记 `requires_ocr=true`，不会用空文本或模拟内容冒充识别结果。后续 OCR 适配器必须消费该记录并生成独立派生文本。

OCR 引擎或人工完成转录后，通过独立命令接回；输出同时保存原件和转录文件的校验值、处理方式、执行者和时间：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline transcribe \
  workspace/source.json workspace/transcript.txt workspace/source.transcribed.json \
  --method hybrid --agent "review-team"
```

## 稳定分段与文本分层

提取记录通过逻辑来源键进行无损分段。分段不会清理、转换或覆盖来源文本；所有段落拼接后必须与提取正文逐字符一致。段落 ID 由发布 ID、逻辑来源键、段落原文和重复序号生成，因此在同一来源前后插入其他段落时，未变化段落仍保持原 ID：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline segment \
  workspace/source.json workspace/segments.json \
  --publication-id gazetteer-demo-v1 \
  --source-key work-1/edition-1/volume-1
```

简体、句读和白话由外部转换器或人工流程生成后，以“段落 ID → 派生文本”的 JSON 对象接回。管线拒绝缺失或未知段落 ID，也永远不改写 `text.original`：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline layer \
  workspace/segments.json workspace/simplified.json workspace/segments.simplified.json \
  --layer simplified

PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline layer \
  workspace/segments.simplified.json workspace/punctuated.json workspace/segments.punctuated.json \
  --layer punctuated

PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline layer \
  workspace/segments.punctuated.json workspace/modern.json workspace/segments.complete.json \
  --layer modernTranslation
```

## 候选审核与正式发布门禁

实体、提及、主张、地点、几何和时空经历提取器只输出提案。`candidates` 为提案生成稳定 ID，并统一标记为 `machine_suggested`：

管线自带一个保守的原文提及提取器：它只按已审核实体词表做逐字符精确匹配，始终从 `text.original` 计算偏移，不擅自简繁转换；同一词面指向多个实体时会降低置信度并强制进入人工消歧。其他 NLP 或大模型提取器也必须输出同一提案格式：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline extract-mentions \
  workspace/segments.complete.json pipeline/examples/entity-lexicon.example.json \
  workspace/mention-proposals.json
```

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline candidates \
  workspace/mention-proposals.json workspace/candidates.json \
  --publication apps/web/public/data/publication.json \
  --generator-id extractor-name-and-version
```

人工审核以追加式决策记录接入。复核可以核定、标争议、驳回或修正 payload；原机器提案和每次审核历史继续保留：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline review \
  workspace/candidates.json pipeline/examples/review-decisions.example.json \
  workspace/candidates.reviewed.json

PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline promote \
  workspace/candidates.reviewed.json apps/web/public/data/publication.json \
  apps/web/public/data/publication.next.json
```

候选批次绑定生成时发布包的 `publicationId + contentChecksum`，不能拿旧批次审核或覆盖新版本。`promote` 只物化 `reviewed/verified/disputed` 候选，跳过已驳回项，并在仍有机器候选时拒绝执行；随后在临时文件中合并完整发布包、检查全局 ID 碰撞与全部引用、重算校验和，全部成功后才原子替换目标文件。

## 旧契约迁移

历史数据不能由读取端长期兼容，也不能手工删字段。统一命令依次执行所有显式迁移并输出报告：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline migrate-to-current \
  workspace/publication-old.json workspace/publication-current.json \
  --predicate-map workspace/predicate-map.json \
  --report workspace/migration-report.json
```

0.3 → 0.4 把版本/来源、影印页、地点名称和作品覆盖范围移入唯一所有者；0.4 → 0.5 把任意关系字符串迁移到版本化核心谓词。当旧历史名称或几何存在多个可能来源时，必须用 `--default-source-id` 明确策展归属；未知谓词必须在 JSON 对象形式的 `--predicate-map` 中逐项裁决。迁移器不会猜测，缺少权利说明、影印 URL、谓词映射或冗余字段冲突时会停止。

## 实体与历史地点对齐

新实体和地点不能仅凭同名自动合并。`align` 使用原名/异名、实体类型和上级地点生成保守建议：唯一高置信匹配才建议合并，多候选始终标为人工判断，无匹配建议新建。

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline align \
  workspace/candidates.json apps/web/public/data/publication.json workspace/alignments.json
```

在 `pnpm dev:curation` 的“实体与地点对齐”工作区逐项裁决后执行：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline resolve-alignments \
  workspace/candidates.json apps/web/public/data/publication.json \
  workspace/alignments.json workspace/alignment-decisions.json workspace/aligned
```

决策必须覆盖整批，合并目标必须来自建议列表。合并会保留异名/带来源的历史名称、重写后续候选引用、标记重复候选不再物化，重算发布包校验和并把剩余候选显式重绑定到新版本；“同名不同人/地”可明确选择保持分立。

开发期 `validate` 允许机器建议存在，便于预览；正式发布必须通过更严格的 `gate`。门禁会同时检查发布契约、版本权利说明、来源清单、原件校验值、候选积压和所有知识记录的人工审核状态，并可输出机器可读报告：

```bash
PYTHONPATH=pipeline/src python3 -m infinite_spacetime_pipeline gate \
  apps/web/public/data/publication.json \
  --source-manifest workspace/source-manifest.json \
  --source-dir path/to/source-root \
  --candidate-batch workspace/candidates.reviewed.json \
  --output workspace/release-gate.json
```
