import type {
  KnowledgePublication,
  PublicationId,
} from "@infinite-spacetime/contracts";
import type { PublicationReadPort } from "@infinite-spacetime/ports";
export const publication = {
  manifest: {
    contractVersion: "0.6.0",
    publicationId: "application-test" as PublicationId,
    datasetVersion: "1.0.0",
    title: "虚构测试发布包",
    generatedAt: "1970-01-01T00:00:00Z",
    contentChecksum: `sha256:${"0".repeat(64)}`,
    sourceDescription: "fictional test data",
  },
  sources: [
    {
      id: "source-1",
      kind: "facsimile",
      title: "虚构影印本",
      rightsStatement: "test only",
    },
  ],
  works: [
    {
      id: "work-1",
      title: "云川县志",
      alternativeTitles: ["云川志"],
      category: "gazetteer",
      abstract: "虚构测试方志",
      coverage: {
        regionLabels: ["云川"],
        temporal: { startYear: 100, endYear: 200 },
      },
      sourceRefs: [{ sourceId: "source-1" }],
    },
  ],
  editions: [
    {
      id: "edition-1",
      workId: "work-1",
      label: "虚构刻本",
      sourceRefs: [{ sourceId: "source-1" }],
    },
  ],
  volumes: [
    { id: "volume-1", editionId: "edition-1", label: "卷一", sequence: 1 },
  ],
  facsimilePages: [
    {
      id: "page-1",
      volumeId: "volume-1",
      sequence: 1,
      imageUrl: "https://example.invalid/page.jpg",
    },
  ],
  passages: [
    {
      id: "passage-1",
      volumeId: "volume-1",
      sequence: 1,
      text: {
        original: "沈舟至云川。",
        simplified: "沈舟至云川。",
        modernTranslation: "沈舟抵达云川。",
      },
      facsimileAnchors: [{ pageId: "page-1" }],
      revision: 1,
    },
    {
      id: "passage-2",
      volumeId: "volume-1",
      sequence: 2,
      text: { original: "云川又名青崖。" },
      facsimileAnchors: [],
      revision: 1,
    },
  ],
  passageAlignments: [],
  entities: [
    {
      id: "person-1",
      type: "person",
      preferredName: "沈舟",
      aliases: ["子虚"],
      reviewStatus: "verified",
    },
    {
      id: "place-entity-1",
      type: "place",
      preferredName: "云川",
      aliases: ["青崖"],
      reviewStatus: "reviewed",
    },
    {
      id: "person-2",
      type: "person",
      preferredName: "陆遥",
      aliases: [],
      reviewStatus: "raw",
    },
  ],
  mentions: [
    {
      id: "mention-1",
      passageId: "passage-1",
      entityId: "person-1",
      start: 0,
      end: 2,
      surface: "沈舟",
      reviewStatus: "verified",
    },
    {
      id: "mention-2",
      passageId: "passage-1",
      entityId: "place-entity-1",
      start: 3,
      end: 5,
      surface: "云川",
      reviewStatus: "reviewed",
    },
  ],
  assertions: [
    {
      id: "assertion-1",
      subjectId: "person-1",
      predicate: "social.friend_of",
      objectId: "person-2",
      temporal: { startYear: 120 },
      evidence: [{ passageId: "passage-1", start: 0, end: 5 }],
      reviewStatus: "reviewed",
    },
    {
      id: "assertion-2",
      subjectId: "person-1",
      predicate: "office.held_title",
      literalValue: "县令",
      temporal: { startYear: 130 },
      evidence: [{ passageId: "passage-1", start: 0, end: 2 }],
      reviewStatus: "disputed",
    },
    {
      id: "assertion-3",
      subjectId: "person-1",
      predicate: "office.held_title",
      literalValue: "主簿",
      temporal: { startYear: 130 },
      evidence: [{ passageId: "passage-2", start: 0, end: 2 }],
      reviewStatus: "reviewed",
    },
  ],
  places: [
    {
      id: "place-1",
      entityId: "place-entity-1",
      historicalNames: [
        {
          name: "青崖",
          validDuring: { startYear: 100, endYear: 140 },
          evidence: [],
          sourceRefs: [],
        },
      ],
      parentPlaceIds: [],
    },
    {
      id: "place-2",
      entityId: "place-entity-1",
      historicalNames: [{ name: "未定位地", evidence: [], sourceRefs: [] }],
      parentPlaceIds: [],
    },
  ],
  geometries: [
    {
      id: "geometry-1",
      placeId: "place-1",
      geometry: { type: "Point", coordinates: [110, 30] },
      validDuring: { startYear: 100, endYear: 200 },
      sourceRefs: [{ sourceId: "source-1" }],
      reviewStatus: "reviewed",
    },
  ],
  occurrences: [
    {
      id: "occurrence-1",
      entityId: "person-1",
      placeId: "place-1",
      kind: "travel",
      label: "抵达云川",
      temporal: { startYear: 150 },
      sequence: 1,
      evidence: [{ passageId: "passage-1", start: 0, end: 5 }],
      reviewStatus: "reviewed",
    },
    {
      id: "occurrence-2",
      entityId: "person-1",
      placeId: "place-1",
      kind: "travel",
      temporal: { startYear: 140 },
      sequence: 2,
      evidence: [{ passageId: "passage-2", start: 0, end: 2 }],
      reviewStatus: "machine_suggested",
    },
    {
      id: "occurrence-3",
      entityId: "person-2",
      placeId: "place-2",
      kind: "residence",
      evidence: [{ passageId: "passage-2", start: 0, end: 2 }],
      reviewStatus: "raw",
    },
  ],
} as unknown as KnowledgePublication;

export const port: PublicationReadPort = {
  dataContext: publication.manifest,
  readPublication: () => publication,
};
