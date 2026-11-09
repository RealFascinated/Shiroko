import type { AuditLogEvent } from "discord.js";
import type Event from "@/event/event";
import type { EventClass } from "./audit-kind";
import GuildAuditKind, { type GuildAuditDraft } from "./guild-audit-kind";

/** A guild kind recorded from the gateway event that reports the change. */
export default abstract class GuildEventKind<E extends Event> extends GuildAuditKind {
  public abstract readonly eventClass: EventClass<E>;

  /** Audit log actions that name who made the change; none = actor unknown. */
  public readonly auditActions: readonly AuditLogEvent[] = [];

  /** `null` records nothing. */
  public abstract draft(event: E): GuildAuditDraft | null;
}
