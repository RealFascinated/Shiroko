import { FeatureIds } from "@/feature/feature-ids";
import SettingsModule from "@/settings/settings-module";

export interface BirthdaySettingsData {
  roleId: string | null;
  announceChannelId: string | null;
}

/**
 * The birthday feature's settings, exposed through the generic settings
 * system. Both are optional: with neither set the feature does nothing.
 */
export const birthdaySettings = new SettingsModule<BirthdaySettingsData>({
  id: "birthday",
  displayName: "Birthdays",
  featureId: FeatureIds.Birthday,
  defaults: { roleId: null, announceChannelId: null },
  descriptors: [
    { key: "roleId", label: "Birthday role", type: "role", default: null },
    { key: "announceChannelId", label: "Announce channel", type: "channel", default: null },
  ],
});
