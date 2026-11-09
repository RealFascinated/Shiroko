import PermissionsAuditKind from "../permission/permissions-audit";
import SettingsAuditKind from "../settings/settings-audit";
import type AuditKind from "./audit-kind";

export const AUDIT_KINDS: Record<string, AuditKind> = Object.fromEntries(
  [new SettingsAuditKind(), new PermissionsAuditKind()].map(kind => [kind.id, kind])
);
