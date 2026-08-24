ALTER TABLE "global_users" RENAME COLUMN "created_at" TO "first_seen";--> statement-breakpoint
ALTER TABLE "global_users" DROP COLUMN IF EXISTS "updated_at";