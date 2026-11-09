INSERT INTO "guild_history" ("guild_id", "kind", "subject_id", "actor_id", "old_value", "new_value", "created_at")
SELECT "guild_id", "kind", "key", "actor_id", "old_value", "new_value", "created_at"
FROM "guild_audit_log"
ORDER BY "id";--> statement-breakpoint
DROP TABLE "guild_audit_log" CASCADE;
