import { FeatureIds } from "@/feature/feature-ids";
import { mapRecord } from "@/lib/utils";
import { booleanFields } from "@/settings/descriptors";
import SettingsModule from "@/settings/settings-module";
import { logTypes, type LogType } from "./log-type";

export interface LoggingSettingsData {
  channelId: string | null;
  enabled: Record<LogType, boolean>;
}

const LOG_LABELS = mapRecord(logTypes, (_logType, meta) => meta.label);
const LOG_DEFAULTS = mapRecord(logTypes, () => true);

/**
 * The logging feature's settings. The channel and every log type's enabled
 * state live under the `logging.` key namespace in `guild_settings`,
 * replacing the `logging` table.
 */
export const loggingSettings = new SettingsModule<LoggingSettingsData>({
  id: "logging",
  displayName: "Logging",
  featureId: FeatureIds.Logging,
  defaults: { channelId: null, enabled: LOG_DEFAULTS },
  descriptors: [
    { key: "channelId", label: "Log channel", type: "channel", default: null },
    {
      key: "enabled",
      label: "Log types",
      type: "group",
      default: LOG_DEFAULTS,
      fields: booleanFields(LOG_LABELS, LOG_DEFAULTS),
    },
  ],
});
