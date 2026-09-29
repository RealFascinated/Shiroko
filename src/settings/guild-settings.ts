import { and, eq } from "drizzle-orm";
import { Cache } from "../cache/cache";
import { Caches } from "../cache/index";
import { guildKey } from "../cache/key";
import { db, now } from "../db/index";
import { guildSettings, type JsonValue } from "../db/schemas/guild-settings";

/**
 * Key-value settings store backing the generic `/settings` system. One row
 * per (guild, key); keys are namespaced `<module>.<setting>`. Absence of a
 * row means "use the code-side default", so deleting a row resets a
 * setting.
 *
 * Cached per guild as one entry holding every stored key, so a settings
 * read costs a map lookup instead of a query, and `all()` is free. The
 * cache is authoritative: `set` invalidates the guild's entry, and guild
 * leave purges it through the cache registry.
 */
export default class GuildSettings {
  private static readonly CACHE = Caches.register(
    new Cache<Map<string, JsonValue>>({ name: "guild-settings", mode: "authoritative", max: 5_000 })
  );

  /**
   * Read a setting's stored value, or `null` when no row exists (the
   * caller falls back to its module default).
   */
  public static async get(guildId: string, key: string): Promise<JsonValue | null> {
    const stored = await GuildSettings.CACHE.load(guildKey(guildId), async () => {
      const rows = await db
        .select({ key: guildSettings.key, value: guildSettings.value })
        .from(guildSettings)
        .where(eq(guildSettings.guildId, guildId));
      return new Map(rows.map(row => [row.key, row.value]));
    });
    return stored.get(key) ?? null;
  }

  /**
   * Upsert a value; passing `null` deletes the row (back to default).
   */
  public static async set(guildId: string, key: string, value: JsonValue | null): Promise<void> {
    if (value === null) {
      await db
        .delete(guildSettings)
        .where(and(eq(guildSettings.guildId, guildId), eq(guildSettings.key, key)));
    } else {
      await db
        .insert(guildSettings)
        .values({ guildId, key, value })
        .onConflictDoUpdate({
          target: [guildSettings.guildId, guildSettings.key],
          set: { value, updatedAt: now },
        });
    }
    GuildSettings.CACHE.invalidate(guildKey(guildId));
  }
}
