ALTER TABLE "users" DROP CONSTRAINT "users_clerk_id_unique";--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_clerk_org_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_identity_chk";--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_identity_chk";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "clerk_id";--> statement-breakpoint
ALTER TABLE "workspaces" DROP COLUMN "clerk_org_id";