CREATE TABLE "trivia_guesses" (
	"game_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"answer_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trivia_guesses_game_id_user_id_pk" PRIMARY KEY("game_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "trivia_guesses" ADD CONSTRAINT "trivia_guesses_game_id_components_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;