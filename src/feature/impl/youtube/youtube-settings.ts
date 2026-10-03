import { FeatureIds } from "@/feature/feature-ids";
import SettingsModule from "@/settings/settings-module";

export interface YoutubeSettingsData {
  message: string;
}

const DEFAULT_YOUTUBE_MESSAGE = "{channel_name} has uploaded! {video_link}";

/**
 * The YouTube feature's settings, exposed through the generic settings
 * system. The template is per guild, so two guilds tracking the same
 * channel announce it in their own words.
 */
export const youtubeSettings = new SettingsModule<YoutubeSettingsData>({
  id: "youtube",
  displayName: "YouTube",
  featureId: FeatureIds.Youtube,
  defaults: { message: DEFAULT_YOUTUBE_MESSAGE },
  descriptors: [
    {
      key: "message",
      label: "Announcement message",
      description:
        "Sent when a tracked channel uploads. Supports {channel_name}, {video_title} and {video_link}.",
      type: "string",
      default: DEFAULT_YOUTUBE_MESSAGE,
    },
  ],
});
