import { describe, expect, it } from "vitest";
import type {
  EditionId,
  EntityId,
  Mention,
  MentionId,
  Passage,
  PassageId,
  VolumeId,
  WorkId,
} from "@infinite-spacetime/contracts";
import { validateMention } from "../src";

const passageId = "passage-1" as PassageId;
const passage: Passage = {
  id: passageId,
  source: {
    workId: "work-1" as WorkId,
    editionId: "edition-1" as EditionId,
    volumeId: "volume-1" as VolumeId,
    volumeLabel: "卷一",
    passageId,
  },
  sequence: 0,
  text: { original: "建康古名金陵。" },
  revision: 1,
};

describe("mention validation", () => {
  it("accepts a mention that exactly matches original text", () => {
    const mention: Mention = {
      id: "mention-1" as MentionId,
      passageId,
      entityId: "place-1" as EntityId,
      start: 0,
      end: 2,
      surface: "建康",
      reviewStatus: "reviewed",
    };

    expect(() => validateMention(passage, mention)).not.toThrow();
  });

  it("rejects a mention that rewrites the original", () => {
    const mention: Mention = {
      id: "mention-2" as MentionId,
      passageId,
      entityId: "place-1" as EntityId,
      start: 0,
      end: 2,
      surface: "南京",
      reviewStatus: "machine_suggested",
    };

    expect(() => validateMention(passage, mention)).toThrow(
      "immutable original text",
    );
  });
});
