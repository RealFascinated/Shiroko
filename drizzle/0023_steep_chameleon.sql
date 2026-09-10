ALTER TABLE "level_configs" ALTER COLUMN "ignored_channel_ids" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "level_configs" ALTER COLUMN "ignored_channel_ids" SET DATA TYPE jsonb USING "ignored_channel_ids"::jsonb;--> statement-breakpoint
ALTER TABLE "level_configs" ALTER COLUMN "ignored_channel_ids" SET DEFAULT '[]'::jsonb;