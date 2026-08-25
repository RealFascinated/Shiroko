CREATE TYPE "public"."pocket" AS ENUM('wallet', 'bank');--> statement-breakpoint
CREATE TABLE "economy_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"actor_pocket" "pocket" NOT NULL,
	"amount" integer NOT NULL,
	"kind" text NOT NULL,
	"target_id" text,
	"target_pocket" "pocket",
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "economy_transactions" ADD CONSTRAINT "economy_transactions_actor_id_global_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economy_transactions" ADD CONSTRAINT "economy_transactions_target_id_global_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "economy_transactions_created_idx" ON "economy_transactions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "economy_transactions_actor_idx" ON "economy_transactions" USING btree ("actor_id","created_at" DESC NULLS LAST);