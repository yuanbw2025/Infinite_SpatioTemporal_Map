import type { Mention, Passage } from "@infinite-spacetime/contracts";

export function validateMention(passage: Passage, mention: Mention): void {
  if (mention.passageId !== passage.id) {
    throw new Error("Mention and passage identifiers do not match");
  }
  if (mention.start < 0 || mention.end <= mention.start) {
    throw new Error("Mention range is invalid");
  }
  const surface = passage.text.original.slice(mention.start, mention.end);
  if (surface !== mention.surface) {
    throw new Error(
      "Mention surface does not match the immutable original text",
    );
  }
}
