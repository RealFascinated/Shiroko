import globalUserPlaceholders from "./impl/global-user-placeholders";
import guildPlaceholders from "./impl/guild-placeholders";
import type { GuildPlaceholderContext, PlaceholderContext } from "./placeholder";
import PlaceholderExecutor from "./placeholder-executor";

/** For DMs and user-install contexts: no guild, user-scoped tokens only. */
export const userPlaceholders = new PlaceholderExecutor<PlaceholderContext>(globalUserPlaceholders);

/** For guild contexts: user tokens plus every guild-scoped token. */
export const placeholders = new PlaceholderExecutor<GuildPlaceholderContext>([
  ...globalUserPlaceholders,
  ...guildPlaceholders,
]);
