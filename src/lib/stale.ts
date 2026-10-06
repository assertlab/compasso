/** True when `updatedAt` is older than `ttlMs` relative to `now`. */
export function isStale(updatedAt: Date, now: Date, ttlMs: number): boolean {
  return now.getTime() - updatedAt.getTime() >= ttlMs;
}
