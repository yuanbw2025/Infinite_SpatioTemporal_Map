export class DomainError extends Error {
  override readonly name: string = "DomainError";
}

export class NotFoundError extends DomainError {
  override readonly name: string = "NotFoundError";

  constructor(kind: string, id: string) {
    super(`${kind} not found: ${id}`);
  }
}

export class ContractMismatchError extends DomainError {
  override readonly name: string = "ContractMismatchError";
}
