import { AuditLogEvent, type Sticker } from "discord.js";
import StickerCreatedEvent from "@/event/events/sticker-created.event";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { created } from "../drafts";
import IdKind from "../id-kind";
import { stickerFields } from "./sticker-fields";

export default class StickerCreateKind extends IdKind<StickerCreatedEvent> {
  public readonly id: string = "sticker_create";
  public readonly label: string = "Sticker created";
  public readonly eventClass: new (...args: any[]) => StickerCreatedEvent = StickerCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.StickerCreate];

  public draft(event: StickerCreatedEvent): GuildHistoryDraft | null {
    return created(event.guildData, event.stickerId, stickerFields(event.sticker));
  }
}
