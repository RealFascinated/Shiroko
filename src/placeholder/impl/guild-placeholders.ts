import { discordTimestamp } from "@/lib/time";
import { definePlaceholder, type GuildPlaceholderContext, type Placeholder } from "../placeholder";

/**
 * Placeholders that read the guild in scope. `{channel_count}` counts
 * cached channels only (the bot keeps the channel cache at depth 0), and
 * `{member_count}` is Guild's cached count, updated on member events.
 */
const guildPlaceholders: ReadonlyArray<Placeholder<GuildPlaceholderContext>> = [
  definePlaceholder({
    key: "guild_name",
    description: "The guild's name.",
    resolve: context => context.guild.name,
  }),
  definePlaceholder({
    key: "guild_id",
    description: "The guild's ID.",
    resolve: context => context.guild.id,
  }),
  definePlaceholder({
    key: "guild_icon",
    description: "A URL to the guild's icon, or empty when it has none.",
    resolve: context => context.guild.iconURL() ?? "",
  }),
  definePlaceholder({
    key: "guild_owner_mention",
    description: "A mention that pings the guild owner.",
    resolve: context => `<@${context.guild.ownerId}>`,
  }),
  definePlaceholder({
    key: "guild_created_at",
    description: "The date the guild was created.",
    resolve: context => discordTimestamp(context.guild.createdAt, "D"),
  }),
  definePlaceholder({
    key: "member_count",
    description: "The guild's member count, including bots.",
    resolve: context => context.guild.memberCount,
  }),
  definePlaceholder({
    key: "channel_count",
    description: "The number of channels the bot can see, excluding threads.",
    resolve: context => context.guild.channels.cache.filter(channel => !channel.isThread()).size,
  }),
  definePlaceholder({
    key: "role_count",
    description: "The number of roles in the guild.",
    resolve: context => context.guild.roles.cache.size,
  }),
  definePlaceholder({
    key: "boost_count",
    description: "The number of boosts the guild currently has.",
    resolve: context => context.guild.premiumSubscriptionCount ?? 0,
  }),
  definePlaceholder({
    key: "boost_tier",
    description: "The guild's boost tier.",
    resolve: context => context.guild.premiumTier,
  }),
];

export default guildPlaceholders;
