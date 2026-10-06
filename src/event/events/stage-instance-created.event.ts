import type { StageInstance } from "discord.js";
import Event from "../event";

/** A stage instance was started in a stage channel. */
export default class StageInstanceCreatedEvent extends Event {
  public readonly instance: StageInstance;

  constructor(instance: StageInstance) {
    super({ guild: instance.guild });
    this.instance = instance;
  }
}
