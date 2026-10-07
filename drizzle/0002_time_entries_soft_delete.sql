DROP INDEX "time_entries_one_running_per_user_uq";--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_one_running_per_user_uq" ON "time_entries" USING btree ("user_id") WHERE "time_entries"."ended_at" is null and "time_entries"."deleted_at" is null;