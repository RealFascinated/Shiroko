CREATE INDEX "guild_afk_user_id_idx" ON "guild_afk" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "media_superseded_idx" ON "media" USING btree ("superseded_at");