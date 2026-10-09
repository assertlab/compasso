import { slugify } from "./slug";

/** Better Auth requires a unique slug per organization; a short random suffix avoids asking the person for one. */
export function workspaceSlug(name: string, suffix: string = crypto.randomUUID().slice(0, 6)): string {
  return `${slugify(name, 40)}-${suffix}`;
}
