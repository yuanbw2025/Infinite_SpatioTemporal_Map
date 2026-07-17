import type * as Wire from "./generated/publication";
import type { EvidenceSpan, TemporalValue } from "./common";
import type { AssertionId, EntityId, MentionId, PassageId } from "./ids";

export type EntityType = Wire.EntityType;

export type Entity = Readonly<
  Omit<Wire.Entity, "id" | "aliases"> & {
    readonly id: EntityId;
    readonly aliases: readonly string[];
  }
>;

export type Mention = Readonly<
  Omit<Wire.Mention, "id" | "passageId" | "entityId"> & {
    readonly id: MentionId;
    readonly passageId: PassageId;
    readonly entityId: EntityId;
  }
>;

export type EntityAssertion = Readonly<
  Omit<
    Wire.EntityAssertion,
    "id" | "subjectId" | "objectId" | "temporal" | "evidence"
  > & {
    readonly id: AssertionId;
    readonly subjectId: EntityId;
    readonly objectId: EntityId;
    readonly literalValue?: never;
    readonly temporal?: TemporalValue;
    readonly evidence: readonly [EvidenceSpan, ...EvidenceSpan[]];
  }
>;

export type LiteralAssertion = Readonly<
  Omit<Wire.LiteralAssertion, "id" | "subjectId" | "temporal" | "evidence"> & {
    readonly id: AssertionId;
    readonly subjectId: EntityId;
    readonly objectId?: never;
    readonly temporal?: TemporalValue;
    readonly evidence: readonly [EvidenceSpan, ...EvidenceSpan[]];
  }
>;

export type Assertion = EntityAssertion | LiteralAssertion;
