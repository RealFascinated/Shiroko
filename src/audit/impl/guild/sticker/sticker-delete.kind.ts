import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent, type Sticker } from "discord.js";
import StickerDeletedEvent from "@/event/events/sticker-deleted.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { deleted } from "../drafts";
import IdKind from "../id-kind";
import { stickerFields } from "./sticker-fields";

export default class StickerDeleteKind extends IdKind<StickerDeletedEvent> {
  public readonly id: string = "sticker_delete";
  public readonly label: string = "Sticker deleted";
  public readonly eventClass: EventClass<StickerDeletedEvent> = StickerDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.StickerDelete];

  public draft(event: StickerDeletedEvent): GuildAuditDraft | null {
    return deleted(event.guildData, event.stickerId, stickerFields(event.sticker));
  }
}
