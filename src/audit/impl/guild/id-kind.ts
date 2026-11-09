import type Event from "@/event/event";
import GuildEventKind from "@/audit/guild-event-kind";

export default abstract class IdKind<E extends Event> extends GuildEventKind<E> {
  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}
