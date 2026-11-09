import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent } from "discord.js";
import ThreadDeletedEvent from "@/event/events/thread-deleted.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { deleted } from "../drafts";
import { threadFields } from "./thread-fields";
import ThreadKind from "./thread-kind";

export default class ThreadDeleteKind extends ThreadKind<ThreadDeletedEvent> {
  public readonly id: string = "thread_delete";
  public readonly label: string = "Thread deleted";
  public readonly eventClass: EventClass<ThreadDeletedEvent> = ThreadDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ThreadDelete];

  public draft({ thread }: ThreadDeletedEvent): GuildAuditDraft | null {
    return deleted(thread.guild, thread.id, threadFields(thread));
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}
