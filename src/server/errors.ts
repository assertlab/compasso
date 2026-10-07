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
