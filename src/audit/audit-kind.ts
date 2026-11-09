import type { GuildAuditLogSchema } from "../db/schemas/guild-audit-log";
import type { AuditActor } from "./audit-log";

/**
 * One category of audited change. Each kind knows how to describe its own
 * entries and how to undo one, so `/audit config` never branches on `kind`.
 */
export default abstract class AuditKind {
  public abstract readonly id: string;

  /** The bot permission a member needs to revert an entry of this kind. */
  public abstract readonly revertFlags: bigint;

  /** One line summarizing the entry's change, without the actor or time. */
  public abstract describe(entry: GuildAuditLogSchema): string;

  /** Restore the entry's old value, recording the revert as a new entry. Throws a user-readable message on failure. */
  public abstract revert(entry: GuildAuditLogSchema, actor: AuditActor): Promise<void>;
}
