import type { EventClass } from "@/audit/audit-kind";
import InviteDeletedEvent from "@/event/events/invite-deleted.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { deleted } from "../drafts";
import IdKind from "../id-kind";

export default class InviteDeleteKind extends IdKind<InviteDeletedEvent> {
  public readonly id: string = "invite_delete";
  public readonly label: string = "Invite deleted";
  public readonly eventClass: EventClass<InviteDeletedEvent> = InviteDeletedEvent;

  public draft({ guild, invite }: InviteDeletedEvent): GuildAuditDraft | null {
    return (
      guild && {
        guild,
        subjectId: invite.code,
        oldValue: { channelId: invite.channelId, inviterId: invite.inviter?.id ?? null },
        newValue: null,
      }
    );
  }
}
