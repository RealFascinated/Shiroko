import type { AuditLogEvent } from "discord.js";
import type Event from "@/event/event";
import GuildHistoryKind, { type GuildHistoryDraft } from "./guild-history-kind";

/** A guild kind recorded from the gateway event that reports the change. */
export default abstract class GuildEventKind<E extends Event> extends GuildHistoryKind {
  public abstract readonly eventClass: new (...args: any[]) => E;

  /** Audit log actions that name who made the change; none = actor unknown. */
  public readonly auditActions: readonly AuditLogEvent[] = [];

  /** `null` records nothing. */
  public abstract draft(event: E): GuildHistoryDraft | null;
}
