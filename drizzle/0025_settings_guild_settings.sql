CREATE TABLE "guild_settings" (
	"guild_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_settings_guild_id_key_pk" PRIMARY KEY("guild_id","key")
);--> statement-breakpoint
INSERT INTO "guild_settings" ("guild_id", "key", "value")
SELECT "guild_id", 'levels.message_xp', to_jsonb("message_xp") FROM "level_configs"
ON CONFLICT ("guild_id", "key") DO NOTHING;--> statement-breakpoint
INSERT INTO "guild_settings" ("guild_id", "key", "value")
SELECT "guild_id", 'levels.message_cooldown', to_jsonb("message_cooldown_seconds" * 1000) FROM "level_configs"
ON CONFLICT ("guild_id", "key") DO NOTHING;--> statement-breakpoint
INSERT INTO "guild_settings" ("guild_id", "key", "value")
SELECT "guild_id", 'levels.voice_xp_per_min', to_jsonb("voice_xp_per_min") FROM "level_configs"
ON CONFLICT ("guild_id", "key") DO NOTHING;--> statement-breakpoint
INSERT INTO "guild_settings" ("guild_id", "key", "value")
SELECT "guild_id", 'levels.ignored_channel_ids', "ignored_channel_ids" FROM "level_configs"
ON CONFLICT ("guild_id", "key") DO NOTHING;--> statement-breakpoint
INSERT INTO "guild_settings" ("guild_id", "key", "value")
SELECT "guild_id", 'levels.announce_channel_id', to_jsonb("announce_channel_id") FROM "level_configs"
WHERE "announce_channel_id" IS NOT NULL
ON CONFLICT ("guild_id", "key") DO NOTHING;--> statement-breakpoint
DROP TABLE "level_configs";
