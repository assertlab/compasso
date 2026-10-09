/** "v0.1.0" in production; Previews and local runs add the commit ("v0.1.0 · 8c1652e" / "v0.1.0 · dev") to tell deploys apart. */
export function formatVersion({ version, vercelEnv, sha }: { version: string; vercelEnv?: string; sha?: string }): string {
  const label = `v${version}`;
  if (vercelEnv === "production") return label;
  return `${label} · ${sha ? sha.slice(0, 7) : "dev"}`;
}

/** Version and year are inlined at build time by next.config.ts; the commit and environment come from Vercel at runtime. */
export function appVersionLabel(): string {
  return formatVersion({
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    vercelEnv: process.env.VERCEL_ENV,
    sha: process.env.VERCEL_GIT_COMMIT_SHA,
  });
}

export function copyrightYear(): string {
  return process.env.NEXT_PUBLIC_BUILD_YEAR ?? String(2026);
}
