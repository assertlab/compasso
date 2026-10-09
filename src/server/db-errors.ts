/** True when a database error (possibly wrapped by Drizzle, with the driver error in `cause`) is a unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth++) {
    if ("code" in current && (current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Postgres SQLSTATE of an error, also when Drizzle or the driver wrapped it (`cause` chain). */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** `invalid_text_representation`: a value that does not parse for its column, e.g. a malformed uuid sent by a tampered client. */
export const isInvalidInput = (error: unknown) => pgErrorCode(error) === "22P02";
