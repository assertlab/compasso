import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { userFromClerk, workspaceFromClerk } from "@/lib/clerk-mappers";
import { roleFromClerk } from "@/lib/roles";
import {
  anonymizeUser,
  archiveWorkspace,
  ensureUser,
  removeMembership,
  upsertMembership,
  upsertUser,
  upsertWorkspace,
} from "@/server/clerk-sync";

/**
 * Clerk -> Compasso sync. Authenticated by the Svix signature
 * (CLERK_WEBHOOK_SIGNING_SECRET), not by a session. Handlers are idempotent
 * because Clerk retries on any non-2xx response.
 */
export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const data = userFromClerk(event.data);
        if (data) await upsertUser(data);
        break;
      }
      case "user.deleted": {
        if (event.data.id) await anonymizeUser(event.data.id);
        break;
      }
      case "organization.created":
      case "organization.updated":
        await upsertWorkspace(workspaceFromClerk(event.data));
        break;
      case "organization.deleted": {
        if (event.data.id) await archiveWorkspace(event.data.id);
        break;
      }
      case "organizationMembership.created":
      case "organizationMembership.updated": {
        const { organization, public_user_data: member, role } = event.data;
        const workspace = await upsertWorkspace(workspaceFromClerk(organization));
        const user = await ensureUser(member.user_id);
        await upsertMembership(workspace.id, user.id, roleFromClerk(role));
        break;
      }
      case "organizationMembership.deleted": {
        const { organization, public_user_data: member } = event.data;
        await removeMembership(organization.id, member.user_id);
        break;
      }
      default:
        // Subscribed-to-more-than-needed events are acknowledged and ignored.
        break;
    }
  } catch (error) {
    console.error("clerk webhook failed", event.type, error);
    return new Response("Webhook handler failed", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}
