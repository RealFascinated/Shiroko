ALTER TABLE "guild_history" RENAME TO "audit_log_guild";--> statement-breakpoint
ALTER TABLE "user_history" RENAME TO "audit_log_users";--> statement-breakpoint
ALTER SEQUENCE "guild_history_id_seq" RENAME TO "audit_log_guild_id_seq";--> statement-breakpoint
ALTER SEQUENCE "user_history_id_seq" RENAME TO "audit_log_users_id_seq";--> statement-breakpoint
ALTER TABLE "audit_log_guild" RENAME CONSTRAINT "guild_history_pkey" TO "audit_log_guild_pkey";--> statement-breakpoint
ALTER TABLE "audit_log_users" RENAME CONSTRAINT "user_history_pkey" TO "audit_log_users_pkey";--> statement-breakpoint
ALTER TABLE "audit_log_users" RENAME CONSTRAINT "user_history_user_id_global_users_id_fk" TO "audit_log_users_user_id_global_users_id_fk";--> statement-breakpoint
ALTER INDEX "guild_history_subject_created_idx" RENAME TO "audit_log_guild_subject_created_idx";--> statement-breakpoint
ALTER INDEX "guild_history_kind_created_idx" RENAME TO "audit_log_guild_kind_created_idx";--> statement-breakpoint
ALTER INDEX "user_history_user_created_idx" RENAME TO "audit_log_users_user_created_idx";
