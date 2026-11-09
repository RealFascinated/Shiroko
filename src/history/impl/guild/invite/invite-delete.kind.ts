import InviteDeletedEvent from "@/event/events/invite-deleted.event";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { deleted } from "../drafts";
import IdKind from "../id-kind";

export default class InviteDeleteKind extends IdKind<InviteDeletedEvent> {
  public readonly id: string = "invite_delete";
  public readonly label: string = "Invite deleted";
  public readonly eventClass: new (...args: any[]) => InviteDeletedEvent = InviteDeletedEvent;

  public draft({ guild, invite }: InviteDeletedEvent): GuildHistoryDraft | null {
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
