import type { JsonValue } from "../db/schemas/guild-settings";
import type { HistoryActor } from "./history-writer";

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

/**
 * The before/after values of the fields that differ, or `null` when none
 * does, so an update event for a field nobody tracks records nothing.
 */
export function diffFields(
  before: Record<string, JsonValue>,
  after: Record<string, JsonValue>
): HistoryChange | null {
  // Discord reports an unset text field as null in one payload and "" in another.
  const normalize = (value: JsonValue | undefined): JsonValue =>
    value === undefined || value === "" ? null : value;
  const changed = Object.keys(after).filter(key => normalize(before[key]) !== normalize(after[key]));
  if (changed.length === 0) {
    return null;
  }
  return {
    oldValue: Object.fromEntries(changed.map(key => [key, normalize(before[key])])),
    newValue: Object.fromEntries(changed.map(key => [key, normalize(after[key])])),
  };
}

/** A row of either history table, in the one shape every kind describes. */
export interface HistoryEntry extends HistoryChange {
  id: number;
  kind: string;
  subjectId: string;
  actorId: string | null;
  createdAt: Date;
}

/**
 * A header (what, when, who) over the quoted lines that say what changed.
 * `heading` is already markdown, so a kind can put the subject in it.
 */
export function entryText(heading: string, row: HistoryEntry, lines: string[], reference?: string): string {
  const header = [heading, `<t:${Math.floor(row.createdAt.getTime() / 1000)}:R>`];
  if (row.actorId && row.actorId !== row.subjectId) {
    header.push(`by <@${row.actorId}>`);
  }
  if (reference) {
    header.push(reference);
  }
  return [header.join(" · "), ...lines.map(line => `> ${line}`)].join("\n");
}

/**
 * One category of recorded change, whichever table it lives in and however it
 * is recorded. A kind owns how its rows read and, when it can be undone, how
 * to undo one, so the commands never branch on `kind`.
 */
export default abstract class HistoryKind {
  public abstract readonly id: string;
  public abstract readonly label: string;

  /** The bot permission needed to revert an entry of this kind; null = it can't be reverted. */
  public readonly revertFlags: bigint | null = null;

  protected abstract details(row: HistoryEntry): string[] | Promise<string[]>;

  protected title(row: HistoryEntry): string {
    return this.label;
  }

  protected heading(row: HistoryEntry): string {
    return `**${this.title(row)}**`;
  }

  /** Restore the entry's old value, recording the revert as a new entry. Throws a user-readable message on failure. */
  public async revert(row: HistoryEntry, actor: HistoryActor): Promise<void> {
    throw new Error("That change can't be reverted.");
  }

  public async describe(row: HistoryEntry): Promise<string> {
    return entryText(
      this.heading(row),
      row,
      await this.details(row),
      this.revertFlags === null ? undefined : `#${row.id}`
    );
  }

  /** One line for a log or a confirmation: the subject and the change, without the actor or time. */
  public async summary(row: HistoryEntry): Promise<string> {
    return (await this.details(row)).join(", ");
  }
}
