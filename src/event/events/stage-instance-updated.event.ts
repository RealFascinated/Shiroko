import type { StageInstance } from "discord.js";
import Event from "../event";

/** A live stage instance's topic or privacy level changed. */
export default class StageInstanceUpdatedEvent extends Event {
  public readonly oldInstance: StageInstance;
  public readonly newInstance: StageInstance;

  constructor(oldInstance: StageInstance, newInstance: StageInstance) {
    super({ guild: newInstance.guild });
    this.oldInstance = oldInstance;
    this.newInstance = newInstance;
  }
}
