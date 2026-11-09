DROP INDEX "media_superseded_idx";--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "media_expires_idx" ON "media" USING btree ("expires_at");--> statement-breakpoint
UPDATE "media" SET "expires_at" = "superseded_at" + interval '30 days' WHERE "superseded_at" IS NOT NULL;
