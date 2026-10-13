import { getDb } from "@/db";
import { consumeQuota, type QuotaResult, type QuotaWindow } from "./rate-limit";

/**
 * Report exports (PDF, XLSX, CSV) are the most expensive requests in the app and a period can span a year, so a loop on
 * the endpoint (or a stolen session) would burn function time (COMP-011). Per person, across workspaces. Generous on
 * purpose: a person exports a handful of files a month.
 */
export const EXPORT_LIMITS: readonly QuotaWindow[] = [
  { name: "minute", windowMs: 60 * 1000, max: 10 },
  { name: "hour", windowMs: 60 * 60 * 1000, max: 60 },
];

export function consumeExportQuota(userId: string, now = Date.now()): Promise<QuotaResult> {
  return consumeQuota(getDb(), "export", userId, EXPORT_LIMITS, now);
}
