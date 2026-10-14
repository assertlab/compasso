CREATE TABLE "allowed_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_emails_email_unique" UNIQUE("email"),
	CONSTRAINT "allowed_emails_email_lower" CHECK ("allowed_emails"."email" = lower("allowed_emails"."email"))
);
