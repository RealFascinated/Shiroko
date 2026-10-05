-- Carry the existing log channel over to the logging module's new key.
UPDATE "guild_settings" SET "key" = 'logging.channelId' WHERE "key" = 'logs.channelId';--> statement-breakpoint
DROP TABLE "autoroles" CASCADE;--> statement-breakpoint
DROP TABLE "guild_features" CASCADE;--> statement-breakpoint
DROP TABLE "level_rewards" CASCADE;--> statement-breakpoint
DROP TABLE "logging" CASCADE;