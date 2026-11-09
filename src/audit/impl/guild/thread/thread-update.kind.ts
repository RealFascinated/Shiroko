import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent } from "discord.js";
import ThreadUpdatedEvent from "@/event/events/thread-updated.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { updated } from "../drafts";
import { threadFields } from "./thread-fields";
import ThreadKind from "./thread-kind";

export default class ThreadUpdateKind extends ThreadKind<ThreadUpdatedEvent> {
  public readonly id: string = "thread_update";
  public readonly label: string = "Thread updated";
  public readonly eventClass: EventClass<ThreadUpdatedEvent> = ThreadUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ThreadUpdate];

  public draft({ oldThread, newThread }: ThreadUpdatedEvent): GuildAuditDraft | null {
    return updated(newThread.guild, newThread.id, threadFields(oldThread), threadFields(newThread));
  }
}
