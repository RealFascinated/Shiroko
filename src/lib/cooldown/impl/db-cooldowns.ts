import { eq, sql } from "drizzle-orm";
import { db } from "../../../db";
import { cooldowns } from "../../../db/schema";
import { Cooldowns, type Cooldown } from "../cooldowns";

/**
 * Postgres-backed cooldowns, persisted in the `cooldowns` table.
 *
 * `_set` is a single atomic insert-or-replace, so a stale row left by a
 * crashed process is overwritten atomically rather than causing a
 * double-claim for the same key.
 *
 * Use this when the bot restarts often, runs multiple processes, or needs
 * cooldowns to survive a restart.
 */
export default class DbCooldowns extends Cooldowns {
  protected override async _set(key: string, cooldown: Cooldown): Promise<void> {
    await db
      .insert(cooldowns)
      .values({
        key,
        endsAt: cooldown.endsAt,
        metadata: cooldown.metadata,
      })
      .onConflictDoUpdate({
        target: cooldowns.key,
        set: {
          endsAt: sql`excluded.ends_at`,
          metadata: sql`excluded.metadata`,
        },
      });
  }

  protected override async _get(key: string): Promise<Cooldown | null> {
    const [row] = await db.select().from(cooldowns).where(eq(cooldowns.key, key));
    if (!row) {
      return null;
    }
    return {
      endsAt: row.endsAt,
      metadata:
        typeof row.metadata === "object" && row.metadata !== null
          ? (row.metadata as Record<string, unknown>)
          : undefined,
    };
  }

  protected override async _delete(key: string): Promise<void> {
    await db.delete(cooldowns).where(eq(cooldowns.key, key));
  }

  protected override async _clear(userId: string): Promise<void> {
    await db.delete(cooldowns).where(sql`key LIKE ${`${userId}:%`}`);
  }
}
