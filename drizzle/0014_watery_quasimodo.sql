CREATE TABLE "guild_features" (
	"guild_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_features_guild_id_feature_id_pk" PRIMARY KEY("guild_id","feature_id")
);
