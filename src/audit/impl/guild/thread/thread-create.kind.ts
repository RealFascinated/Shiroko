import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent } from "discord.js";
import ThreadCreatedEvent from "@/event/events/thread-created.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { created } from "../drafts";
import { threadFields } from "./thread-fields";
import ThreadKind from "./thread-kind";

export default class ThreadCreateKind extends ThreadKind<ThreadCreatedEvent> {
  public readonly id: string = "thread_create";
  public readonly label: string = "Thread created";
  public readonly eventClass: EventClass<ThreadCreatedEvent> = ThreadCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ThreadCreate];

  public draft({ thread }: ThreadCreatedEvent): GuildAuditDraft | null {
    return created(thread.guild, thread.id, threadFields(thread));
  }
}
