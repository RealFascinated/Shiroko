CREATE TABLE "quests" (
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"daily_start" timestamp with time zone NOT NULL,
	"daily_end" timestamp with time zone NOT NULL,
	"weekly_start" timestamp with time zone NOT NULL,
	"weekly_end" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;