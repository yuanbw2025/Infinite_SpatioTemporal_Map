import type { FacsimileImageResource } from "@infinite-spacetime/contracts";

/** Resolves an IIIF Presentation canvas without leaking protocol details inward. */
export interface FacsimileImagePort {
  resolveCanvas(canvasUrl: string): Promise<FacsimileImageResource | undefined>;
}
