import type { AutoModerationRule } from "discord.js";
import Event from "../event";

/** An AutoMod rule was created. */
export default class AutoModRuleCreatedEvent extends Event {
  public readonly rule: AutoModerationRule;

  constructor(rule: AutoModerationRule) {
    super({ guild: rule.guild });
    this.rule = rule;
  }
}
