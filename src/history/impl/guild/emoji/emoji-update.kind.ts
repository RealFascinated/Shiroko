import { AuditLogEvent } from "discord.js";
import EmojiUpdatedEvent from "@/event/events/emoji-updated.event";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { updated } from "../drafts";
import { emojiFields } from "./emoji-fields";
import IdKind from "../id-kind";

export default class EmojiUpdateKind extends IdKind<EmojiUpdatedEvent> {
  public readonly id: string = "emoji_update";
  public readonly label: string = "Emoji updated";
  public readonly eventClass: new (...args: any[]) => EmojiUpdatedEvent = EmojiUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.EmojiUpdate];

  public draft(event: EmojiUpdatedEvent): GuildHistoryDraft | null {
    return updated(event.guildData, event.emojiId, emojiFields(event.oldEmoji), emojiFields(event.newEmoji));
  }
}
