import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getTenant = vi.fn();
const consumeExportQuota = vi.fn();
const loadReport = vi.fn();
const loadCatalog = vi.fn();

vi.mock("@/server/get-tenant", () => ({ getTenant }));
vi.mock("@/server/export-limit", () => ({ consumeExportQuota }));
vi.mock("../load-report", () => ({ loadReport }));
vi.mock("../../views", () => ({ loadCatalog }));
vi.mock("@/server/report-pdf", () => ({ buildPdf: vi.fn() }));
vi.mock("@/server/report-xlsx", () => ({ buildXlsx: vi.fn() }));

const { GET } = await import("./route");
const get = (qs: string) => GET(new NextRequest(`http://localhost:3000/relatorios/export?${qs}`));

/** COMP-011: the route refuses before it builds anything expensive. */
describe("GET /relatorios/export rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenant.mockResolvedValue({ ctx: { userId: "user-1", timezone: "America/Recife" }, tenant: {} });
  });

  it("answers 429 with Retry-After and loads nothing when the quota is spent", async () => {
    consumeExportQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const res = await get("formato=pdf");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(consumeExportQuota).toHaveBeenCalledWith("user-1");
    expect(loadReport).not.toHaveBeenCalled();
  });

  it("goes on to load the report when the quota allows", async () => {
    consumeExportQuota.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 });
    loadReport.mockResolvedValue({ periodError: "Período inválido." });
    loadCatalog.mockResolvedValue({});
    const res = await get("formato=csv");
    expect(res.status).toBe(400);
    expect(loadReport).toHaveBeenCalledTimes(1);
  });

  it("does not spend quota on an invalid format", async () => {
    const res = await get("formato=exe");
    expect(res.status).toBe(400);
    expect(consumeExportQuota).not.toHaveBeenCalled();
  });
});
