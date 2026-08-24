CREATE TABLE "interactions" (
	"actor_id" text NOT NULL,
	"target_id" text NOT NULL,
	"type" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interactions_actor_id_target_id_type_pk" PRIMARY KEY("actor_id","target_id","type")
);
--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_actor_id_global_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_target_id_global_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."global_users"("id") ON DELETE cascade ON UPDATE no action;