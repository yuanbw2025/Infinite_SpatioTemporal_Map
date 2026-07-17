import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import publicationSchema from "../schemas/publication.schema.json";
import type { KnowledgePublication as WirePublication } from "./generated/publication";
import type { KnowledgePublication } from "./publication";

export interface ContractIssue {
  readonly path: string;
  readonly keyword: string;
  readonly message: string;
}

export class ContractValidationError extends Error {
  readonly issues: readonly ContractIssue[];

  constructor(issues: readonly ContractIssue[]) {
    super(
      issues.length === 0
        ? "Publication does not satisfy the canonical contract"
        : `Publication contract violation at ${issues[0]?.path}: ${issues[0]?.message}`,
    );
    this.name = "ContractValidationError";
    this.issues = issues;
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
addFormats(ajv);
const validateWirePublication = ajv.compile<WirePublication>(publicationSchema);

function toIssue(error: ErrorObject): ContractIssue {
  return {
    path: error.instancePath === "" ? "$" : `$${error.instancePath}`,
    keyword: error.keyword,
    message: error.message ?? "invalid value",
  };
}

/** Validate an untrusted JSON value against the sole canonical wire contract. */
export function inspectPublicationContract(
  value: unknown,
): readonly ContractIssue[] {
  if (validateWirePublication(value)) return [];
  return (validateWirePublication.errors ?? []).map(toIssue);
}

/**
 * Parse untrusted JSON into the branded domain contract.
 *
 * IDs become branded only after the complete JSON Schema has accepted them.
 * Cross-record semantic validation remains the publication pipeline's job.
 */
export function parseKnowledgePublication(
  value: unknown,
): KnowledgePublication {
  const issues = inspectPublicationContract(value);
  if (issues.length > 0) throw new ContractValidationError(issues);
  return value as KnowledgePublication;
}
