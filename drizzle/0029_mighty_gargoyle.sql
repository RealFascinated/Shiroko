CREATE TABLE "media" (
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"hash" text NOT NULL,
	"filename" text NOT NULL,
	"extension" text NOT NULL,
	"size" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "media_user_id_kind_hash_pk" PRIMARY KEY("user_id","kind","hash")
);
--> statement-breakpoint
CREATE INDEX "media_superseded_idx" ON "media" USING btree ("superseded_at");