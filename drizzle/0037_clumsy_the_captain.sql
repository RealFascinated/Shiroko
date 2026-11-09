CREATE INDEX "guild_birthdays_user_id_idx" ON "guild_birthdays" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "guild_users_user_id_idx" ON "guild_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interactions_target_id_idx" ON "interactions" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "reminders_user_id_idx" ON "reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_levels_user_id_idx" ON "user_levels" USING btree ("user_id");