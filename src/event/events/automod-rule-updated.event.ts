import type { AutoModerationRule } from "discord.js";
import Event from "../event";

/** An AutoMod rule's trigger, actions, exemptions, or enabled state changed. */
export default class AutoModRuleUpdatedEvent extends Event {
  public readonly oldRule: AutoModerationRule;
  public readonly newRule: AutoModerationRule;

  constructor(oldRule: AutoModerationRule, newRule: AutoModerationRule) {
    super({ guild: newRule.guild });
    this.oldRule = oldRule;
    this.newRule = newRule;
  }
}
