ALTER TABLE "user_levels" DROP COLUMN "level";--> statement-breakpoint
ALTER TABLE "level_configs" ALTER COLUMN "voice_xp_per_min" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "level_configs" ADD COLUMN "announce_channel_id" text;