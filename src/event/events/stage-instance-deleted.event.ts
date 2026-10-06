import type { StageInstance } from "discord.js";
import Event from "../event";

/** A stage instance ended. */
export default class StageInstanceDeletedEvent extends Event {
  public readonly instance: StageInstance;

  constructor(instance: StageInstance) {
    super({ guild: instance.guild });
    this.instance = instance;
  }
}
