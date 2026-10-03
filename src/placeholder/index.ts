import globalUserPlaceholders from "./impl/global-user-placeholders";
import guildPlaceholders from "./impl/guild-placeholders";
import type { GlobalUserPlaceholderContext, GuildPlaceholderContext } from "./placeholder";
import PlaceholderExecutor from "./placeholder-executor";

/** For DMs and user-install contexts: no guild, user-scoped tokens only. */
export const userPlaceholders = new PlaceholderExecutor<GlobalUserPlaceholderContext>(globalUserPlaceholders);

/**
 * For guild contexts: user tokens plus every guild-scoped token. The context
 * requires both the member and the guild, since it holds both registries.
 */
export const placeholders = new PlaceholderExecutor<GlobalUserPlaceholderContext & GuildPlaceholderContext>([
  ...globalUserPlaceholders,
  ...guildPlaceholders,
]);
