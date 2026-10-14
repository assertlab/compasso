import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceContext = vi.fn();
const consumeExportQuota = vi.fn();
const getPersonalExport = vi.fn();

vi.mock("@/server/workspace-context", () => ({ requireWorkspaceContext }));
vi.mock("@/server/export-limit", () => ({ consumeExportQuota }));
vi.mock("@/server/personal-export", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/personal-export")>()), getPersonalExport }));

const { GET } = await import("./route");

describe("GET /conta/export (ADR-037)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceContext.mockResolvedValue({ userId: "user-1" });
  });

  it("answers 429 with Retry-After and reads no data when the quota is spent", async () => {
    consumeExportQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const res = await GET();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(consumeExportQuota).toHaveBeenCalledWith("user-1");
    expect(getPersonalExport).not.toHaveBeenCalled();
  });

  it("exports the session's person, as a non-cacheable JSON download", async () => {
    consumeExportQuota.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 });
    getPersonalExport.mockResolvedValue({ schemaVersion: 1, workspaces: [] });
    const res = await GET();
    expect(getPersonalExport).toHaveBeenCalledWith("user-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="compasso-meus-dados-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.json()).toEqual({ schemaVersion: 1, workspaces: [] });
  });
});
