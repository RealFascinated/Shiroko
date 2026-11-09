import MemberBoostUpdatedEvent from "@/event/events/member-boost-updated.event";
import type { HistoryEntry } from "@/history/history-kind";
import GuildEventKind from "@/history/guild-event-kind";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";

export default class MemberBoostKind extends GuildEventKind<MemberBoostUpdatedEvent> {
  public readonly id: string = "boost";
  public readonly label: string = "Boost";
  public readonly eventClass: new (...args: any[]) => MemberBoostUpdatedEvent = MemberBoostUpdatedEvent;

  public draft({ newMember, boosted }: MemberBoostUpdatedEvent): GuildHistoryDraft {
    return { guild: newMember.guild, subjectId: newMember.id, oldValue: !boosted, newValue: boosted };
  }

  protected override title(row: HistoryEntry): string {
    return row.newValue ? "Started boosting" : "Stopped boosting";
  }

  protected override details(): string[] {
    return [];
  }
}
