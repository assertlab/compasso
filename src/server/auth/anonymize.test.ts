import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { displayName } from "@/lib/display-name";
import { createTestDb, type TestDb } from "@/test/db";
import { anonymizeAccount, AnonymizeBlockedError, planAnonymization } from "./anonymize";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";
import { resolveWorkspaceContext, type AuthSessionLike } from "./workspace-context";

describe("anonymizeAccount (ADR-034)", () => {
  let db: TestDb;
  let auth: ReturnType<typeof createAuth>;
  const mails: { text: string }[] = [];
  const asDb = () => db as unknown as Db;

  beforeAll(async () => {
    db = await createTestDb();
    auth = createAuth({
      db: asDb(),
      nextJsCookies: false,
      env: getAuthEnv({ NODE_ENV: "test", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123" }),
      send: async (m) => void mails.push(m),
    });
  });

  async function signIn(email: string) {
    mails.length = 0;
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    await new Promise((r) => setTimeout(r, 20));
    const otp = /(\d{6})/.exec(mails[0].text)![1];
    const res = await auth.api.signInEmailOTP({ body: { email, otp }, returnHeaders: true });
    const headers = new Headers({ cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") });
    return { headers, user: res.response.user };
  }
  const sessionOf = (user: { id: string; email: string; name: string }, orgId: string): AuthSessionLike => ({
    user: { id: user.id, email: user.email, name: user.name, image: null },
    session: { activeOrganizationId: orgId },
  });
  /** A person with a workspace provisioned in our tables. */
  async function person(email: string, slug: string) {
    const u = await signIn(email);
    const org = await auth.api.createOrganization({ headers: u.headers, body: { name: slug, slug } });
    const res = await resolveWorkspaceContext(asDb(), sessionOf(u.user, org.id));
    if (res.kind !== "ok") throw new Error("not provisioned");
    return { ...u, org, ctx: res.context };
  }
  const userRow = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];

  it("strips PII, removes access, deletes identity data and keeps the row as 'Usuário removido'", async () => {
    const a = await person("erase@example.com", "erase-org");
    const b = await signIn("keeper@example.com");
    const inv = await auth.api.createInvitation({ headers: a.headers, body: { email: "keeper@example.com", role: "admin", organizationId: a.org.id } });
    await auth.api.acceptInvitation({ headers: b.headers, body: { invitationId: inv.id } });
    // pending invitation addressed to the person being erased, from someone else
    const other = await person("other@example.com", "other-org");
    await auth.api.createInvitation({ headers: other.headers, body: { email: "erase@example.com", role: "member", organizationId: other.org.id } });

    const result = await anonymizeAccount(asDb(), a.ctx.userId);
    expect(result.status).toBe("anonymized");

    const row = await userRow(a.ctx.userId);
    expect(row.deletedAt).not.toBeNull();
    expect(row.email).toBe(`deleted-${a.ctx.userId}@anonymized.invalid`);
    expect(row.name).toBeNull();
    expect(row.avatarUrl).toBeNull();
    expect(row.clerkId).toBeNull();
    expect(displayName(row)).toBe("Usuário removido");

    const [m] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.userId, a.ctx.userId), eq(workspaceMembers.workspaceId, a.ctx.workspaceId)));
    expect(m.removedAt).not.toBeNull();
    expect(await db.select().from(authSchema.user).where(eq(authSchema.user.id, a.user.id))).toHaveLength(0);
    expect(await db.select().from(authSchema.session).where(eq(authSchema.session.userId, a.user.id))).toHaveLength(0);
    expect(await db.select().from(authSchema.invitation).where(eq(authSchema.invitation.email, "erase@example.com"))).toHaveLength(0);
  });

  it("is idempotent", async () => {
    const a = await person("twice@example.com", "twice-org");
    await anonymizeAccount(asDb(), a.ctx.userId);
    expect((await anonymizeAccount(asDb(), a.ctx.userId)).status).toBe("already-anonymized");
  });

  it("resumes from a partial run (access removed and identity gone, row not yet anonymized)", async () => {
    const a = await person("partial@example.com", "partial-org");
    await db.update(workspaceMembers).set({ removedAt: new Date() }).where(eq(workspaceMembers.userId, a.ctx.userId));
    await db.delete(authSchema.user).where(eq(authSchema.user.id, a.user.id));
    expect((await anonymizeAccount(asDb(), a.ctx.userId)).status).toBe("anonymized");
    expect((await userRow(a.ctx.userId)).deletedAt).not.toBeNull();
  });

  it("archives a workspace where the person is the only member", async () => {
    const a = await person("solo@example.com", "solo-org");
    const result = await anonymizeAccount(asDb(), a.ctx.userId);
    expect(result).toMatchObject({ status: "anonymized", archived: ["solo-org"] });
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, a.ctx.workspaceId));
    expect(ws.archivedAt).not.toBeNull();
  });

  it("blocks when the person is the only admin of a workspace with other members, and writes nothing", async () => {
    const a = await person("lastadmin@example.com", "lastadmin-org");
    const g = await signIn("teammate@example.com");
    const inv = await auth.api.createInvitation({ headers: a.headers, body: { email: "teammate@example.com", role: "member", organizationId: a.org.id } });
    await auth.api.acceptInvitation({ headers: g.headers, body: { invitationId: inv.id } });
    expect((await resolveWorkspaceContext(asDb(), sessionOf(g.user, a.org.id))).kind).toBe("ok");

    expect((await planAnonymization(asDb(), a.ctx.userId)).status).toBe("blocked");
    await expect(anonymizeAccount(asDb(), a.ctx.userId)).rejects.toBeInstanceOf(AnonymizeBlockedError);
    expect((await userRow(a.ctx.userId)).deletedAt).toBeNull();
    expect(await db.select().from(authSchema.user).where(eq(authSchema.user.id, a.user.id))).toHaveLength(1);

    // promoting the other person unblocks it, and the workspace stays active
    await db.update(workspaceMembers).set({ role: "admin" }).where(eq(workspaceMembers.userId, (await db.select().from(users).where(eq(users.authId, g.user.id)))[0].id));
    expect((await anonymizeAccount(asDb(), a.ctx.userId)).status).toBe("anonymized");
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, a.ctx.workspaceId));
    expect(ws.archivedAt).toBeNull();
  });

  it("does not resurrect the old person when the same e-mail signs in again", async () => {
    const a = await person("again@example.com", "again-org");
    await anonymizeAccount(asDb(), a.ctx.userId);

    const back = await signIn("again@example.com");
    expect(back.user.id).not.toBe(a.user.id);
    const org = await auth.api.createOrganization({ headers: back.headers, body: { name: "Fresh", slug: "fresh-org" } });
    const res = await resolveWorkspaceContext(asDb(), sessionOf(back.user, org.id));
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") expect(res.context.userId).not.toBe(a.ctx.userId);
    expect((await userRow(a.ctx.userId)).deletedAt).not.toBeNull();
  });

  it("archives the workspace when the Better Auth organization is deleted (afterDeleteOrganization)", async () => {
    const a = await person("orgdel@example.com", "orgdel-org");
    await auth.api.deleteOrganization({ headers: a.headers, body: { organizationId: a.org.id } });
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, a.ctx.workspaceId));
    expect(ws.archivedAt).not.toBeNull();
  });
});
