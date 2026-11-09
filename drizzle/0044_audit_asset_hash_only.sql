UPDATE "audit_log_users"
SET "old_value" = to_jsonb("old_value"->>'hash')
WHERE "kind" IN ('avatar', 'banner') AND jsonb_typeof("old_value") = 'object';--> statement-breakpoint
UPDATE "audit_log_users"
SET "new_value" = to_jsonb("new_value"->>'hash')
WHERE "kind" IN ('avatar', 'banner') AND jsonb_typeof("new_value") = 'object';
