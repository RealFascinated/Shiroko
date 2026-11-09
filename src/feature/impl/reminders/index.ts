import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import ReminderCommand from "./command/reminder/reminder.command";

/**
 * `toggleable: false` because reminders are global rather than a guild
 * feature: `GuildFeatures.isFeatureEnabled` short-circuits to `true` for a
 * non-toggleable feature, so no stored row can disable them and they never
 * appear in `/feature`.
 */
export default class RemindersFeature extends Feature {
  constructor() {
    super(FeatureIds.Reminders, { toggleable: false, name: "Reminders", emoji: "⏰" });
    this.registerCommand(new ReminderCommand());
  }
}
