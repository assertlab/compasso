import { slugify } from "@/lib/slug";

/** Minimal structural shapes of the Clerk payloads we consume (kept narrow so tests need no SDK). */
type ClerkEmail = { id: string; email_address: string };
type ClerkUserPayload = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmail[];
};
type ClerkOrgPayload = { id: string; name: string; slug?: string | null };

export type UserData = { clerkId: string; email: string; name: string | null; avatarUrl: string | null };
export type WorkspaceData = { clerkOrgId: string; name: string; slug: string };

export function fullName(first?: string | null, last?: string | null): string | null {
  return [first, last].filter(Boolean).join(" ") || null;
}

/** Maps a Clerk user payload to our row shape. Returns null when no email is available (users.email is required). */
export function userFromClerk(user: ClerkUserPayload): UserData | null {
  const emails = user.email_addresses ?? [];
  const email = (emails.find((e) => e.id === user.primary_email_address_id) ?? emails[0])?.email_address;
  if (!email) return null;
  return {
    clerkId: user.id,
    email,
    name: fullName(user.first_name, user.last_name),
    avatarUrl: user.image_url ?? null,
  };
}

/**
 * The slug suffix keeps the (unique) slug collision-free across organizations
 * with the same name; it is derived from the Clerk id so it is stable.
 */
export function workspaceFromClerk(org: ClerkOrgPayload): WorkspaceData {
  return {
    clerkOrgId: org.id,
    name: org.name,
    slug: `${slugify(org.slug ?? org.name, 40)}-${org.id.slice(-6).toLowerCase()}`,
  };
}

/**
 * LGPD anonymization for a deleted Clerk user. Keeps the row (and so all
 * time entries) but drops every personal field. The unique columns get
 * deterministic placeholders derived from our own row id.
 */
export function anonymizedUser(rowId: string) {
  return {
    clerkId: `deleted:${rowId}`,
    email: `deleted-${rowId}@anonymized.invalid`,
    name: null,
    avatarUrl: null,
  } as const;
}
