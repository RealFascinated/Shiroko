CREATE TABLE "guild_audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guild_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"guild_id" text NOT NULL,
	"actor_id" text,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "guild_audit_log_guild_created_idx" ON "guild_audit_log" USING btree ("guild_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "guild_audit_log_guild_key_idx" ON "guild_audit_log" USING btree ("guild_id","key");