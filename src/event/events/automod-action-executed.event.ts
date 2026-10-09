import type { AutoModerationActionExecution } from "discord.js";
import Event from "../event";

export default class AutoModActionExecutedEvent extends Event {
  public readonly execution: AutoModerationActionExecution;

  constructor(execution: AutoModerationActionExecution) {
    super({
      guild: execution.guild,
      userId: execution.userId,
    });
    this.execution = execution;
  }
}
