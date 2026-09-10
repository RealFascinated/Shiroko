ALTER TABLE "level_configs" ALTER COLUMN "ignored_channel_ids" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "level_configs" ALTER COLUMN "ignored_channel_ids" SET DEFAULT '[]'::jsonb;