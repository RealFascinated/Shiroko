CREATE TABLE "guild_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guild_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"guild_id" text NOT NULL,
	"kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"actor_id" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_history" ADD CONSTRAINT "user_history_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guild_history_subject_created_idx" ON "guild_history" USING btree ("guild_id","subject_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "guild_history_kind_created_idx" ON "guild_history" USING btree ("guild_id","kind","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_history_user_created_idx" ON "user_history" USING btree ("user_id","created_at" DESC NULLS LAST);