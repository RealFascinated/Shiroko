CREATE TABLE "guild_marriages" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"partner_id" text NOT NULL,
	"married_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_marriages_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "guild_marriages" ADD CONSTRAINT "guild_marriages_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_marriages" ADD CONSTRAINT "guild_marriages_partner_id_global_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guild_marriages_user_id_idx" ON "guild_marriages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "guild_marriages_partner_id_idx" ON "guild_marriages" USING btree ("partner_id");