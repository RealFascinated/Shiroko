import { FeatureIds } from "@/feature/feature-ids";
import type { Guild, Invite } from "discord.js";
import Event from "../event";

/**
 * An invite code was deleted in a guild. Wraps the raw `Invite`; the
 * carrying `guild` is the fully resolved {@link Guild} (the invite's own
 * `guild` is only a partial `InviteGuild`), or `null` when the guild is
 * not cached.
 */
export default class InviteDeletedEvent extends Event {
  public readonly invite: Invite;

  constructor(invite: Invite, guild: Guild | null) {
    super({
      guild,
      featureId: FeatureIds.Invites,
    });
    this.invite = invite;
  }
}
