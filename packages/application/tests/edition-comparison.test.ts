import type {
  EditionId,
  KnowledgePublication,
  PassageId,
  WorkId,
} from "@infinite-spacetime/contracts";
import { describe, expect, it } from "vitest";
import { compareText, createApplicationServices } from "../src";
import { publication } from "./fictional-publication";

function comparisonServices() {
  const base = structuredClone(publication);
  const typed = {
    ...base,
    editions: [
      ...base.editions,
      {
        id: "edition-2",
        workId: "work-1",
        label: "虚构抄本",
        sourceRefs: [{ sourceId: "source-1" }],
      },
    ],
    volumes: [
      ...base.volumes,
      {
        id: "volume-2",
        editionId: "edition-2",
        label: "卷一",
        sequence: 1,
      },
    ],
    passages: [
      ...base.passages.map((passage, index) => ({
        ...passage,
        sectionLabel: index === 0 ? "人物" : "地理",
      })),
      {
        id: "passage-3",
        volumeId: "volume-2",
        sectionLabel: "人物",
        sequence: 1,
        text: { original: "沈舟抵云川。" },
        facsimileAnchors: [],
        revision: 1,
      },
      {
        id: "passage-4",
        volumeId: "volume-2",
        sectionLabel: "山川",
        sequence: 2,
        text: { original: "云川古名青崖。" },
        facsimileAnchors: [],
        revision: 1,
      },
      {
        id: "passage-5",
        volumeId: "volume-2",
        sectionLabel: "艺文",
        sequence: 3,
        text: { original: "艺文一篇。" },
        facsimileAnchors: [],
        revision: 1,
      },
    ],
  } as unknown as KnowledgePublication;
  return createApplicationServices({
    dataContext: typed.manifest,
    readPublication: () => typed,
  });
}

describe("edition comparison", () => {
  it("compares Unicode text exactly and bounds pathological long diffs", () => {
    const comparison = compareText("甲𠀀乙", "甲𠀁乙");
    expect(comparison).toMatchObject({
      left: [
        { kind: "equal", text: "甲" },
        { kind: "removed", text: "𠀀" },
        { kind: "equal", text: "乙" },
      ],
      right: [
        { kind: "equal", text: "甲" },
        { kind: "inserted", text: "𠀁" },
        { kind: "equal", text: "乙" },
      ],
      similarity: 2 / 3,
      isCoarse: false,
    });
    expect(compareText("", "").similarity).toBe(1);
    expect(
      compareText("始" + "甲".repeat(501), "始" + "乙".repeat(501)),
    ).toMatchObject({
      isCoarse: true,
      similarity: 1 / 502,
    });
  });

  it("pairs by structural label, then sequence, without hiding single-sided text", async () => {
    const result = await comparisonServices().reader.compareEditions({
      workId: "work-1" as WorkId,
      leftEditionId: "edition-1" as EditionId,
      rightEditionId: "edition-2" as EditionId,
    });
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      alignment: "label",
      left: { id: "passage-1" },
      right: { id: "passage-3" },
      difference: { isCoarse: false },
    });
    expect(result.rows[1]).toMatchObject({
      alignment: "sequence",
      left: { id: "passage-2" },
      right: { id: "passage-4" },
    });
    expect(result.rows[2]).toMatchObject({
      alignment: "unpaired",
      right: { id: "passage-5" as PassageId },
    });
  });

  it("rejects missing, identical, and cross-work edition comparisons", async () => {
    const services = comparisonServices();
    await expect(
      services.reader.compareEditions({
        workId: "work-1" as WorkId,
        leftEditionId: "missing" as EditionId,
        rightEditionId: "edition-2" as EditionId,
      }),
    ).rejects.toThrow("Edition not found");
    await expect(
      services.reader.compareEditions({
        workId: "work-1" as WorkId,
        leftEditionId: "edition-1" as EditionId,
        rightEditionId: "edition-1" as EditionId,
      }),
    ).rejects.toThrow("two editions of the same work");
    await expect(
      services.reader.compareEditions({
        workId: "other-work" as WorkId,
        leftEditionId: "edition-1" as EditionId,
        rightEditionId: "edition-2" as EditionId,
      }),
    ).rejects.toThrow("two editions of the same work");
  });
});
