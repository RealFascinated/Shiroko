import { FeatureIds } from "@/feature/feature-ids";
import SettingsModule from "@/settings/settings-module";

export interface AutorolesSettingsData {
  roleIds: string[];
}

/**
 * The autoroles feature's settings: the roles granted on join, under the
 * `autoroles.` key namespace in `guild_settings` instead of the
 * `autoroles` table.
 */
export const autorolesSettings = new SettingsModule<AutorolesSettingsData>({
  id: "autoroles",
  displayName: "Autoroles",
  featureId: FeatureIds.Autoroles,
  defaults: { roleIds: [] },
  descriptors: [
    {
      key: "roleIds",
      label: "Autoroles",
      description: "Roles granted when a member joins.",
      type: "role-list",
      default: [],
      max: 25,
      format: ids => ids.map(id => `<@&${id}>`).join(", ") || "None",
    },
  ],
});
