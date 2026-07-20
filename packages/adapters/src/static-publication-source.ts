import {
  CONTRACT_VERSION,
  type DataContext,
  type KnowledgePublication,
} from "@infinite-spacetime/contracts";
import { ContractMismatchError } from "@infinite-spacetime/domain";
import type { PublicationReadPort } from "@infinite-spacetime/ports";

export function createStaticPublicationSource(
  publication: KnowledgePublication,
): PublicationReadPort {
  if (publication.manifest.contractVersion !== CONTRACT_VERSION) {
    throw new ContractMismatchError(
      `Expected contract ${CONTRACT_VERSION}, received ${publication.manifest.contractVersion}`,
    );
  }
  const dataContext = Object.freeze({
    contractVersion: publication.manifest.contractVersion,
    publicationId: publication.manifest.publicationId,
    datasetVersion: publication.manifest.datasetVersion,
    contentChecksum: publication.manifest.contentChecksum,
  }) satisfies DataContext;
  return { dataContext, readPublication: () => publication };
}
