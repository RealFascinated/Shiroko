import type { Guild } from "discord.js";
import { db, type DbClient } from "../db/index";
import { guildAuditSchema } from "../db/schemas/guild-audit";
import type { AuditChange } from "./audit-kind";

/** Who made a change; `userId` is null when the bot did it on its own. */
export interface AuditActor {
  guild: Guild;
  userId: string | null;
}

/**
 * Records the audit kinds that are not driven by a gateway event: a change
 * the bot makes itself (settings, permissions). It is a leaf module so the
 * code that owns those writes can import it without reaching the kind registry.
 */
export default class AuditWriter {
  /**
   * Run `change` in a transaction and record what it reports. `change`
   * performs the write and returns the before/after values, or `null` when
   * nothing actually changed, in which case no entry is recorded. A change is
   * written in the same transaction as the row it describes, so the audit
   * can never disagree with the stored state.
   * `onCommitted` runs after the transaction and before the entry event posts,
   * so its handlers read the state just written.
   */
  public static async write(
    actor: AuditActor,
    kind: string,
    subjectId: string,
    change: (tx: DbClient) => Promise<AuditChange | null>,
    onCommitted?: () => void
  ): Promise<void> {
    const entry = await db.transaction(async tx => {
      const changed = await change(tx as unknown as DbClient);
      if (!changed) {
        return null;
      }
      const [row] = await tx
        .insert(guildAuditSchema)
        .values({ guildId: actor.guild.id, actorId: actor.userId, kind, subjectId, ...changed })
        .returning();
      return row ?? null;
    });
    onCommitted?.();
    if (entry) {
      // Dynamic: the bus chain reaches `permissions.ts`, which imports this file.
      const { EventBus } = await import("../event/event-bus");
      const { default: ConfigChangeRecordedEvent } =
        await import("../event/events/config-change-recorded.event");
      await EventBus.post(new ConfigChangeRecordedEvent({ guild: actor.guild, entry }));
    }
  }
}
