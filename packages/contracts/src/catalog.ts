import type * as Wire from "./generated/publication";
import type {
  EditionId,
  FacsimilePageId,
  PassageAlignmentId,
  PassageId,
  PlaceIdentityId,
  SourceId,
  SourceRelationId,
  VolumeId,
  WorkId,
} from "./ids";
import type { TemporalValue } from "./common";

export type SourceRef = Readonly<
  Omit<Wire.SourceRef, "sourceId"> & { readonly sourceId: SourceId }
>;

export type SourceRecord = Readonly<
  Omit<Wire.SourceRecord, "id"> & { readonly id: SourceId }
>;

export type SourceRelation = Readonly<
  Omit<
    Wire.SourceRelation,
    "id" | "subjectSourceId" | "objectSourceId" | "sourceRefs" | "evidence"
  > & {
    readonly id: SourceRelationId;
    readonly subjectSourceId: SourceId;
    readonly objectSourceId: SourceId;
    readonly sourceRefs: readonly [SourceRef, ...SourceRef[]];
    readonly evidence: readonly import("./common").EvidenceSpan[];
  }
>;

export type WorkCoverage = Readonly<
  Omit<Wire.WorkCoverage, "temporal" | "placeIds" | "regionLabels"> & {
    readonly temporal?: TemporalValue;
    readonly placeIds: readonly PlaceIdentityId[];
    readonly regionLabels: readonly string[];
  }
>;

export type Work = Readonly<
  Omit<Wire.Work, "id" | "alternativeTitles" | "coverage" | "sourceRefs"> & {
    readonly id: WorkId;
    readonly alternativeTitles: readonly string[];
    readonly coverage?: WorkCoverage;
    readonly sourceRefs: readonly [SourceRef, ...SourceRef[]];
  }
>;

export type Edition = Readonly<
  Omit<Wire.Edition, "id" | "workId" | "sourceRefs"> & {
    readonly id: EditionId;
    readonly workId: WorkId;
    readonly sourceRefs: readonly [SourceRef, ...SourceRef[]];
  }
>;

export type Volume = Readonly<
  Omit<Wire.Volume, "id" | "editionId" | "parentVolumeId"> & {
    readonly id: VolumeId;
    readonly editionId: EditionId;
    readonly parentVolumeId?: VolumeId;
  }
>;

export type FacsimilePage = Readonly<
  Omit<Wire.FacsimilePage, "id" | "volumeId" | "sourceId"> & {
    readonly id: FacsimilePageId;
    readonly volumeId: VolumeId;
    readonly sourceId: SourceId;
  }
>;

export type TextLayers = Readonly<Wire.TextLayers>;

export type FacsimileAnchor = Readonly<
  Omit<Wire.FacsimileAnchor, "pageId" | "region"> & {
    readonly pageId: FacsimilePageId;
    readonly region?: readonly [number, number, number, number];
  }
>;

export type Passage = Readonly<
  Omit<Wire.Passage, "id" | "volumeId" | "text" | "facsimileAnchors"> & {
    readonly id: PassageId;
    readonly volumeId: VolumeId;
    readonly text: TextLayers;
    readonly facsimileAnchors: readonly FacsimileAnchor[];
  }
>;

export type PassageAlignmentMember = Readonly<
  Omit<Wire.PassageAlignmentMember, "editionId" | "passageIds"> & {
    readonly editionId: EditionId;
    readonly passageIds: readonly [PassageId, ...PassageId[]];
  }
>;

export type PassageAlignment = Readonly<
  Omit<Wire.PassageAlignment, "id" | "workId" | "members"> & {
    readonly id: PassageAlignmentId;
    readonly workId: WorkId;
    readonly members: readonly [
      PassageAlignmentMember,
      PassageAlignmentMember,
      ...PassageAlignmentMember[],
    ];
  }
>;
