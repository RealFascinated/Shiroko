CREATE TABLE "guild_afk" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_afk_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "guild_afk" ADD CONSTRAINT "guild_afk_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;