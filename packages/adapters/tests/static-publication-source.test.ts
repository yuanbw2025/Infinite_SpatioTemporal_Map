import {
  CONTRACT_VERSION,
  type KnowledgePublication,
  type PublicationId,
} from "@infinite-spacetime/contracts";
import { ContractMismatchError } from "@infinite-spacetime/domain";
import { describe, expect, it } from "vitest";
import { createStaticPublicationSource } from "../src";

function publication(contractVersion = CONTRACT_VERSION): KnowledgePublication {
  return {
    manifest: {
      contractVersion,
      publicationId: "adapter-test" as PublicationId,
      datasetVersion: "1.0.0",
      title: "Adapter test",
      generatedAt: "1970-01-01T00:00:00Z",
      contentChecksum: `sha256:${"0".repeat(64)}`,
      sourceDescription: "test",
    },
    sources: [],
    works: [],
    editions: [],
    volumes: [],
    facsimilePages: [],
    passages: [],
    entities: [],
    mentions: [],
    assertions: [],
    places: [],
    geometries: [],
    occurrences: [],
  };
}

describe("static publication source", () => {
  it("exposes one immutable context and the original publication", () => {
    const value = publication();
    const source = createStaticPublicationSource(value);

    expect(source.readPublication()).toBe(value);
    expect(source.dataContext).toEqual({
      contractVersion: CONTRACT_VERSION,
      publicationId: "adapter-test",
      datasetVersion: "1.0.0",
      contentChecksum: `sha256:${"0".repeat(64)}`,
    });
    expect(Object.isFrozen(source.dataContext)).toBe(true);
  });

  it("rejects an incompatible contract before composition", () => {
    expect(() => createStaticPublicationSource(publication("99.0.0"))).toThrow(
      ContractMismatchError,
    );
  });
});
