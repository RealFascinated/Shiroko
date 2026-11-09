import { AuditLogEvent } from "discord.js";
import ThreadDeletedEvent from "@/event/events/thread-deleted.event";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { deleted } from "../drafts";
import { threadFields } from "./thread-fields";
import ThreadKind from "./thread-kind";

export default class ThreadDeleteKind extends ThreadKind<ThreadDeletedEvent> {
  public readonly id: string = "thread_delete";
  public readonly label: string = "Thread deleted";
  public readonly eventClass: new (...args: any[]) => ThreadDeletedEvent = ThreadDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ThreadDelete];

  public draft({ thread }: ThreadDeletedEvent): GuildHistoryDraft | null {
    return deleted(thread.guild, thread.id, threadFields(thread));
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}
