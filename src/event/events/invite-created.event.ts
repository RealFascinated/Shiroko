import type { Invite } from "discord.js";
import { FeatureIds } from "../../feature/feature-ids";
import Event from "../event";

/**
 * An invite code was created in a guild. Wraps the raw `Invite`. The
 * `InviteGuild` payload is partial (no full Guild), so `guild` may be
 * null but `guildId` is always present.
 */
export default class InviteCreatedEvent extends Event {
  public readonly invite: Invite;

  constructor(invite: Invite) {
    super({
      guild: invite.guild ? (invite.guild as never) : null,
      featureId: FeatureIds.Invites,
    });
    this.invite = invite;
  }
}
