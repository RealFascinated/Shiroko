import MemberGuildJoinEvent from "@/event/events/member-guild-join.event";
import { formatValue, type HistoryEntry } from "@/history/history-kind";
import GuildEventKind from "@/history/guild-event-kind";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";

export default class MemberJoinKind extends GuildEventKind<MemberGuildJoinEvent> {
  public readonly id: string = "member_join";
  public readonly label: string = "Joined";
  public readonly eventClass: new (...args: any[]) => MemberGuildJoinEvent = MemberGuildJoinEvent;

  public draft({ member, source }: MemberGuildJoinEvent): GuildHistoryDraft {
    return { guild: member.guild, subjectId: member.id, oldValue: null, newValue: source };
  }

  protected override details(row: HistoryEntry): string[] {
    return [`**Via**: ${formatValue(row.newValue)}`];
  }
}
