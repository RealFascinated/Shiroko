import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent } from "discord.js";
import EmojiCreatedEvent from "@/event/events/emoji-created.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { created } from "../drafts";
import { emojiFields } from "./emoji-fields";
import IdKind from "../id-kind";

export default class EmojiCreateKind extends IdKind<EmojiCreatedEvent> {
  public readonly id: string = "emoji_create";
  public readonly label: string = "Emoji created";
  public readonly eventClass: EventClass<EmojiCreatedEvent> = EmojiCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.EmojiCreate];

  public draft(event: EmojiCreatedEvent): GuildAuditDraft | null {
    return created(event.guildData, event.emojiId, emojiFields(event.emoji));
  }
}
