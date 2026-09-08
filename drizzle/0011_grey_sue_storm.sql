CREATE TABLE "message_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"duration_seconds" integer
);
--> statement-breakpoint
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_events_user_created_idx" ON "message_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_events_guild_created_idx" ON "message_events" USING btree ("guild_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "voice_sessions_user_joined_idx" ON "voice_sessions" USING btree ("user_id","joined_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "voice_sessions_guild_joined_idx" ON "voice_sessions" USING btree ("guild_id","joined_at" DESC NULLS LAST);