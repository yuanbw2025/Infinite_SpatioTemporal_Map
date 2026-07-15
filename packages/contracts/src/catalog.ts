import type {
  EditionId,
  FacsimilePageId,
  PassageId,
  PlaceIdentityId,
  VolumeId,
  WorkId,
} from "./ids";
import type { TemporalValue } from "./common";

export interface Work {
  readonly id: WorkId;
  readonly title: string;
  readonly alternativeTitles: readonly string[];
  readonly category:
    "gazetteer" | "history" | "genealogy" | "catalogue" | "other";
  readonly describedRegion?: string;
  readonly abstract?: string;
  readonly coverage?: {
    readonly temporal?: TemporalValue;
    readonly regionLabels: readonly string[];
    readonly placeIds: readonly PlaceIdentityId[];
  };
}

export interface Edition {
  readonly id: EditionId;
  readonly workId: WorkId;
  readonly label: string;
  readonly publicationStatement?: string;
  readonly holdingInstitution?: string;
  readonly sourceUrl?: string;
  readonly rightsStatement?: string;
}

export interface Volume {
  readonly id: VolumeId;
  readonly editionId: EditionId;
  readonly label: string;
  readonly sequence: number;
  readonly parentVolumeId?: VolumeId;
}

export interface SourceLocator {
  readonly workId: WorkId;
  readonly editionId: EditionId;
  readonly volumeId: VolumeId;
  readonly volumeLabel: string;
  readonly sectionLabel?: string;
  readonly pageId?: FacsimilePageId;
  readonly passageId: PassageId;
}

export interface TextLayers {
  /** Immutable transcription. Character conversion must never overwrite it. */
  readonly original: string;
  readonly simplified?: string;
  readonly modernTranslation?: string;
}

export interface FacsimileAnchor {
  readonly pageId: FacsimilePageId;
  readonly canvasUrl?: string;
  readonly imageUrl?: string;
  readonly region?: readonly [number, number, number, number];
}

export interface Passage {
  readonly id: PassageId;
  readonly source: SourceLocator;
  readonly sequence: number;
  readonly text: TextLayers;
  readonly facsimile?: FacsimileAnchor;
  readonly revision: number;
}
