import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { guildSettings, now, type JsonValue } from "../db/schema";

/**
 * Key-value settings store backing the generic `/settings` system. One row
 * per (guild, key); keys are namespaced `<module>.<setting>`. Absence of a
 * row means "use the code-side default", so deleting a row resets a
 * setting. No in-process cache: every read hits the DB, matching the
 * levelling config reads.
 */
export default class GuildSettings {
  /**
   * Read a setting's stored value, or `null` when no row exists (the
   * caller falls back to its module default).
   */
  public static async get(guildId: string, key: string): Promise<JsonValue | null> {
    const [row] = await db
      .select({ value: guildSettings.value })
      .from(guildSettings)
      .where(and(eq(guildSettings.guildId, guildId), eq(guildSettings.key, key)));
    return row?.value ?? null;
  }

  /**
   * Upsert a value; passing `null` deletes the row (back to default).
   */
  public static async set(guildId: string, key: string, value: JsonValue | null): Promise<void> {
    if (value === null) {
      await db
        .delete(guildSettings)
        .where(and(eq(guildSettings.guildId, guildId), eq(guildSettings.key, key)));
      return;
    }
    await db
      .insert(guildSettings)
      .values({ guildId, key, value })
      .onConflictDoUpdate({
        target: [guildSettings.guildId, guildSettings.key],
        set: { value, updatedAt: now },
      });
  }

  /**
   * Every stored row for a guild.
   */
  public static async all(guildId: string): Promise<Map<string, JsonValue>> {
    const rows = await db
      .select({ key: guildSettings.key, value: guildSettings.value })
      .from(guildSettings)
      .where(eq(guildSettings.guildId, guildId));
    return new Map(rows.map(row => [row.key, row.value]));
  }
}
