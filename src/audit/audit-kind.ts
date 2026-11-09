import type { JsonValue } from "../db/schemas/guild-settings";
import type { AuditActor } from "./audit-writer";

/** The gateway event class a kind listens for. */
export type EventClass<E> = new (...args: any[]) => E;

export interface AuditChange {
  oldValue: JsonValue | null;
  newValue: JsonValue | null;
}

/**
 * The before/after values of the fields that differ, or `null` when none
 * does, so an update event for a field nobody tracks records nothing.
 */
export function diffFields(
  before: Record<string, JsonValue>,
  after: Record<string, JsonValue>
): AuditChange | null {
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

/** A row of either audit table, in the one shape every kind describes. */
export interface AuditEntry extends AuditChange {
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
export function entryText(heading: string, row: AuditEntry, lines: string[], reference?: string): string {
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
export default abstract class AuditKind {
  public abstract readonly id: string;
  public abstract readonly label: string;

  /** The bot permission needed to revert an entry of this kind; null = it can't be reverted. */
  public readonly revertFlags: bigint | null = null;

  protected abstract details(row: AuditEntry): string[] | Promise<string[]>;

  protected title(row: AuditEntry): string {
    return this.label;
  }

  protected heading(row: AuditEntry): string {
    return `**${this.title(row)}**`;
  }

  /** Restore the entry's old value, recording the revert as a new entry. Throws a user-readable message on failure. */
  public async revert(row: AuditEntry, actor: AuditActor): Promise<void> {
    throw new Error("That change can't be reverted.");
  }

  public async describe(row: AuditEntry): Promise<string> {
    return entryText(
      this.heading(row),
      row,
      await this.details(row),
      this.revertFlags === null ? undefined : `#${row.id}`
    );
  }

  /** One line for a log or a confirmation: the subject and the change, without the actor or time. */
  public async summary(row: AuditEntry): Promise<string> {
    return (await this.details(row)).join(", ");
  }
}
