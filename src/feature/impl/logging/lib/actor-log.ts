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

export function actorLines(actor: AuditActor | null): string[] {
  const lines = moderatorLines(actor);
  if (actor?.reason) {
    lines.push(detailLine("Reason", code(actor.reason)));
  }
  return lines;
}
