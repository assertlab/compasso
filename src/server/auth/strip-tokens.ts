/**
 * Compasso only uses Google/GitHub to prove who the person is; it never calls their APIs. Keeping provider tokens
 * would add database-leak risk for no benefit (LGPD data minimisation), so they are removed before storing.
 */
const TOKEN_FIELDS = ["accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt"] as const;

export function stripProviderTokens<T extends Record<string, unknown>>(account: T): T {
  const copy: Record<string, unknown> = { ...account };
  for (const field of TOKEN_FIELDS) if (field in copy) copy[field] = null;
  return copy as T;
}
