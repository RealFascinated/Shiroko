CREATE TABLE "logging" (
	"guild_id" text NOT NULL,
	"log_type" text NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "logging_guild_id_log_type_pk" PRIMARY KEY("guild_id","log_type")
);
