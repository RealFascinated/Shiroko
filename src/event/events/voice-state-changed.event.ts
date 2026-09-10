import type { VoiceState } from "discord.js";
import type GlobalUser from "../../user/global-user";
import Event from "../event";

/**
 * A member's voice state changed (join, leave, move, mute, ...). Wraps the
 * raw old/new states plus the affected user id and guild.
 */
export default class VoiceStateChangedEvent extends Event {
  public readonly oldState: VoiceState | null;
  public readonly newState: VoiceState;

  constructor(oldState: VoiceState | null, newState: VoiceState, globalUser: GlobalUser | null = null) {
    const guild = newState.guild ?? null;
    super({
      guild,
      userId: newState.id,
      globalUser,
    });
    this.oldState = oldState;
    this.newState = newState;
  }
}
