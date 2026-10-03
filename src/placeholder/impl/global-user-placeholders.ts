import { definePlaceholder, type GlobalUserPlaceholderContext, type Placeholder } from "../placeholder";

/**
 * Placeholders that need only the global user, so they work in every
 * context that has one, including DMs.
 */
const globalUserPlaceholders: ReadonlyArray<Placeholder<GlobalUserPlaceholderContext>> = [
  definePlaceholder({
    key: "user_id",
    description: "The user's ID.",
    resolve: context => context.globalUser.id,
  }),
  definePlaceholder({
    key: "user_name",
    description: "The user's display name.",
    resolve: context => context.globalUser.discordUser.displayName,
  }),
  definePlaceholder({
    key: "user_username",
    description: "The user's username or tag.",
    resolve: context => context.globalUser.discordUser.tag,
  }),
  definePlaceholder({
    key: "user_mention",
    description: "A mention that pings the user.",
    resolve: context => `<@${context.globalUser.id}>`,
  }),
];

export default globalUserPlaceholders;
