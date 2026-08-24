CREATE TABLE "cooldowns" (
	"key" text PRIMARY KEY NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"metadata" jsonb
);