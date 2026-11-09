import type { EventClass } from "@/audit/audit-kind";
import InviteCreatedEvent from "@/event/events/invite-created.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { created } from "../drafts";
import IdKind from "../id-kind";

export default class InviteCreateKind extends IdKind<InviteCreatedEvent> {
  public readonly id: string = "invite_create";
  public readonly label: string = "Invite created";
  public readonly eventClass: EventClass<InviteCreatedEvent> = InviteCreatedEvent;

  public draft({ guild, invite }: InviteCreatedEvent): GuildAuditDraft | null {
    return (
      guild && {
        guild,
        subjectId: invite.code,
        oldValue: null,
        newValue: {
          channelId: invite.channelId,
          inviterId: invite.inviter?.id ?? null,
          maxUses: invite.maxUses,
          maxAgeSeconds: invite.maxAge,
        },
      }
    );
  }
}
