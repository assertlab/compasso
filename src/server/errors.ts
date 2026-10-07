/** The resource does not exist in the caller's workspace (also used for other workspaces' ids, so existence never leaks). */
export class NotFoundError extends Error {
  constructor(what = "Resource") {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

/** The caller is authenticated but their role does not allow the operation. */
export class ForbiddenError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** The input is well-formed but breaks a business rule; carries messages (pt-BR) per field. */
export class ValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super(Object.values(fieldErrors)[0] ?? "Invalid input");
    this.name = "ValidationError";
  }
}

/** The operation conflicts with the current state (e.g. a timer is already running in another workspace). */
export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}
