import type { AutoModerationRule } from "discord.js";
import Event from "../event";

/** An AutoMod rule was deleted. */
export default class AutoModRuleDeletedEvent extends Event {
  public readonly rule: AutoModerationRule;

  constructor(rule: AutoModerationRule) {
    super({ guild: rule.guild });
    this.rule = rule;
  }
}
