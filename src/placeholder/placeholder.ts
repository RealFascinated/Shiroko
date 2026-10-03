import type GlobalUser from "@/user/global-user";
import type { Guild } from "discord.js";

/**
 * The base every placeholder context extends. It guarantees nothing a
 * resolver may rely on: `guild` is optional because a context may be
 * guild-less.
 *
 * A feature whose tokens need neither a member nor a guild (a YouTube
 * upload announcement, say) extends this directly, so its context can carry
 * exactly what its own tokens read. Contexts that need a member or a guild
 * narrow this via {@link GlobalUserPlaceholderContext} and
 * {@link GuildPlaceholderContext}.
 */
export interface PlaceholderContext {
  readonly guild?: Guild | undefined;
}

/**
 * A context with the member a message is rendered for, resolved to their
 * stored global user. The welcomer and other member-facing messages use it.
 *
 * `guild` stays optional here so a DM context remains expressible.
 */
export interface GlobalUserPlaceholderContext extends PlaceholderContext {
  readonly globalUser: GlobalUser;
}

/**
 * A context with a guild in scope: {@link PlaceholderContext} with `guild`
 * required and non-null. A registry typed to this cannot be called without
 * a guild, which is what keeps guild tokens out of guild-less messages.
 */
export interface GuildPlaceholderContext extends PlaceholderContext {
  readonly guild: Guild;
}

/** What a placeholder renders; `null` and `undefined` render as "". */
export type PlaceholderValue = string | number | null | undefined;

/**
 * One placeholder. `C` is the context its resolver requires, which is what
 * types a registry.
 *
 * `resolve` is deliberately a **property of function type**, not a method.
 * Under `strictFunctionTypes` that makes it contravariant in `C`, which is
 * what makes a registry's context an upper bound on what its placeholders
 * may demand: a member-scoped placeholder
 * (`Placeholder<GlobalUserPlaceholderContext>`) drops into the combined
 * guild registry (`PlaceholderExecutor<GlobalUserPlaceholderContext &
 * GuildPlaceholderContext>`), while a guild-scoped placeholder is a compile
 * error in a registry whose context does not guarantee a guild. Declaring it
 * as a method would make the check bivariant and lose that guarantee.
 */
export interface Placeholder<C extends PlaceholderContext = PlaceholderContext> {
  readonly key: string;
  readonly description: string;
  readonly resolve: (context: C) => PlaceholderValue | Promise<PlaceholderValue>;
}

/**
 * Identity helper that pins a literal to `Placeholder<C>`, keeping `key`
 * a literal while checking the resolver's context parameter.
 */
export function definePlaceholder<C extends PlaceholderContext>(placeholder: Placeholder<C>): Placeholder<C> {
  return placeholder;
}
