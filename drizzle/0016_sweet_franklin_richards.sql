CREATE TABLE "permission_roles" (
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"flags" text DEFAULT '0' NOT NULL,
	"parent_role_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_roles_guild_id_role_id_pk" PRIMARY KEY("guild_id","role_id")
);
