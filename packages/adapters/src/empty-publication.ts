import {
  CONTRACT_VERSION,
  type KnowledgePublication,
  type PublicationId,
} from "@infinite-spacetime/contracts";

export function createEmptyPublication(): KnowledgePublication {
  return {
    manifest: {
      contractVersion: CONTRACT_VERSION,
      publicationId: "empty" as PublicationId,
      datasetVersion: "0.0.0",
      title: "尚未接入数据",
      generatedAt: "1970-01-01T00:00:00.000Z",
      contentChecksum:
        "sha256:12398d1fa50dbb51ba88525da3d8fc1dbbaf5cb2957a3347d55652266b2887b7",
      sourceDescription: "Architecture-only placeholder",
    },
    sources: [],
    sourceRelations: [],
    works: [],
    editions: [],
    volumes: [],
    facsimilePages: [],
    passages: [],
    passageAlignments: [],
    entities: [],
    mentions: [],
    assertions: [],
    places: [],
    geometries: [],
    occurrences: [],
  };
}
