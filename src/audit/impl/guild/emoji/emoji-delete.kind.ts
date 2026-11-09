import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent } from "discord.js";
import EmojiDeletedEvent from "@/event/events/emoji-deleted.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { deleted } from "../drafts";
import { emojiFields } from "./emoji-fields";
import IdKind from "../id-kind";

export default class EmojiDeleteKind extends IdKind<EmojiDeletedEvent> {
  public readonly id: string = "emoji_delete";
  public readonly label: string = "Emoji deleted";
  public readonly eventClass: EventClass<EmojiDeletedEvent> = EmojiDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.EmojiDelete];

  public draft(event: EmojiDeletedEvent): GuildAuditDraft | null {
    return deleted(event.guildData, event.emojiId, emojiFields(event.emoji));
  }
}
