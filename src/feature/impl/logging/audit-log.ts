import { AuditLogEvent, type Guild, type GuildAuditLogsEntry, type PartialUser, type User } from "discord.js";

/** Discord can write the audit entry a moment after the gateway event it backs. */
const RESOLVE_ATTEMPTS = 2;
const RESOLVE_DELAY_MS = 500;

/** An entry older than this belongs to some earlier action, not this event. */
const MATCH_WINDOW_MS = 15_000;

/** The target entry is always near the top of a guild's recent entries. */
const FETCH_LIMIT = 10;

export interface AuditActor {
  action: AuditLogEvent;
  executor: User | PartialUser | null;
  reason: string | null;
}

/**
 * The audit log entry behind a gateway event, or `null` when there is none:
 * the bot lacks `View Audit Log`, the action leaves no entry, or the entry
 * never arrived. Only an entry whose action is one of `actions` and whose
 * target is `targetId` counts, so an unrelated recent entry is never
 * reported as the actor.
 */
export async function resolveAuditActor(
  guild: Guild,
  actions: readonly AuditLogEvent[],
  targetId: string
): Promise<AuditActor | null> {
  for (let attempt = 0; attempt < RESOLVE_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await Bun.sleep(RESOLVE_DELAY_MS);
    }
    const entry = await fetchEntry(guild, actions, targetId);
    if (entry) {
      return { action: entry.action, executor: entry.executor, reason: entry.reason };
    }
  }
  return null;
}

/**
 * Fetch the guild's recent entries, filtered server-side by the action when
 * the caller expects exactly one, so the target cannot be pushed out of the
 * window by unrelated activity.
 */
async function fetchEntry(
  guild: Guild,
  actions: readonly AuditLogEvent[],
  targetId: string
): Promise<GuildAuditLogsEntry<AuditLogEvent> | null> {
  try {
    const { entries } = await guild.fetchAuditLogs({
      limit: FETCH_LIMIT,
      type: actions.length === 1 ? actions[0] : null,
    });
    return (
      entries.find(
        entry =>
          actions.includes(entry.action) &&
          entry.targetId === targetId &&
          Date.now() - entry.createdTimestamp < MATCH_WINDOW_MS
      ) ?? null
    );
  } catch {
    // A missing permission or a failed request must not drop the log line.
    return null;
  }
}
