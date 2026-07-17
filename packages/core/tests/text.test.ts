import { describe, expect, it } from "vitest";
import type {
  EntityId,
  Mention,
  MentionId,
  Passage,
  PassageId,
  VolumeId,
} from "@infinite-spacetime/contracts";
import { validateMention } from "../src";

const passageId = "passage-1" as PassageId;
const passage: Passage = {
  id: passageId,
  volumeId: "volume-1" as VolumeId,
  sequence: 0,
  text: { original: "建康古名金陵。" },
  facsimileAnchors: [],
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

  it("rejects mismatched passage identity and invalid ranges", () => {
    const base = {
      id: "mention-invalid" as MentionId,
      passageId,
      entityId: "place-1" as EntityId,
      start: 0,
      end: 2,
      surface: "建康",
      reviewStatus: "reviewed" as const,
    };
    expect(() =>
      validateMention(passage, {
        ...base,
        passageId: "another-passage" as PassageId,
      }),
    ).toThrow("identifiers do not match");
    expect(() =>
      validateMention(passage, { ...base, start: 2, end: 2 }),
    ).toThrow("range is invalid");
  });
});
