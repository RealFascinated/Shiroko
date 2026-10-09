import {
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildMFALevel,
  GuildPremiumTier,
  GuildVerificationLevel,
  type Guild,
} from "discord.js";
import { changeLine, channelMention, enumLabel, formatSystemChannelFlags, userMention } from "./text";

const VERIFICATION_LEVEL_NAMES: Record<number, string> = {
  [GuildVerificationLevel.None]: "None",
  [GuildVerificationLevel.Low]: "Low",
  [GuildVerificationLevel.Medium]: "Medium",
  [GuildVerificationLevel.High]: "High",
  [GuildVerificationLevel.VeryHigh]: "Very High",
};

export const PREMIUM_TIER_NAMES: Record<number, string> = {
  [GuildPremiumTier.None]: "None",
  [GuildPremiumTier.Tier1]: "Tier 1",
  [GuildPremiumTier.Tier2]: "Tier 2",
  [GuildPremiumTier.Tier3]: "Tier 3",
};

const NOTIFICATION_NAMES: Record<number, string> = {
  [GuildDefaultMessageNotifications.AllMessages]: "All Messages",
  [GuildDefaultMessageNotifications.OnlyMentions]: "Only Mentions",
};

const CONTENT_FILTER_NAMES: Record<number, string> = {
  [GuildExplicitContentFilter.Disabled]: "Disabled",
  [GuildExplicitContentFilter.MembersWithoutRoles]: "Members Without Roles",
  [GuildExplicitContentFilter.AllMembers]: "All Members",
};

const MFA_LEVEL_NAMES: Record<number, string> = {
  [GuildMFALevel.None]: "None",
  [GuildMFALevel.Elevated]: "Elevated",
};

/**
 * A locale code as its own language name, falling back to the raw code when
 * the runtime does not recognize it.
 */
function formatLocale(locale: string): string {
  const [language] = locale.split("-");
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(language ?? locale) ?? locale;
  } catch {
    return locale;
  }
}

function formatVanity(code: string | null): string {
  return code ? `https://discord.gg/${code}` : "None";
}

function assetUrl(url: string | null): string {
  return url ?? "None";
}

/**
 * The fields of a guild update that changed, as ready-to-print lines. Asset
 * fields compare their hashes and render as links; a removed asset shows
 * "None".
 */
export function describeGuildChanges(oldGuild: Guild, newGuild: Guild): string[] {
  const lines: string[] = [];
  if (oldGuild.name !== newGuild.name) {
    lines.push(changeLine("Name", oldGuild.name, newGuild.name));
  }
  if (oldGuild.icon !== newGuild.icon) {
    lines.push(
      changeLine(
        "Icon",
        assetUrl(oldGuild.iconURL({ extension: "webp" })),
        assetUrl(newGuild.iconURL({ extension: "webp" }))
      )
    );
  }
  if (oldGuild.banner !== newGuild.banner) {
    lines.push(
      changeLine(
        "Banner",
        assetUrl(oldGuild.bannerURL({ extension: "webp" })),
        assetUrl(newGuild.bannerURL({ extension: "webp" }))
      )
    );
  }
  if (oldGuild.splash !== newGuild.splash) {
    lines.push(
      changeLine(
        "Invite Splash",
        assetUrl(oldGuild.splashURL({ extension: "webp" })),
        assetUrl(newGuild.splashURL({ extension: "webp" }))
      )
    );
  }
  if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
    lines.push(
      changeLine(
        "Verification Level",
        enumLabel(VERIFICATION_LEVEL_NAMES, oldGuild.verificationLevel),
        enumLabel(VERIFICATION_LEVEL_NAMES, newGuild.verificationLevel)
      )
    );
  }
  if (oldGuild.premiumTier !== newGuild.premiumTier) {
    lines.push(
      changeLine(
        "Premium Tier",
        enumLabel(PREMIUM_TIER_NAMES, oldGuild.premiumTier),
        enumLabel(PREMIUM_TIER_NAMES, newGuild.premiumTier)
      )
    );
  }
  if (oldGuild.ownerId !== newGuild.ownerId) {
    lines.push(changeLine("Owner", userMention(oldGuild.ownerId), userMention(newGuild.ownerId)));
  }
  if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
    lines.push(
      changeLine(
        "System Channel",
        channelMention(oldGuild.systemChannelId),
        channelMention(newGuild.systemChannelId)
      )
    );
  }
  if (oldGuild.systemChannelFlags.bitfield !== newGuild.systemChannelFlags.bitfield) {
    lines.push(
      changeLine(
        "System Channel Notifications Suppressed",
        formatSystemChannelFlags(oldGuild.systemChannelFlags),
        formatSystemChannelFlags(newGuild.systemChannelFlags)
      )
    );
  }
  if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) {
    lines.push(
      changeLine(
        "Rules Channel",
        channelMention(oldGuild.rulesChannelId),
        channelMention(newGuild.rulesChannelId)
      )
    );
  }
  if (oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId) {
    lines.push(
      changeLine(
        "Public Updates Channel",
        channelMention(oldGuild.publicUpdatesChannelId),
        channelMention(newGuild.publicUpdatesChannelId)
      )
    );
  }
  if (oldGuild.safetyAlertsChannelId !== newGuild.safetyAlertsChannelId) {
    lines.push(
      changeLine(
        "Safety Alerts Channel",
        channelMention(oldGuild.safetyAlertsChannelId),
        channelMention(newGuild.safetyAlertsChannelId)
      )
    );
  }
  if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
    lines.push(
      changeLine("AFK Channel", channelMention(oldGuild.afkChannelId), channelMention(newGuild.afkChannelId))
    );
  }
  if (oldGuild.afkTimeout !== newGuild.afkTimeout) {
    lines.push(changeLine("AFK Timeout", `${oldGuild.afkTimeout}s`, `${newGuild.afkTimeout}s`));
  }
  if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) {
    lines.push(
      changeLine(
        "Default Notifications",
        enumLabel(NOTIFICATION_NAMES, oldGuild.defaultMessageNotifications),
        enumLabel(NOTIFICATION_NAMES, newGuild.defaultMessageNotifications)
      )
    );
  }
  if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
    lines.push(
      changeLine(
        "Explicit Content Filter",
        enumLabel(CONTENT_FILTER_NAMES, oldGuild.explicitContentFilter),
        enumLabel(CONTENT_FILTER_NAMES, newGuild.explicitContentFilter)
      )
    );
  }
  if (oldGuild.mfaLevel !== newGuild.mfaLevel) {
    lines.push(
      changeLine(
        "MFA Level",
        enumLabel(MFA_LEVEL_NAMES, oldGuild.mfaLevel),
        enumLabel(MFA_LEVEL_NAMES, newGuild.mfaLevel)
      )
    );
  }
  if (oldGuild.preferredLocale !== newGuild.preferredLocale) {
    lines.push(
      changeLine(
        "Preferred Locale",
        formatLocale(oldGuild.preferredLocale),
        formatLocale(newGuild.preferredLocale)
      )
    );
  }
  if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
    lines.push(
      changeLine("Vanity URL", formatVanity(oldGuild.vanityURLCode), formatVanity(newGuild.vanityURLCode))
    );
  }
  return lines;
}
