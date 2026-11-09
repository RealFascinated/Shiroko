import { AuditLogEvent } from "discord.js";
import MemberTimeoutUpdatedEvent from "@/event/events/member-timeout-updated.event";
import type { HistoryEntry } from "@/history/history-kind";
import GuildEventKind from "@/history/guild-event-kind";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";

export default class MemberTimeoutKind extends GuildEventKind<MemberTimeoutUpdatedEvent> {
  public readonly id: string = "timeout";
  public readonly label: string = "Timeout";
  public readonly eventClass: new (...args: any[]) => MemberTimeoutUpdatedEvent = MemberTimeoutUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.MemberUpdate];

  public draft({ oldMember, newMember, timeoutUntil }: MemberTimeoutUpdatedEvent): GuildHistoryDraft {
    return {
      guild: newMember.guild,
      subjectId: newMember.id,
      oldValue: oldMember.communicationDisabledUntil?.toISOString() ?? null,
      newValue: timeoutUntil?.toISOString() ?? null,
    };
  }

  protected override title(row: HistoryEntry): string {
    return typeof row.newValue === "string" ? "Timed out" : "Timeout removed";
  }

  protected override details(row: HistoryEntry): string[] {
    return typeof row.newValue === "string"
      ? [`**Until**: <t:${Math.floor(new Date(row.newValue).getTime() / 1000)}:f>`]
      : [];
  }
}
