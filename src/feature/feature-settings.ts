import { mapKeys } from "@/lib/utils";
import { booleanFields } from "@/settings/descriptors";
import SettingsModule from "@/settings/settings-module";
import { allFeatureMetadata } from "./feature-metadata";
import type { FeatureId } from "./feature-ids";

export interface FeatureSettingsData {
  enabled: Record<FeatureId, boolean>;
}

let instance: SettingsModule<FeatureSettingsData> | undefined;

/**
 * The per-guild feature toggles, replacing the `guild_features` table.
 * Built lazily so every feature's metadata and `defaultEnabled` are known
 * before the module is constructed.
 */
export function featureSettings(): SettingsModule<FeatureSettingsData> {
  if (instance) {
    return instance;
  }
  const byId = new Map(allFeatureMetadata().map(feature => [`${feature.id}` as FeatureId, feature] as const));
  const ids = [...byId.keys()];
  const labels = mapKeys(ids, id => byId.get(id)?.name ?? id);
  const defaults = mapKeys(ids, id => byId.get(id)?.defaultEnabled ?? true);
  instance = new SettingsModule<FeatureSettingsData>({
    id: "features",
    displayName: "Features",
    featureId: null,
    defaults: { enabled: defaults },
    descriptors: [
      {
        key: "enabled",
        label: "Features",
        type: "group",
        default: defaults,
        fields: booleanFields(labels, defaults),
      },
    ],
  });
  return instance;
}
