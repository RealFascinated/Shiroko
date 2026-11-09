import { AuditLogEvent } from "discord.js";
import EmojiCreatedEvent from "@/event/events/emoji-created.event";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { created } from "../drafts";
import { emojiFields } from "./emoji-fields";
import IdKind from "../id-kind";

export default class EmojiCreateKind extends IdKind<EmojiCreatedEvent> {
  public readonly id: string = "emoji_create";
  public readonly label: string = "Emoji created";
  public readonly eventClass: new (...args: any[]) => EmojiCreatedEvent = EmojiCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.EmojiCreate];

  public draft(event: EmojiCreatedEvent): GuildHistoryDraft | null {
    return created(event.guildData, event.emojiId, emojiFields(event.emoji));
  }
}
