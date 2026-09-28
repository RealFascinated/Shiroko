CREATE TABLE "guild_birthdays" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"birth_date" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_birthdays_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "guild_birthdays" ADD CONSTRAINT "guild_birthdays_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guild_birthdays_month_day_idx" ON "guild_birthdays" USING btree (extract(month from "birth_date"),extract(day from "birth_date"));