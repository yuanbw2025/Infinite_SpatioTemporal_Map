export class DomainError extends Error {
  override readonly name = "DomainError";
}

export class NotFoundError extends DomainError {
  override readonly name = "NotFoundError";

  constructor(kind: string, id: string) {
    super(`${kind} not found: ${id}`);
  }
}

export class ContractMismatchError extends DomainError {
  override readonly name = "ContractMismatchError";
}
