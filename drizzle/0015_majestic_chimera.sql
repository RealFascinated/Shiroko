CREATE TABLE "guild_invites" (
	"guild_id" text NOT NULL,
	"code" text NOT NULL,
	"inviter_id" text,
	"uses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_invites_guild_id_code_pk" PRIMARY KEY("guild_id","code")
);
--> statement-breakpoint
CREATE TABLE "invite_joins" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"guild_id" text NOT NULL,
	"member_id" text NOT NULL,
	"inviter_id" text,
	"code" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "invite_joins_guild_joined_idx" ON "invite_joins" USING btree ("guild_id","joined_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invite_joins_inviter_idx" ON "invite_joins" USING btree ("guild_id","inviter_id");