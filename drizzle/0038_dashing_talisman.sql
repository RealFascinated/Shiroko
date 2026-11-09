CREATE TABLE "birthday_announcements" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	CONSTRAINT "birthday_announcements_guild_id_user_id_year_pk" PRIMARY KEY("guild_id","user_id","year")
);
--> statement-breakpoint
CREATE TABLE "birthday_wishes" (
	"component_id" uuid NOT NULL,
	"wisher_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "birthday_wishes_component_id_wisher_id_pk" PRIMARY KEY("component_id","wisher_id")
);
--> statement-breakpoint
ALTER TABLE "birthday_announcements" ADD CONSTRAINT "birthday_announcements_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_wishes" ADD CONSTRAINT "birthday_wishes_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_wishes" ADD CONSTRAINT "birthday_wishes_wisher_id_global_users_id_fk" FOREIGN KEY ("wisher_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "birthday_announcements_user_id_idx" ON "birthday_announcements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "birthday_wishes_wisher_id_idx" ON "birthday_wishes" USING btree ("wisher_id");