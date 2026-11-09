import { AuditLogEvent, type Sticker } from "discord.js";
import StickerUpdatedEvent from "@/event/events/sticker-updated.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { updated } from "../drafts";
import IdKind from "../id-kind";
import { stickerFields } from "./sticker-fields";

export default class StickerUpdateKind extends IdKind<StickerUpdatedEvent> {
  public readonly id: string = "sticker_update";
  public readonly label: string = "Sticker updated";
  public readonly eventClass: new (...args: any[]) => StickerUpdatedEvent = StickerUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.StickerUpdate];

  public draft(event: StickerUpdatedEvent): GuildAuditDraft | null {
    return updated(
      event.guildData,
      event.stickerId,
      stickerFields(event.oldSticker),
      stickerFields(event.newSticker)
    );
  }
}
