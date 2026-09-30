import { discordTimestamp } from "@/lib/time";
import { definePlaceholder, type Placeholder, type PlaceholderContext } from "../placeholder";

/**
 * Placeholders that need only the global user, so they work in every
 * context including DMs.
 */
const globalUserPlaceholders: ReadonlyArray<Placeholder<PlaceholderContext>> = [
  definePlaceholder({
    key: "user_id",
    description: "The user's ID.",
    resolve: context => context.globalUser.id,
  }),
  definePlaceholder({
    key: "user_name",
    description: "The user's display name, falling back to their username.",
    resolve: context => context.globalUser.discordUser.displayName,
  }),
  definePlaceholder({
    key: "user_username",
    description: "The user's username, without a discriminator.",
    resolve: context => context.globalUser.discordUser.username,
  }),
  definePlaceholder({
    key: "user_mention",
    description: "A mention that pings the user.",
    resolve: context => `<@${context.globalUser.id}>`,
  }),
  definePlaceholder({
    key: "user_first_seen",
    description: "The date the user was first seen by the bot.",
    resolve: context => discordTimestamp(context.globalUser.firstSeen, "D"),
  }),
];

export default globalUserPlaceholders;
