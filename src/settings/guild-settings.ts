import { and, eq } from "drizzle-orm";
import { Cache } from "../cache/cache";
import { Caches } from "../cache/index";
import { guildKey } from "../cache/key";
import { db, now } from "../db/index";
import { guildSettingsSchema, type JsonValue } from "../db/schemas/guild-settings";

/**
 * Key-value settings store backing the generic `/settings` system. One row
 * per (guild, key); keys are namespaced `<module>.<setting>[.<path>]`.
 * Absence of a row means "use the code-side default", so deleting a row
 * resets a setting.
 *
 * Cached per guild as one entry holding every stored key, so a settings
 * read costs a map lookup instead of a query, and `all()` is free. The
 * cache is authoritative: `set` invalidates the guild's entry, and guild
 * leave purges it through the cache registry.
 */
export default class GuildSettings {
  private static readonly CACHE = Caches.register(
    new Cache<Map<string, JsonValue>>({ name: "guild-settings", mode: "authoritative", max: 20_000 })
  );

  /**
   * Every stored key for a guild, from the per-guild cache. Modules merge
   * these over their code-side defaults.
   */
  public static async all(guildId: string): Promise<Map<string, JsonValue>> {
    return GuildSettings.CACHE.load(guildKey(guildId), async () => {
      const rows = await db
        .select({ key: guildSettingsSchema.key, value: guildSettingsSchema.value })
        .from(guildSettingsSchema)
        .where(eq(guildSettingsSchema.guildId, guildId));
      return new Map(rows.map(row => [row.key, row.value]));
    });
  }

  /**
   * Upsert a value; passing `null` deletes the row (back to default).
   */
  public static async set(guildId: string, key: string, value: JsonValue | null): Promise<void> {
    if (value === null) {
      await db
        .delete(guildSettingsSchema)
        .where(and(eq(guildSettingsSchema.guildId, guildId), eq(guildSettingsSchema.key, key)));
    } else {
      await db
        .insert(guildSettingsSchema)
        .values({ guildId, key, value })
        .onConflictDoUpdate({
          target: [guildSettingsSchema.guildId, guildSettingsSchema.key],
          set: { value, updatedAt: now },
        });
    }
    GuildSettings.CACHE.invalidate(guildKey(guildId));
  }
}
