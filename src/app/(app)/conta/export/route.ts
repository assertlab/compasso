import { consumeExportQuota } from "@/server/export-limit";
import { getPersonalExport, personalExportFileName } from "@/server/personal-export";
import { requireWorkspaceContext } from "@/server/workspace-context";

/**
 * GET /conta/export: the signed-in person's own data as JSON (ADR-037). The person comes from the session and nothing in
 * the URL can widen it; it shares the per-person export quota with the report files (COMP-011).
 */
export async function GET() {
  const ctx = await requireWorkspaceContext();
  const quota = await consumeExportQuota(ctx.userId);
  if (!quota.allowed) {
    return new Response("Muitas exportações em pouco tempo. Aguarde um instante e tente de novo.", {
      status: 429,
      headers: { "Retry-After": String(quota.retryAfterSeconds), "Cache-Control": "no-store" },
    });
  }
  const now = new Date();
  const data = await getPersonalExport(ctx.userId);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${personalExportFileName(now)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
