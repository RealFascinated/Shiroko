CREATE TABLE "level_configs" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"curve" text DEFAULT 'normal' NOT NULL,
	"message_xp" integer DEFAULT 10 NOT NULL,
	"message_cooldown_s" integer DEFAULT 60 NOT NULL,
	"voice_xp_per_min" integer DEFAULT 2 NOT NULL,
	"ignored_channel_ids" text DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_rewards" (
	"guild_id" text NOT NULL,
	"level" integer NOT NULL,
	"type" text NOT NULL,
	"role_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_rewards_guild_id_level_pk" PRIMARY KEY("guild_id","level")
);
--> statement-breakpoint
CREATE TABLE "user_levels" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"last_message_xp_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_levels_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user_levels" ADD CONSTRAINT "user_levels_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_levels_guild_xp_idx" ON "user_levels" USING btree ("guild_id","xp" DESC NULLS LAST);