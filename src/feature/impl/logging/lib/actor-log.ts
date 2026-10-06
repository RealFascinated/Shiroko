import type { AuditActor } from "./audit-log";
import { code, detailLine } from "./text";
import { userLabel } from "./user-log";

/**
 * The moderator line for an audit-logged change, or no lines at all when
 * the action left no entry, so a log line never claims an actor it could
 * not resolve.
 */
export function moderatorLines(actor: AuditActor | null): string[] {
  return actor ? [detailLine("Moderator", userLabel(actor.executor))] : [];
}

/** {@link moderatorLines} plus the reason the moderator gave, when they gave one. */
export function actorLines(actor: AuditActor | null): string[] {
  const lines = moderatorLines(actor);
  if (actor?.reason) {
    lines.push(detailLine("Reason", code(actor.reason)));
  }
  return lines;
}
