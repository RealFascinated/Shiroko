CREATE TABLE "guild_users" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_message_at" timestamp with time zone,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_users_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "level_configs" ALTER COLUMN "announce_channel_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "guild_users" ADD CONSTRAINT "guild_users_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;