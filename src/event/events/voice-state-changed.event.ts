import type GlobalUser from "@/user/global-user";
import type { VoiceState } from "discord.js";
import Event from "../event";

/**
 * Covers every voice transition (join, leave, move, mute, ...); consumers
 * diff the raw states to tell which. `oldState` is null when the previous
 * state was not cached (e.g. an uncached join).
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
