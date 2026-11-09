import type { AuditLogEvent, Guild, PartialUser, User } from "discord.js";
import type { JsonValue } from "../db/schemas/guild-settings";
import type Event from "../event/event";

const MAX_VALUE_LENGTH = 100;

export interface HistoryChange {
  oldValue: JsonValue | null;
  newValue: JsonValue | null;
}

export function formatValue(value: JsonValue | null): string {
  if (value === null) {
    return "*none*";
  }
  if (Array.isArray(value)) {
    return value.map(formatValue).join(", ") || "*none*";
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, entry]) => `${key}: ${formatValue(entry)}`)
      .join(", ");
  }
  const text = String(value).replaceAll("`", "'");
  return `\`${text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH - 3)}...` : text}\``;
}

export function formatChange(change: HistoryChange): string {
  return `${formatValue(change.oldValue)} → ${formatValue(change.newValue)}`;
}

/**
 * The before/after values of the fields that differ, or `null` when none
 * does, so an update event for a field nobody tracks records nothing.
 */
export function diffFields(
  before: Record<string, JsonValue>,
  after: Record<string, JsonValue>
): HistoryChange | null {
  const changed = Object.keys(after).filter(key => before[key] !== after[key]);
  if (changed.length === 0) {
    return null;
  }
  return {
    oldValue: Object.fromEntries(changed.map(key => [key, before[key] ?? null])),
    newValue: Object.fromEntries(changed.map(key => [key, after[key] ?? null])),
  };
}

/** A row of either history table, in the one shape every kind describes. */
export interface HistoryEntry extends HistoryChange {
  kind: string;
  subjectId: string;
  actorId: string | null;
  createdAt: Date;
}

export interface UserChangeEvent extends Event {
  oldUser: User | PartialUser;
  newUser: User | PartialUser;
}

export interface UserHistoryDraft extends HistoryChange {
  user: User;
}

/**
 * One category of change to a user's global account (username, avatar, ...),
 * recorded once per user in `user_history`.
 */
export abstract class UserHistoryKind<E extends UserChangeEvent> {
  public abstract readonly id: string;
  public abstract readonly label: string;
  public abstract readonly eventClass: new (...args: any[]) => E;

  // The bridge posts one event per mutual guild for the same change, all
  // sharing one `newUser`, so the repeats are the ones already seen.
  private readonly seen: WeakSet<object> = new WeakSet();

  protected abstract change(event: E): HistoryChange;

  public draft(event: E): UserHistoryDraft | null {
    if (event.newUser.partial || this.seen.has(event.newUser)) {
      return null;
    }
    this.seen.add(event.newUser);
    return { user: event.newUser, ...this.change(event) };
  }

  public describe(row: HistoryEntry): string {
    return `**${this.label}**: ${formatChange(row)}`;
  }
}

export interface GuildHistoryDraft extends HistoryChange {
  guild: Guild;
  subjectId: string;
}

/**
 * One category of change inside a guild (a member's roles, a channel's
 * name, ...), recorded in `guild_history`.
 */
export abstract class GuildHistoryKind<E extends Event> {
  public abstract readonly id: string;
  public abstract readonly label: string;
  public abstract readonly eventClass: new (...args: any[]) => E;

  /** Audit log actions that name who made the change; none = actor unknown. */
  public readonly auditActions: readonly AuditLogEvent[] = [];

  /** `null` records nothing. */
  public abstract draft(event: E): GuildHistoryDraft | null;

  protected mention(subjectId: string): string {
    return `<@${subjectId}>`;
  }

  public describe(row: HistoryEntry): string {
    return `**${this.label}** ${this.mention(row.subjectId)}: ${formatChange(row)}`;
  }
}
