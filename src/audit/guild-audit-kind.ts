import type { Guild } from "discord.js";
import { fieldLines } from "./fields";
import AuditKind, { type AuditChange, type AuditEntry } from "./audit-kind";

export interface GuildAuditDraft extends AuditChange {
  guild: Guild;
  subjectId: string;
}

/**
 * A change inside a guild (a member's roles, a channel's name, a setting,
 * ...), recorded in `guild_audit`. The subject is whatever the change is
 * about, so a kind says how to mention it.
 */
export default abstract class GuildAuditKind extends AuditKind {
  protected mention(subjectId: string): string {
    return `<@${subjectId}>`;
  }

  protected override heading(row: AuditEntry): string {
    return `${super.heading(row)} ${this.mention(row.subjectId)}`;
  }

  protected override details(row: AuditEntry): string[] | Promise<string[]> {
    return fieldLines(row.oldValue, row.newValue);
  }

  public override async summary(row: AuditEntry): Promise<string> {
    return `${this.mention(row.subjectId)}: ${await super.summary(row)}`;
  }
}
