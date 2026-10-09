import type { AutoModerationRule } from "discord.js";
import Event from "../event";

export default class AutoModRuleDeletedEvent extends Event {
  public readonly rule: AutoModerationRule;

  constructor(rule: AutoModerationRule) {
    super({ guild: rule.guild });
    this.rule = rule;
  }
}
