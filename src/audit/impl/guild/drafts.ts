import type { Guild } from "discord.js";
import type { JsonValue } from "@/db/schemas/guild-settings";
import { diffFields } from "@/audit/audit-kind";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";

export type Fields = Record<string, JsonValue>;

export function created(guild: Guild | null, subjectId: string, fields: Fields): GuildAuditDraft | null {
  return guild && { guild, subjectId, oldValue: null, newValue: fields };
}

export function deleted(guild: Guild | null, subjectId: string, fields: Fields): GuildAuditDraft | null {
  return guild && { guild, subjectId, oldValue: fields, newValue: null };
}

export function updated(
  guild: Guild | null,
  subjectId: string,
  before: Fields,
  after: Fields
): GuildAuditDraft | null {
  const change = diffFields(before, after);
  return guild && change && { guild, subjectId, ...change };
}
