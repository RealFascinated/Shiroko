# Placeholder System Plan

A fully typed `{token}` placeholder system for Shiroko. User-facing strings
stored in config (welcome messages, level-up announcements, leaderboard
footers) contain tokens like `{guild_name}` and `{member_count}`. This
system resolves them against a **global user and an optional guild**, with
the type system deciding which tokens are legal for which context.

It is the string analogue of the settings system: a small generic engine
(`PlaceholderExecutor<C>`) plus declarative leaf modules, assembled once and
consumed everywhere.

## 1. Model

### Token syntax

- Grammar: `\{[a-z0-9_]+\}`. Lowercase snake case, no spaces. Anything that
  does not match (braces, punctuation, spaces) is ordinary text.
- **Unknown tokens are left verbatim.** `Hello {nope}` renders as
  `Hello {nope}`. Silently emptying a mistyped token hides the mistake; the
  raw token in the output is a visible bug report. A resolved-but-absent
  value (e.g. a missing boost count) renders as the empty string.
- Resolution is **asynchronous and ordered**: the template is scanned, every
  distinct key is resolved once (in parallel), then substituted.
- Case sensitive. `{Guild_Name}` is not `{guild_name}`.

### The context

Resolution takes a single context object with two fields:

| Field        | Presence                      | Source                        |
| ------------ | ----------------------------- | ----------------------------- |
| `globalUser` | always                        | `GlobalUsersManager.getUser`  |
| `guild`      | only when a guild is in scope | the `Guild` the message is in |

`{guild_name}` needs `guild`. `{user_name}` needs only `globalUser`. A DM or
a user-install command has no guild, so it can only resolve the second kind.
That distinction is encoded in the **context type** each placeholder
declares, not in a runtime check.

### Resolution semantics

- Every placeholder returns `string | number | null | undefined`.
  `null` and `undefined` become `""`; everything else goes through `String`.
- Durations and dates are emitted as **Discord timestamps**
  (`<t:1700000000:R>`), so Discord localises them per reader. No date
  libraries, no fixed zone.
- Counts are raw numbers; formatting (thousands separators, ordinals) is the
  template author's business, not the engine's.

### Why a context object, not two positional parameters

The requested call shape was `placeholders.replace(globalUser, guild?)`. We
fold both into one object because a placeholder's type parameter has to name
what it requires:

```ts
placeholders.replace({ globalUser, guild }, template); // guild instance
userPlaceholders.replace({ globalUser }, template); // guild-less instance
```

With two positional parameters a guild-only placeholder would have to accept
`guild: Guild | undefined` and null-check at runtime, which is exactly what
the generics are meant to remove. The context object is what makes the
"optional guild" a compile-time fact. Section 2 shows the mechanism.

### Two executors, one class

The bot exports **two instances** of the same executor class:

- `userPlaceholders` (`PlaceholderExecutor<PlaceholderContext>`): for DMs and
  user-install contexts. Holds only placeholders that need no guild.
- `placeholders` (`PlaceholderExecutor<GuildPlaceholderContext>`): for guild
  contexts. Holds the user placeholders plus every guild-scoped one, and
  `replace` refuses to be called without a guild.

This is the honest encoding of "optional guild": the option is a property of
the _registry_, not of a flag checked on every call.

## 2. Types

`src/placeholder/placeholder.ts`:

```ts
import type { Guild } from "discord.js";
import type GlobalUser from "@/user/global-user";

/**
 * The data every placeholder resolves against. `globalUser` is always
 * present; `guild` is present only when a guild is in scope. Guild-scoped
 * placeholders narrow this via {@link GuildPlaceholderContext}.
 *
 * `guild` is optional (`Guild | undefined`) rather than declared on a
 * separate branch so `GuildPlaceholderContext` stays a *subtype*: that
 * subtype relation is what makes the registry assignment in section 3
 * type-check.
 */
export interface PlaceholderContext {
  readonly globalUser: GlobalUser;
  readonly guild?: Guild | undefined;
}

/**
 * The context of a guild-scoped replace: the same shape with `guild`
 * required and non-null.
 */
export interface GuildPlaceholderContext extends PlaceholderContext {
  readonly guild: Guild;
}

/** What a placeholder renders; `null` and `undefined` render as "". */
export type PlaceholderValue = string | number | null | undefined;

/**
 * One placeholder. `C` is the context its resolver requires, which is what
 * types the registry.
 *
 * `resolve` is deliberately a **property of function type**, not a method.
 * Under `strictFunctionTypes` that makes it contravariant in `C`, so a
 * guild-agnostic placeholder (`Placeholder<PlaceholderContext>`) is
 * assignable to the narrower guild registry
 * (`Placeholder<GuildPlaceholderContext>`), while a guild-scoped
 * placeholder is a compile error in the guild-less registry. Declaring it
 * as a method would make the check bivariant and lose both guarantees.
 */
export interface Placeholder<C extends PlaceholderContext = PlaceholderContext> {
  readonly key: string;
  readonly description: string;
  readonly resolve: (context: C) => PlaceholderValue | Promise<PlaceholderValue>;
}

/**
 * Identity helper that pins a literal to `Placeholder<C>`, keeping `key`
 * as a literal and checking the resolver's context parameter.
 */
export function definePlaceholder<C extends PlaceholderContext>(placeholder: Placeholder<C>): Placeholder<C> {
  return placeholder;
}
```

### How the generics gate

Three rules fall out of the declarations above. They are worth stating
because they are the whole reason the system is typed rather than raw
methods.

1. **A placeholder declares what it needs.** `resolve: (context: C) => ...`
   means the author writes `context.guild.id` only when `C` guarantees a
   guild. No null checks, no `!`.
2. **Needs-less is assignable to needs-more.** A resolver that accepts the
   wide `PlaceholderContext` is valid anywhere a `GuildPlaceholderContext`
   is handed to it, so guild-agnostic placeholders drop into both
   registries.
3. **Needs-more is not assignable to needs-less.** A resolver that requires
   `guild: Guild` is rejected by `PlaceholderExecutor<PlaceholderContext>`
   at compile time. A `{member_count}` in a DM registry is a type error, not
   an empty string at 3am.

Because the check is on the function type, the guarantee survives
indirection: the compiler never has to see the template, only the
registries.

## 3. Executor

`src/placeholder/placeholder-executor.ts`:

```ts
import type {
  GuildPlaceholderContext,
  Placeholder,
  PlaceholderContext,
  PlaceholderValue,
} from "./placeholder";

/**
 * Resolves `{token}` placeholders in a template against a context.
 *
 * `C` is the context the executor supports. An executor built with guild
 * placeholders is `PlaceholderExecutor<GuildPlaceholderContext>`, so
 * `replace` cannot be called without a guild.
 */
export default class PlaceholderExecutor<C extends PlaceholderContext = PlaceholderContext> {
  /** `{snake_case}` tokens; anything else is left untouched. */
  private static readonly TOKEN = /\{([a-z0-9_]+)\}/g;

  private readonly byKey: ReadonlyMap<string, Placeholder<C>>;

  public constructor(placeholders: ReadonlyArray<Placeholder<C>>) {
    this.byKey = new Map(placeholders.map(placeholder => [placeholder.key, placeholder]));
  }

  /** Whether a key is registered here. */
  public has(key: string): boolean {
    return this.byKey.has(key);
  }

  /**
   * The distinct placeholder keys a template uses, in first-seen order.
   * Used to validate config input and to tell a real token from a typo.
   */
  public parse(template: string): readonly string[] {
    return [...new Set(Array.from(template.matchAll(PlaceholderExecutor.TOKEN), match => match[1]!))];
  }

  /**
   * Replace every known `{token}` in `template`. Unknown tokens are left
   * verbatim. Each distinct key resolves at most once per call, so a
   * template using `{guild_name}` twice resolves it once. Resolvers run
   * in parallel; the returned string preserves the template's token order.
   */
  public async replace(context: C, template: string): Promise<string> {
    const resolved = new Map<string, string>();
    await Promise.all(
      this.parse(template).map(async key => {
        const placeholder = this.byKey.get(key);
        if (placeholder !== undefined) {
          resolved.set(key, render(await placeholder.resolve(context)));
        }
      })
    );
    return template.replace(PlaceholderExecutor.TOKEN, (match, key: string) => resolved.get(key) ?? match);
  }
}

/** A resolved value as text; absent values render as the empty string. */
function render(value: PlaceholderValue): string {
  return value === null || value === undefined ? "" : String(value);
}
```

Notes:

- `TOKEN` is a shared `g` regex, used by both `matchAll` and `replace`.
  `matchAll` clones it and `replace` resets `lastIndex`, so reuse is safe.
- `replace` is the one method call sites touch. `parse` and `has` exist for
  config validation (section 6).
- Resolution is `Promise.all` over distinct keys, so a future template
  with two async tokens issues its two reads concurrently, not in series.

## 4. Catalog

Names are prefixed by scope: `user_` for the global user, `guild_` for the
guild. The catalog is deliberately small and static; every token resolves
synchronously today, and section 7 covers adding more.

### User-scoped (`PlaceholderContext`)

| Token               | Value                                      |
| ------------------- | ------------------------------------------ |
| `{user_id}`         | Snowflake                                  |
| `{user_name}`       | Global display name, else username         |
| `{user_username}`   | Username, or `user#tag` if they have a tag |
| `{user_mention}`    | `<@id>`                                    |
| `{user_first_seen}` | `<t:…:D>` from `globalUser.firstSeen`      |

### Guild-scoped (`GuildPlaceholderContext`)

Synchronous, straight off the discord.js object:

| Token                   | Source                                        |
| ----------------------- | --------------------------------------------- |
| `{guild_name}`          | `guild.name`                                  |
| `{guild_id}`            | `guild.id`                                    |
| `{guild_owner_mention}` | `<@ownerId>`                                  |
| `{guild_created_at}`    | `<t:…:D>` from `guild.createdAt`              |
| `{member_count}`        | `guild.memberCount` (includes bots)           |
| `{channel_count}`       | Cached non-thread channels (see caveat below) |
| `{role_count}`          | `guild.roles.cache.size`                      |
| `{boost_count}`         | `premiumSubscriptionCount ?? 0`               |
| `{boost_tier}`          | `premiumTier`                                 |

Every token above resolves synchronously. Async resolvers are still
supported: `resolve` may return a `Promise`, `replace` awaits it, and a
fetch- or query-backed token is a one-entry addition with no engine change
(section 7).

Caveats to document at each definition:

- `{channel_count}` reads the channel cache, which the bot keeps at depth 0:
  it counts channels the bot can see, not the server's true total. It is
  cheap and never hits the API; that trade-off is the reason it exists.
- `{member_count}` is Guild's own cached count, updated on
  `GUILD_CREATE`/`GUILD_MEMBER_*`. It is a good approximation, not a live
  query.

## 5. Wiring

```
src/placeholder/
  placeholder.ts                # Placeholder<C>, contexts, definePlaceholder
  placeholder-executor.ts       # PlaceholderExecutor<C>
  index.ts                      # assembly: the two executors + re-exports
  impl/
    global-user-placeholders.ts # user-scoped catalog
    guild-placeholders.ts       # guild-scoped catalog
```

The engine and types sit at the top level next to `index.ts`; the catalogs
are implementations and live under `impl/`, the same split `src/leaderboard/`
uses (`leaderboard.ts` + `impl/<board>.ts`).

`src/placeholder/index.ts`:

```ts
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
```

`index.ts` is the single assembly point, the same role `src/index.ts` plays
for listeners, but it is a registry, not a barrel: it exports the two
executors and nothing else. Adding a token is one array entry. A token that
needs feature data can live in that feature's folder (mirroring the listener
rule in `AGENTS.md`) and be spread into the guild array; none do yet.

Import discipline: `@/placeholder` is the assembly module; it pulls in both
executors and every catalog, so it is the right import for call sites that
render. Import the core types and helpers from the modules that define them
(`@/placeholder/placeholder`, `@/placeholder/placeholder-executor`), never
through `index.ts`.

## 6. Usage

### Rendering a stored template

```ts
import { GlobalUsersManager } from "@/user/global-users-manager";
import { placeholders } from "@/placeholder";

const globalUser = await GlobalUsersManager.getUser(member.user);
const template = await levelsSettings.get(guild.id, "levelUpMessage");
const text = await placeholders.replace({ globalUser, guild }, template);
```

### Guild-less rendering

```ts
import { userPlaceholders } from "@/placeholder";

const text = await userPlaceholders.replace({ globalUser }, "Welcome, {user_name}!");
```

### Validating config input

`/settings` should reject a template that contains an unknown token. `parse`
plus `has` gives a precise message without the engine knowing about the
setting:

```ts
const unknown = placeholders.parse(input).filter(key => !placeholders.has(key));
if (unknown.length > 0) {
  return `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map(k => `{${k}}`).join(", ")}`;
}
```

This is why unknown tokens are left verbatim in `replace` while validation
lives at the input boundary: the engine never guesses, and the editor never
silently accepts a typo.

### A resolver

A synchronous catalog token:

```ts
import { definePlaceholder, type Placeholder, type GuildPlaceholderContext } from "@/placeholder/placeholder";

const guildName: Placeholder<GuildPlaceholderContext> = definePlaceholder({
  key: "guild_name",
  description: "The guild's name.",
  resolve: context => context.guild.name,
});
```

An async resolver, for a future fetch- or query-backed token. `resolve`
returns a `Promise` and `replace` awaits it with no engine change; the
source below is any hypothetical async service:

```ts
import { definePlaceholder, type Placeholder, type GuildPlaceholderContext } from "@/placeholder/placeholder";

const guildMessages: Placeholder<GuildPlaceholderContext> = definePlaceholder({
  key: "guild_messages",
  description: "Messages recorded in this guild, all time.",
  resolve: async context => (await guildStats.totals(context.guild.id)).messages,
});
```

`context.guild` is `Guild`, not `Guild | undefined`: the
`Placeholder<GuildPlaceholderContext>` annotation carries the guarantee, so
the resolver has nothing to check.

## 7. Extending

Adding a token means one entry with `key`, `description`, and `resolve`.
There is no registration call, no bridge branch, no new command, and no
change to `replace`.

Rules for new tokens:

- Return `null` for "not applicable"; never return `""` to mean absent.
  `null` is unambiguous and `render` handles it.
- Never throw. A placeholder that can fail (a deleted member, a disabled
  feature) returns `null`; `replace` has no error path and a template must
  never break a send.
- Emit Discord timestamps for dates. Emit raw numbers for counts.
- Keep the `scope_name` convention: `{guild_name}` for a guild value,
  `{user_name}` for a user value. A guild-wide aggregate would be
  `{guild_messages}`, not `{messages}`.

## 8. Costs and trade-offs

| Concern        | Placeholder system                           | Ad-hoc string building             |
| -------------- | -------------------------------------------- | ---------------------------------- |
| New plumbing   | 1 interface, 1 executor, 1 assembly file     | None                               |
| Per-token cost | 1 array entry                                | 1 interpolation site per call site |
| Type safety    | Guild tokens rejected in guild-less contexts | None                               |
| Unknown token  | Visible in output, rejectable at input       | Silent typo                        |
| Query cost     | 1 per distinct key per render, parallel      | Caller decides                     |
| Restart safety | Stateless; catalogs are module constants     | Stateless                          |
| Async          | `replace` is async even for static tokens    | Sync                               |

`replace` is async even though every current placeholder resolves
synchronously. That is deliberate: async resolvers then need no engine
change when a fetch- or query-backed token arrives, and the stored strings
that motivated the system (welcome messages, level-up announcements)
already run in async contexts, so callers pay nothing today. This matches
the config system's posture: one generic engine, consumed everywhere,
rather than per-call-site string concatenation.

## 9. Rollout

1. `placeholder.ts` and `placeholder-executor.ts` (types plus engine), with
   a unit test for `replace`, `parse`, unknown-token passthrough, `null`
   rendering, and single-resolution-per-key.
2. `global-user-placeholders.ts` and `guild-placeholders.ts`, wired in
   `index.ts`.
3. Input validation in `/settings` for the first string setting that takes a
   template (the welcome message is the natural first consumer).
4. Migrate existing hardcoded strings (welcome, level-up announce) to stored
   templates once validation is in place.

If only step 1 and 2 land, the engine still pays for itself at the first
template-editable string. Steps 3 and 4 are what turn config text into
templates.
