import { z } from "zod";

/**
 * The file a person downloads with "Exportar meus dados" (ADR-037). A public contract: an incompatible change bumps
 * `schemaVersion`. Ids are local to the file (`c1`, `p1`...), never database UUIDs, so nothing internal leaks and a future
 * import can remap them freely.
 */
export const PERSONAL_EXPORT_VERSION = 1;

const key = z.string().min(1);
const instant = z.iso.datetime();

const client = z.object({ key, name: z.string(), archived: z.boolean() });
const project = z.object({ key, clientKey: key, name: z.string(), color: z.string(), archived: z.boolean() });
const task = z.object({ key, projectKey: key, name: z.string(), completed: z.boolean() });
const tag = z.object({ key, name: z.string(), color: z.string() });
const entry = z.object({
  projectKey: key.nullable(),
  taskKey: key.nullable(),
  tagKeys: z.array(key),
  description: z.string(),
  /** UTC instants; the duration is never stored, it is `endedAt - startedAt`. `endedAt` is null for a timer still running. */
  startedAt: instant,
  endedAt: instant.nullable(),
  /** IANA zone of the person when the entry was recorded. */
  timezone: z.string(),
  billable: z.boolean(),
  /** Set when the entry was removed (it can be restored in the app). */
  deletedAt: instant.nullable(),
});

const workspace = z.object({
  key,
  name: z.string(),
  /** The person's current role, or null when they no longer belong to the workspace (their entries are still theirs). */
  role: z.enum(["admin", "member"]).nullable(),
  clients: z.array(client),
  projects: z.array(project),
  tasks: z.array(task),
  tags: z.array(tag),
  entries: z.array(entry),
});

export const personalExportSchema = z
  .object({
    schemaVersion: z.literal(PERSONAL_EXPORT_VERSION),
    exportedAt: instant,
    generator: z.object({ name: z.literal("compasso"), version: z.string() }),
    account: z.object({ name: z.string().nullable(), email: z.string(), timezone: z.string() }),
    workspaces: z.array(workspace),
  })
  .superRefine((data, ctx) => {
    // Every reference resolves inside its own workspace, so a reader never has to guess.
    data.workspaces.forEach((w, wi) => {
      const clients = new Set(w.clients.map((c) => c.key));
      const projects = new Set(w.projects.map((p) => p.key));
      const tasks = new Set(w.tasks.map((t) => t.key));
      const tags = new Set(w.tags.map((t) => t.key));
      const bad = (path: (string | number)[], what: string) => ctx.addIssue({ code: "custom", path: ["workspaces", wi, ...path], message: `Unknown ${what}` });
      w.projects.forEach((p, i) => clients.has(p.clientKey) || bad(["projects", i, "clientKey"], "client"));
      w.tasks.forEach((t, i) => projects.has(t.projectKey) || bad(["tasks", i, "projectKey"], "project"));
      w.entries.forEach((e, i) => {
        if (e.projectKey && !projects.has(e.projectKey)) bad(["entries", i, "projectKey"], "project");
        if (e.taskKey && !tasks.has(e.taskKey)) bad(["entries", i, "taskKey"], "task");
        e.tagKeys.forEach((k, j) => tags.has(k) || bad(["entries", i, "tagKeys", j], "tag"));
      });
    });
  });

export type PersonalExport = z.infer<typeof personalExportSchema>;
