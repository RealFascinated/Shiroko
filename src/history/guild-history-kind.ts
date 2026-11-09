import type { Guild } from "discord.js";
import { fieldLines } from "./fields";
import HistoryKind, { type HistoryChange, type HistoryEntry } from "./history-kind";

export interface GuildHistoryDraft extends HistoryChange {
  guild: Guild;
  subjectId: string;
}

/**
 * A change inside a guild (a member's roles, a channel's name, a setting,
 * ...), recorded in `guild_history`. The subject is whatever the change is
 * about, so a kind says how to mention it.
 */
export default abstract class GuildHistoryKind extends HistoryKind {
  protected mention(subjectId: string): string {
    return `<@${subjectId}>`;
  }

  protected override heading(row: HistoryEntry): string {
    return `${super.heading(row)} ${this.mention(row.subjectId)}`;
  }

  protected override details(row: HistoryEntry): string[] | Promise<string[]> {
    return fieldLines(row.oldValue, row.newValue);
  }

  public override async summary(row: HistoryEntry): Promise<string> {
    return `${this.mention(row.subjectId)}: ${await super.summary(row)}`;
  }
}
