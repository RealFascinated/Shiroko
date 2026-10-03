CREATE TABLE "seen_youtube_uploads" (
	"youtube_channel_id" text NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"published_at" timestamp with time zone,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "seen_youtube_uploads_youtube_channel_id_video_id_pk" PRIMARY KEY("youtube_channel_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "youtube_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"handle" text,
	"last_video_id" text,
	"etag" text,
	"last_modified" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "youtube_subscriptions" (
	"guild_id" text NOT NULL,
	"youtube_channel_id" text NOT NULL,
	"discord_channel_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "youtube_subscriptions_guild_id_youtube_channel_id_pk" PRIMARY KEY("guild_id","youtube_channel_id")
);
--> statement-breakpoint
ALTER TABLE "seen_youtube_uploads" ADD CONSTRAINT "seen_youtube_uploads_youtube_channel_id_youtube_channels_id_fk" FOREIGN KEY ("youtube_channel_id") REFERENCES "public"."youtube_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_subscriptions" ADD CONSTRAINT "youtube_subscriptions_youtube_channel_id_youtube_channels_id_fk" FOREIGN KEY ("youtube_channel_id") REFERENCES "public"."youtube_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seen_youtube_uploads_seen_idx" ON "seen_youtube_uploads" USING btree ("seen_at");--> statement-breakpoint
CREATE INDEX "youtube_subscriptions_youtube_idx" ON "youtube_subscriptions" USING btree ("youtube_channel_id");