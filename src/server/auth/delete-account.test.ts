import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users, workspaceMembers as workspaceMembersTable } from "@/db/schema";
import { addMember, createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import {
  confirmDeletion,
  DELETE_CODE_LIMITS,
  DELETE_CODE_MAX_ATTEMPTS,
  DELETE_CODE_TTL_MS,
  requestDeletionCode,
} from "./delete-account";
import type { Mail } from "./mail";

describe("account deletion by code (ADR-037)", () => {
  let db: TestDb;
  let mails: Mail[];
  const asDb = () => db as unknown as Db;
  const send = async (m: Mail) => void mails.push(m);
  const codeFrom = (m: Mail) => /(\d{6})/.exec(m.text)![1];
  const wrong = (code: string) => (code === "000000" ? "111111" : "000000");
  const userRow = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];
  const stored = () => db.select().from(authSchema.verification);

  beforeEach(async () => {
    db = await createTestDb();
    mails = [];
  });

  it("mails a code to the account address and stores only its hash", async () => {
    const a = await seedWorkspace(db, "ana");
    expect(await requestDeletionCode(asDb(), a.userId, send)).toEqual({ ok: true });
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("ana@example.com");
    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0].value).not.toContain(codeFrom(mails[0]));
  });

  it("erases the account with the right code and the typed word", async () => {
    const a = await seedWorkspace(db, "bia");
    await requestDeletionCode(asDb(), a.userId, send);
    const result = await confirmDeletion(asDb(), a.userId, { code: codeFrom(mails[0]), confirmation: "EXCLUIR" });
    expect(result).toEqual({ ok: true, archived: ["Workspace bia"] });
    expect((await userRow(a.userId)).deletedAt).not.toBeNull();
    expect(await stored()).toHaveLength(0);
  });

  it("refuses without the typed word and keeps the code usable", async () => {
    const a = await seedWorkspace(db, "caio");
    await requestDeletionCode(asDb(), a.userId, send);
    const code = codeFrom(mails[0]);
    expect(await confirmDeletion(asDb(), a.userId, { code, confirmation: "excluir" })).toEqual({ ok: false, reason: "wrong-confirmation" });
    expect((await userRow(a.userId)).deletedAt).toBeNull();
    expect((await confirmDeletion(asDb(), a.userId, { code, confirmation: "EXCLUIR" })).ok).toBe(true);
  });

  it("refuses a wrong code, and burns it after the allowed attempts, even if the right one comes next", async () => {
    const a = await seedWorkspace(db, "duda");
    await requestDeletionCode(asDb(), a.userId, send);
    const code = codeFrom(mails[0]);
    for (let i = 0; i < DELETE_CODE_MAX_ATTEMPTS; i++) {
      expect(await confirmDeletion(asDb(), a.userId, { code: wrong(code), confirmation: "EXCLUIR" })).toEqual({ ok: false, reason: "wrong-code" });
    }
    expect(await confirmDeletion(asDb(), a.userId, { code, confirmation: "EXCLUIR" })).toEqual({ ok: false, reason: "too-many-attempts" });
    expect((await userRow(a.userId)).deletedAt).toBeNull();
    expect(await stored()).toHaveLength(0);
  });

  it("refuses an expired code", async () => {
    const a = await seedWorkspace(db, "edu");
    const t0 = Date.now();
    await requestDeletionCode(asDb(), a.userId, send, t0);
    const code = codeFrom(mails[0]);
    expect(await confirmDeletion(asDb(), a.userId, { code, confirmation: "EXCLUIR" }, t0 + DELETE_CODE_TTL_MS + 1)).toEqual({ ok: false, reason: "expired" });
    expect((await userRow(a.userId)).deletedAt).toBeNull();
  });

  it("refuses when no code was requested", async () => {
    const a = await seedWorkspace(db, "fabi");
    expect(await confirmDeletion(asDb(), a.userId, { code: "123456", confirmation: "EXCLUIR" })).toEqual({ ok: false, reason: "no-code" });
  });

  it("a code is single use and a new request replaces the old one", async () => {
    const a = await seedWorkspace(db, "gil");
    await requestDeletionCode(asDb(), a.userId, send);
    await requestDeletionCode(asDb(), a.userId, send);
    expect(await stored()).toHaveLength(1);
    const [first, second] = mails.map(codeFrom);
    if (first !== second) expect(await confirmDeletion(asDb(), a.userId, { code: first, confirmation: "EXCLUIR" })).toMatchObject({ ok: false });
    // a wrong guess above may have spent an attempt, never the code itself
    expect((await confirmDeletion(asDb(), a.userId, { code: second, confirmation: "EXCLUIR" })).ok).toBe(true);
    expect(await confirmDeletion(asDb(), a.userId, { code: second, confirmation: "EXCLUIR" })).toEqual({ ok: false, reason: "not-found" });
  });

  it("another person's code does not erase this account", async () => {
    const a = await seedWorkspace(db, "hana");
    const b = await seedWorkspace(db, "ivo");
    await requestDeletionCode(asDb(), b.userId, send);
    const codeOfB = codeFrom(mails[0]);
    expect(await confirmDeletion(asDb(), a.userId, { code: codeOfB, confirmation: "EXCLUIR" })).toEqual({ ok: false, reason: "no-code" });
    expect((await userRow(a.userId)).deletedAt).toBeNull();
  });

  it("is blocked, with no code mailed and nothing written, when the person is the only admin of a shared workspace", async () => {
    const a = await seedWorkspace(db, "jade");
    await addMember(db, a.workspaceId, "kleber");
    expect(await requestDeletionCode(asDb(), a.userId, send)).toEqual({ ok: false, reason: "blocked", workspaces: ["Workspace jade"] });
    expect(mails).toHaveLength(0);
    expect(await stored()).toHaveLength(0);
  });

  it("re-checks the block when confirming: a code obtained earlier cannot erase the last admin", async () => {
    const a = await seedWorkspace(db, "lia");
    const other = await addMember(db, a.workspaceId, "kleber", "admin");
    await requestDeletionCode(asDb(), a.userId, send);
    await db.update(workspaceMembersTable).set({ role: "member" }).where(eq(workspaceMembersTable.userId, other.userId));
    expect(await confirmDeletion(asDb(), a.userId, { code: codeFrom(mails[0]), confirmation: "EXCLUIR" })).toEqual({ ok: false, reason: "blocked", workspaces: ["Workspace lia"] });
    expect((await userRow(a.userId)).deletedAt).toBeNull();
  });

  it("limits how many codes can be requested", async () => {
    const a = await seedWorkspace(db, "mara");
    const hour = DELETE_CODE_LIMITS[0].max;
    for (let i = 0; i < hour; i++) expect((await requestDeletionCode(asDb(), a.userId, send)).ok).toBe(true);
    const refused = await requestDeletionCode(asDb(), a.userId, send);
    expect(refused).toMatchObject({ ok: false, reason: "rate-limited" });
    expect(mails).toHaveLength(hour);
  });

  it("does nothing for an already erased account", async () => {
    const a = await seedWorkspace(db, "nilo");
    await requestDeletionCode(asDb(), a.userId, send);
    await confirmDeletion(asDb(), a.userId, { code: codeFrom(mails[0]), confirmation: "EXCLUIR" });
    expect(await requestDeletionCode(asDb(), a.userId, send)).toEqual({ ok: false, reason: "not-found" });
  });
});
