import type { StageInstance } from "discord.js";
import Event from "../event";

export default class StageInstanceCreatedEvent extends Event {
  public readonly instance: StageInstance;

  constructor(instance: StageInstance) {
    super({ guild: instance.guild });
    this.instance = instance;
  }
}
