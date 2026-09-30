import type GlobalUser from "@/user/global-user";
import type { Guild } from "discord.js";

/**
 * The data every placeholder resolves against. `globalUser` is always
 * present; `guild` is present only when a guild is in scope. Guild-scoped
 * placeholders narrow this via {@link GuildPlaceholderContext}.
 *
 * `guild` is optional (`Guild | undefined`) so `GuildPlaceholderContext`
 * stays a subtype: that relation is what makes a guild-agnostic
 * placeholder assignable to a guild-scoped registry.
 */
export interface PlaceholderContext {
  readonly globalUser: GlobalUser;
  readonly guild?: Guild | undefined;
}

/**
 * The context of a guild-scoped replacement: {@link PlaceholderContext}
 * with `guild` required and non-null.
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
 * Under `strictFunctionTypes` that makes it contravariant in `C`, so a
 * guild-agnostic placeholder (`Placeholder<PlaceholderContext>`) is
 * assignable to a guild-scoped registry
 * (`PlaceholderExecutor<GuildPlaceholderContext>`), while a guild-scoped
 * placeholder is a compile error in a guild-less registry. Declaring it as
 * a method would make the check bivariant and lose both guarantees.
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
