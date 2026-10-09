CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"guild_id" text,
	"channel_id" text,
	"message_id" text NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"extra_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "components_message_idx" ON "components" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "components_expires_idx" ON "components" USING btree ("expires_at");