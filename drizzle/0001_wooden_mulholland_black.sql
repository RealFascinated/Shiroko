CREATE TABLE "global_users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interaction_profiles" (
	"global_user_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "guild_members" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "interaction_profiles" ADD CONSTRAINT "interaction_profiles_global_user_id_global_users_id_fk" FOREIGN KEY ("global_user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;