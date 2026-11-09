import { AuditLogEvent } from "discord.js";
import EmojiDeletedEvent from "@/event/events/emoji-deleted.event";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { deleted } from "../drafts";
import { emojiFields } from "./emoji-fields";
import IdKind from "../id-kind";

export default class EmojiDeleteKind extends IdKind<EmojiDeletedEvent> {
  public readonly id: string = "emoji_delete";
  public readonly label: string = "Emoji deleted";
  public readonly eventClass: new (...args: any[]) => EmojiDeletedEvent = EmojiDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.EmojiDelete];

  public draft(event: EmojiDeletedEvent): GuildHistoryDraft | null {
    return deleted(event.guildData, event.emojiId, emojiFields(event.emoji));
  }
}
