ALTER TABLE "economy_balances" RENAME TO "economy_user_economy";--> statement-breakpoint
ALTER TABLE "economy_user_economy" ADD COLUMN "streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "economy_user_economy" ADD COLUMN "last_claimed" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "economy_daily_streaks" DROP CONSTRAINT IF EXISTS "economy_daily_streaks_user_id_global_users_id_fk";--> statement-breakpoint
ALTER TABLE "economy_daily_streaks" DROP CONSTRAINT IF EXISTS "economy_user_economy_user_id_global_users_id_fk";--> statement-breakpoint
DROP TABLE "economy_daily_streaks";