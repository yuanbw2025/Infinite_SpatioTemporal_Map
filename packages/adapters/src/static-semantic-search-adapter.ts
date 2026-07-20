import type {
  DataContext,
  SemanticIndexArtifact,
  SemanticIndexRecord,
  SemanticSearchCandidate,
} from "@infinite-spacetime/contracts";
import type {
  EmbeddingPort,
  SemanticSearchPort,
} from "@infinite-spacetime/ports";

export class SemanticIndexValidationError extends Error {
  override readonly name = "SemanticIndexValidationError";
}

function validVector(
  value: unknown,
  dimensions: number,
): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length === dimensions &&
    value.every((item) => typeof item === "number" && Number.isFinite(item)) &&
    value.some((item) => item !== 0)
  );
}

function validateRecord(
  value: unknown,
  dimensions: number,
  seen: Set<string>,
): asserts value is SemanticIndexRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SemanticIndexValidationError("Semantic record must be an object");
  const record = value as Record<string, unknown>;
  if (!["work", "passage", "entity"].includes(String(record.kind)))
    throw new SemanticIndexValidationError("Semantic record has invalid kind");
  if (typeof record.id !== "string" || !record.id.trim())
    throw new SemanticIndexValidationError("Semantic record requires an id");
  const key = `${record.kind}:${record.id}`;
  if (seen.has(key))
    throw new SemanticIndexValidationError(`Duplicate semantic record: ${key}`);
  if (!validVector(record.vector, dimensions))
    throw new SemanticIndexValidationError(
      `Semantic record ${key} has an invalid vector`,
    );
  seen.add(key);
}

function validateArtifact(
  value: unknown,
  context: DataContext,
  embedding: EmbeddingPort,
): asserts value is SemanticIndexArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SemanticIndexValidationError("Semantic index must be an object");
  const artifact = value as Record<string, unknown>;
  if (artifact.version !== 1)
    throw new SemanticIndexValidationError(
      "Unsupported semantic index version",
    );
  if (
    artifact.publicationId !== context.publicationId ||
    artifact.contentChecksum !== context.contentChecksum
  )
    throw new SemanticIndexValidationError(
      "Semantic index belongs to another publication",
    );
  if (
    typeof artifact.modelId !== "string" ||
    !artifact.modelId.trim() ||
    artifact.modelId !== embedding.modelId
  )
    throw new SemanticIndexValidationError("Semantic index model mismatch");
  if (
    !Number.isInteger(artifact.dimensions) ||
    Number(artifact.dimensions) <= 0 ||
    artifact.dimensions !== embedding.dimensions
  )
    throw new SemanticIndexValidationError(
      "Semantic index dimensions mismatch",
    );
  if (!Array.isArray(artifact.records))
    throw new SemanticIndexValidationError("Semantic index requires records");
  const seen = new Set<string>();
  for (const record of artifact.records)
    validateRecord(record, embedding.dimensions, seen);
}

function cosine(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!;
    leftMagnitude += left[index]! ** 2;
    rightMagnitude += right[index]! ** 2;
  }
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

/** Creates a local semantic retriever whose artifact is bound to one publication. */
export function createStaticSemanticSearchAdapter(
  value: unknown,
  context: DataContext,
  embedding: EmbeddingPort,
): SemanticSearchPort {
  validateArtifact(value, context, embedding);
  const artifact = value;
  return {
    async search(request) {
      if (
        request.dataContext.publicationId !== context.publicationId ||
        request.dataContext.contentChecksum !== context.contentChecksum
      )
        throw new SemanticIndexValidationError(
          "Semantic query belongs to another publication",
        );
      const text = request.query.text.trim();
      if (!text) return [];
      const queryVector = await embedding.embed(text);
      if (!validVector(queryVector, artifact.dimensions))
        throw new SemanticIndexValidationError(
          "Embedding port returned an invalid vector",
        );
      const limit = Math.max(1, Math.min(Math.floor(request.limit), 1_000));
      return artifact.records
        .map((record): SemanticSearchCandidate => ({
          kind: record.kind,
          id: record.id as never,
          score: cosine(queryVector, record.vector),
        }))
        .toSorted(
          (left, right) =>
            right.score - left.score ||
            `${left.kind}:${left.id}`.localeCompare(
              `${right.kind}:${right.id}`,
            ),
        )
        .slice(0, limit);
    },
  };
}
