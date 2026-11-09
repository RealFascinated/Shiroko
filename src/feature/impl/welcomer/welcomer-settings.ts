import { Constants } from "@/constants";
import { FeatureIds } from "@/feature/feature-ids";
import SettingsModule from "@/settings/settings-module";

export type WelcomerMode = "embed" | "simple" | "card";

export interface WelcomerSettingsData {
  channelId: string | null;
  mode: WelcomerMode;
  /** The embed's title, used in embed mode. */
  title: string;
  /** The embed's body, used in embed mode. */
  description: string;
  /** The plain message body, used in simple mode. */
  simpleDescription: string;
  /** The card's three text lines, above, as, and below the headline, used in card mode. */
  cardLine1: string;
  cardLine2: string;
  cardLine3: string;
  /** Embed or card accent colour; unused in simple mode. */
  color: number;
  ping: boolean;
}

/**
 * The welcomer's settings, exposed through the generic settings system
 * exactly like every other feature's. The module is deliberately NOT
 * registered with `SettingsManager`: registration is what makes a module
 * appear in `/settings`, and the welcomer renders its own panel instead.
 * `get`/`set` work regardless, so the storage path is the shared one.
 */
export const welcomerSettings = new SettingsModule<WelcomerSettingsData>({
  id: "welcomer",
  displayName: "Welcomer",
  featureId: FeatureIds.Welcomer,
  defaults: {
    channelId: null,
    mode: "embed",
    title: "Welcome!",
    description: "Welcome to **{guild_name}**, {user_mention}! You are member **#{member_count}**.",
    simpleDescription: "Welcome to **{guild_name}**, {user_mention}!",
    cardLine1: "WELCOME",
    cardLine2: "{user_name}",
    cardLine3: "Member #{member_count} of {guild_name}",
    color: Constants.mainColor,
    ping: true,
  },
  descriptors: [
    {
      key: "channelId",
      label: "Channel",
      description: "Where the message is sent; a null clears it.",
      type: "channel",
      default: null,
    },
    {
      key: "mode",
      label: "Format",
      type: "choice",
      default: "embed",
      choices: { embed: "Embed", simple: "Simple", card: "Card" },
    },
    { key: "title", label: "Title", type: "string", default: "Welcome!" },
    {
      key: "description",
      label: "Description",
      type: "string",
      default: "Welcome to **{guild_name}**, {user_mention}! You are member **#{member_count}**.",
    },
    {
      key: "simpleDescription",
      label: "Simple description",
      type: "string",
      default: "Welcome to **{guild_name}**, {user_mention}!",
    },
    { key: "cardLine1", label: "Card line 1", type: "string", default: "WELCOME" },
    { key: "cardLine2", label: "Card line 2", type: "string", default: "{user_name}" },
    {
      key: "cardLine3",
      label: "Card line 3",
      type: "string",
      default: "Member #{member_count} of {guild_name}",
    },
    { key: "color", label: "Color", type: "number", default: Constants.mainColor },
    { key: "ping", label: "Ping member", type: "boolean", default: true },
  ],
});
