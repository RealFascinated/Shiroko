import InviteCreatedEvent from "@/event/events/invite-created.event";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { created } from "../drafts";
import IdKind from "../id-kind";

export default class InviteCreateKind extends IdKind<InviteCreatedEvent> {
  public readonly id: string = "invite_create";
  public readonly label: string = "Invite created";
  public readonly eventClass: new (...args: any[]) => InviteCreatedEvent = InviteCreatedEvent;

  public draft({ guild, invite }: InviteCreatedEvent): GuildHistoryDraft | null {
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
