CREATE TABLE "balances" (
	"user_id" text PRIMARY KEY NOT NULL,
	"wallet" integer DEFAULT 0 NOT NULL,
	"bank" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_streaks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_claimed" timestamp with time zone DEFAULT now() NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_streaks" ADD CONSTRAINT "daily_streaks_user_id_global_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;