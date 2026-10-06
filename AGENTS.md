# Agents

`Behavior`, `Commits`, `Bun`, `Libraries`, `APIs`, and `Testing` are generic engineering rules (Bun-first) that apply to any repo. `Shell` is a rule about this workstation, not the repo. `Code Style` and `Verify` assume a TypeScript/Bun project. `Commands`, `Permissions`, `Events`, and `Database` are specific to this project (the Arona Discord bot).

## Behavior

Think before coding. Pick the simplest valid approach and say why. State assumptions explicitly; ask when something critical is unclear, never guess silently.

- Write the minimum code that solves the problem. No speculative features, no abstractions for single-use code, no error handling for impossible scenarios. If a solution could be half the size it is, rewrite it.
- No backward-compat shims unless explicitly requested: no migration paths, dual-format loaders, deprecated-key fallbacks, or legacy shims when changing configs, persisted data, serialized fields, or APIs. Default to the new shape. "Live" means things the running bot depends on: deployed migrations and DB schemas, persisted guild/user config, serialized fields already written to the DB or disk, and APIs other code calls. If a change to any of those could break the running bot, ask first.
- Touch only what you must. Don't "improve" adjacent code, formatting, or comments; don't refactor working code you weren't asked to change. Remove imports/variables/methods that _your_ changes made unused; leave pre-existing dead code alone.

## Commits

When the user asks you to commit, stage only the files for the current task, not everything dirty in the working tree, then commit. Push only when the user asks you to push.

- Identify the scope first. From this chat's edits (and `git diff` / `git status`), list the files that belong to the feature, fix, or request you just finished. Ignore unrelated local changes from other work.
- Stage paths explicitly: `git add <path>…` for those files only. Never `git add -A`, `git add .`, or `git commit -a` unless the user explicitly asked to stage _all_ current changes.
- One logical change per commit. If unrelated files would be included, leave them unstaged.
- Before you commit, briefly list the staged files so the user can see the scope. If a dirty file might belong to this task but you're unsure, ask; don't guess and sweep it in.
- Suggest a short, plain commit message (no `feat:`/`fix:` prefixes), then run `git commit` yourself once the staged set and message are right. Never amend, rebase, or rewrite pushed history unless the user explicitly asks.
- Push only on a request to push: run `git push`, setting the upstream with `-u` on the first push of a branch, and report the branch and remote it went to. Never force-push unless the user explicitly asks.
- Exclude ephemeral debug code (instrumentation the user added for this session) unless they asked to keep it.
- Never stage secrets (`.env`, credentials, tokens). Warn the user if they ask to commit those.

## Shell

Terminal commands run in fish on this machine. Fish does not accept POSIX/bash syntax, so whenever a command needs any of it, wrap it so it is interpreted by bash:

```bash
bash -c 'find . -name "*.ts" | xargs wc -l'
```

- Applies to heredocs (`<<EOF`), `set -e`, globs that fish mishandles, `$(...)`, env prefixes like `FOO=1 cmd`, `&&`/`||` chains, pipes with substitutions, and `for`/`if` syntax.
- Prefer single commands that fish runs natively (`bun`, `bunx tsc --noEmit`, `git status`) over wrapping them. Wrap only when bash-only syntax is needed.
- Use single quotes around the whole payload so nothing is expanded by fish before bash sees it.

## Commands

Required command options can't be empty or null. Read a required option from `ctx.options` with the strict flag, which already returns a non-null type, so never add a redundant `!`. For an optional option, use the `args` bag (`ExecuteContext`'s `args`, available inside `onExecuteSlash`: `args.string`, `args.integer`, ...), which returns `T | null`; handle the null instead of asserting it away.

```typescript
const question = ctx.options.getString("question", true); // string
const target = args.user("user") ?? user.discordUser; // User | null
```

Override `userInstallable` to return `true` so the command registers for both guild and user installs; return `false` only when it genuinely needs a guild context.

A command's constructor takes a `CommandInfo` (`super({ id, displayName })`). Pass `private: true` to register it as a guild command scoped to `PRIVATE_COMMANDS_GUILD_ID` instead of globally, so it only appears in that guild (and is hidden from `/help` elsewhere).

A command that registers subcommands cannot be invoked directly; Discord always sends a subcommand, so the parent's `onExecuteSlash` is never called. Leave it at its default no-op and put all logic in the subcommands.

Subcommands live in their own files under a `sub/` folder next to the parent (e.g. `.../user/sub/avatar.command.ts`); never inline them into the parent, which only imports and registers them. Shared helpers go in the same folder.

Folder layout:

- A command with subcommands gets its own folder (parent file plus `sub/`); standalone commands stay flat files.
- A panel-backed command gets a folder holding `<command>.command.ts` and `<command>-panel.ts` (e.g. `help/help.command.ts` + `help/help-panel.ts`).

Commands owned by a feature live in that feature's `command/` folder, not `src/command/commands/`. General commands live in the always-on `General` feature (`src/feature/impl/general/command/`).

Declare options with the helpers in `src/command/option.ts` (`stringOption`, `userOption`, ...) in a `get options()` override. A command backed by a panel registers its panel with `PanelManager.register` and opens it via `renderPanel` (`@/panel/render`); see `src/feature/impl/general/command/settings/`.

## Permissions

Bot permissions live entirely under `src/permission/`: the logic in `src/permission/permissions.ts` (the `Permissions` class + `PermissionFlags`) and its tests. Nothing else contains permission code. The `/permissions` command lives with the other General commands at `src/feature/impl/general/command/permissions/`.

- Flags are BigInt bitfields (`1n << n`) named after the command they gate, e.g. `FEATURE_COMMAND`. Bits are permanent; never reuse a retired bit. `FLAG_DISPLAY_NAMES` maps each flag to its user-facing label and is the single source of truth for choice labels and `/permissions view` decoding.
- Commands declare a `requiredFlags: bigint` getter (default `0n` = anyone). `CommandManager` enforces it after the feature check; the guild owner and members with Discord `Administrator` (when `ALLOW_ADMIN_BYPASS` is on) bypass all checks. A gate usually lives on the **parent** command; subcommands inherit it unless they declare their own `requiredFlags`, so a parent can stay open while a specific subcommand is gated (e.g. `/levels` open, `/level-config` admin-only). `featureId` inheritance mirrors this: the resolved subcommand's `featureId` wins, otherwise the parent's applies.
- Config storage: each feature's settings live in a `SettingsModule<C>` (`src/settings/settings-module.ts`, e.g. `levels-settings.ts`), registered with `SettingsManager.register` in the feature constructor; keys are `<moduleId>.<path>` rows in `guild_settings`, one row per leaf. Values are read and written with the typed `get`/`set` (dotted paths for scalars, groups, and group leaves) plus `values`/`entries`/`setEntry`/`removeEntry` (open maps). Closed records become `group` descriptors, open records become `map` descriptors. A feature can hold a module without registering it when its own panel edits it instead (`welcomer-settings.ts`).
- Effective flags: a role's own flags OR'd with its parent's effective flags (additive inheritance, cycle-safe), then OR'd across all the member's roles.
- Cache resolution per guild (`loadGuild`) with invalidation on role events. Mirror the existing pattern, don't add ad-hoc checks.

## Events

Internal event system in `src/event/`. It models Meteor's Orbit: typed event classes posted to a bus, listeners subscribe via `@EventHandler` annotations. **No code outside `src/event/event-bridge.ts` ever calls `client.on`**; the bridge is the single adapter from the discord.js gateway to the bus.

### Adding a new event

1. **Define the event class** in `src/event/events/<name>.event.ts`, extending `Event` and wrapping the raw payload + resolved context (guild, userId, optionally a pre-resolved `GlobalUser`). Events are imported by path, so no barrel export is needed.

```ts
import type { Guild } from "discord.js";
import Event from "../event";

export default class VoiceSessionEndedEvent extends Event {
  public override readonly userId: string;
  public readonly guildData: Guild;
  public readonly channelId: string | null;
  public readonly joinedAt: Date;
  public readonly leftAt: Date;

  constructor(options: {
    userId: string;
    guild: Guild;
    channelId: string | null;
    joinedAt: Date;
    leftAt: Date;
  }) {
    super({ guild: options.guild, userId: options.userId });
    this.userId = options.userId;
    this.guildData = options.guild;
    this.channelId = options.channelId;
    this.joinedAt = options.joinedAt;
    this.leftAt = options.leftAt;
  }
}
```

2. **Bridge it** in `src/event/event-bridge.ts`: add one `client.on(<Events.X>, ...)` that posts the new event. Keep it minimal; the bridge is the only place gateway payloads are touched. Filtering (bot/webhook/DM) is fine here or in the event constructor.

3. **Listen** via a class extending `EventListener`:

```ts
import { EventBus } from "@/event/event-bus";
import { EventListener } from "@/event/event-listener";
import { EventHandler } from "@/event/event-handler";
import { MessageCreatedEvent } from "@/event/events/message-created.event";

export class MyListeners extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(MessageCreatedEvent)
  public async onMessageCreated(event: MessageCreatedEvent): Promise<void> {
    // handler body
  }
}
```

Co-locate the listener with the code it serves: a feature listener lives in that feature's `index.ts` beside the feature class, `PermissionsListeners` in `src/permission/permissions.ts`, lifecycle listeners in `src/index.ts`. Instantiate each listener once in `src/index.ts` near the other listeners. The `@/event/...` specifiers above assume the listener lives outside `src/event/`; a listener that is a direct child of `src/event/` uses `../event-bus` and `../events/<name>.event` instead (see Import discipline).

Nightly jobs use `Bun.cron(CRON, fn, { tz: "UTC" })` with the CRON expression as a top-of-file constant, armed on `BotReadyEvent`, stopping any previous job first (`this.job?.stop()`); see `src/feature/impl/birthday/index.ts` and `src/storage/media-listeners.ts`.

### Rules

- **`@EventHandler` takes the event class explicitly**; standard decorators can't infer the param type at runtime (no `emitDecoratorMetadata`). Signature: `@EventHandler(MyEvent, { featureId?: FeatureIds })`.
- **Feature gating is per-listener**: pass `{ featureId: FeatureIds.X }` and the bus checks `GuildFeatures.isFeatureEnabled(event.guild, featureId)` before dispatch. Leave it out for ungated listeners.
- **`this` is bound**: the bus binds each handler to its listener instance.
- **Resolve global users via `GlobalUsersManager.getUser(user)`**; it get-or-creates the row in the DB, cached behind the `global-users` cache. Guild-scoped rows go through `GuildUsersManager.getUser`/`claimLastMessage`, which read the DB every call (the SQL predicate is the cooldown's source of truth; never cache in front of it).
- **Dispatch order**: handlers run in subscription order (priority tier reserved for later).
- **Lifecycle**: listeners subscribe in their constructor via `EventBus.subscribe(this)`.
- **Import discipline** (avoid cycles): listeners import from leaf modules (`../event-bus`, `../events/<name>.event`), never the `src/event/index.ts` barrel. `Feature` never statically imports `CommandManager` (dynamic import to dodge the command/feature cycle). `src/lib/embed.ts` imports `discordClient` from `src/index.ts`, so modules on that chain must not import embeds at module-init time; a sweep that builds embeds lives in its own file (`birthday-sweep.ts`, `media.service.ts`).

## Read the Subsystem

Read the subsystem before you write code. A change sits inside a framework, manager, registry, or feature area; explore base classes, registration paths, config hooks, and existing implementations first. Stop once you've found one sibling to mirror; explore further only if that example leaves a genuine gap.

- Follow integration points. New code registers where its siblings register; find that spot and do the same.
- No loose workarounds. Don't reach around a framework with one-off hacks, duplicated logic, or hard-coded values an existing abstraction already handles. If the framework lacks support, extend it at the right layer.
- Mirror a nearby example end-to-end: setup → registration → config → behavior. That path is your template.

## Bun

Default to using Bun instead of Node.js. Use the `bun`/`bunx` CLI in place of its npm/yarn/pnpm/npx equivalents, and `bun test` instead of jest or vitest.

- Bun automatically loads .env, so don't use dotenv.

## Libraries

Prefer an existing, well-maintained library over writing a new implementation. Reuse beats reinvention: libraries are tested, maintained, and handle edge cases you will otherwise forget.

- Check the standard library, Bun, and existing dependencies first: they already cover most needs (hashing, validation, date handling, parsing, pagination, retries). Reach for a new package only when none of them fits, and only if a custom version would not be meaningfully simpler.
- Avoid reimplementing what the standard library, Bun, or a dependency already provides.
- Add dependencies to `dependencies`, not `devDependencies`. Keep the dependency footprint small.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Use `Bun.$` for shell commands instead of execa.

## Testing

Use `bun test` to run tests. Import `test`/`expect` from `bun:test`; the Bun API docs live in `node_modules/bun-types/docs/**.mdx`. Tests sit next to the code as `<file>.test.ts` (e.g. `src/cache/cache.test.ts`, `src/panel/router.test.ts`).

## Database

Postgres runs via Docker Compose (`docker-compose.yml`, `postgres:18-alpine`); start it with `docker compose up -d`. Connection config lives in `.env` (`DATABASE_URL`).

Drizzle ORM wraps the `pg` driver (`drizzle-orm/node-postgres`). `db` is exported from `src/db/index.ts`; tables live in `src/db/schemas/`, one file per table named after it (`guild-settings.ts`, ...), and the schema must stay registered in the aggregate object in `src/db/index.ts` or `drizzle-kit generate` will emit a `DROP TABLE` for it.

- Migrations: `bunx drizzle-kit generate` to create, `bunx drizzle-kit migrate` to apply. `push` applies schema without migration files; `drop` removes them.
- `drizzle/meta/` is machine-generated and prettier-ignored; don't hand-edit it.
- Writes use drizzle upserts (`onConflictDoUpdate`/`onConflictDoNothing` with `.returning()`); a read that a caller must survive a conflict uses the returning row's presence as the verdict. See `src/user/guild-users-manager.ts` for the atomic-claim pattern.
- Exception to the "use `Bun.sql`" rule: drizzle's `pg` driver is permitted. Drizzle is an ORM layer, not raw `pg` usage.

# Code Style

## Punctuation

Never use em dashes (`—`) or en dashes (`–`) in code, comments, or docs. Use a period to split into two sentences, a colon to introduce, or a semicolon to join related clauses; use a plain hyphen in ranges and compound words.

## Imports

Use relative specifiers for anything at or below the current directory, and the `@/` alias (which maps to `src/`, per `"@/*": ["./src/*"]` in `tsconfig.json`) once a path climbs two or more directories up.

```ts
// src/feature/impl/general/command/ping.command.ts
import Command from "@/command/command"; // several up, too deep to count
import { baseEmbed } from "@/lib/embed";
```

- Same directory: `./option`, `./sub/rank.command`. Descending never changes the specifier's form.
- One level up: `../command`, `../event/event-bus`.
- Two or more levels up: `@/lib/embed`, `@/db/index`. Never `../../lib/embed`.
- Omit the file extension, and keep `index` explicit when you mean the entry itself: `@/command` is `src/command/index.ts` (`CommandManager`), so import `@/command/command` for the `Command` class. The distinction matters: resolving a directory to its `index.ts` is how a barrel gets pulled in by accident.

## Design

Model variation with types, not branching. When behaviour differs by kind, category, or role, use inheritance and polymorphic dispatch, not `if`/`switch` chains, string discriminators, or flag fields that need comments to interpret.

- Extend existing abstractions. Read siblings and follow the hierarchy.
- Pull shared logic up; subclasses override only what varies; call sites depend on the supertype and let dispatch select the implementation.
- Abstract only where it earns its keep: two or more variants exist or are about to exist. A single implementation with no realistic second variant stays concrete; don't create a base class for one subclass.

Bad:

```ts
if (type === "currency") { ... }
else if (type === "item") { ... }
```

Good:

```ts
abstract class Reward {
  public abstract grant(user: User): void;
}

class CurrencyReward extends Reward {
  public grant(user: User): void {
    // ...
  }
}

class ItemReward extends Reward {
  public grant(user: User): void {
    // ...
  }
}

// Call site: dispatch selects the implementation, no branch on kind.
reward.grant(user);
```

## Class Members

Every class member must declare an explicit visibility modifier (`public`, `protected`, `private`). Fields need an explicit type; methods and getters need an explicit return type. An `override` member may rely on the inherited return type, which is how most `get options()` and `onExecuteSlash` overrides are written.

Bad:

```ts
class Foo {
  counter = 0;
  compute() {
    return this.counter;
  }
}
```

Good:

```ts
class Foo {
  public counter: number = 0;
  public compute(): number {
    return this.counter;
  }
}
```

Applies to class fields, methods, getters, and setters. Constructors inherit their class's visibility (no modifier needed).

## Comments

Most methods, classes, and constructors need no comment. Write one only when a reader cannot recover the reason from the name and the body; the default is silence, not documentation.

If a method genuinely needs documentation, write a full JSDoc block. Never use a 1-line JSDoc (`/** ... */`) to document a method or class. This rule is about method and class documentation only: short `//` notes on fields and inside bodies are fine, as below.

A comment explains **why**, never **what**. Never paraphrase a symbol's name or body. If a reader could re-derive it from the adjacent code, delete it: don't narrate branches, assignments, or assertions. One-word clarifications on unit-ambiguous shapes (`// milliseconds`, `// null = unset`) are fine. Leave existing comments alone unless they're part of the task.

Bad:

```ts
/** The birthday feature: `/birthday` plus the nightly sweep. */
export default class BirthdayFeature extends Feature {
```

Good:

```ts
/**
 * Started from `BotReadyEvent` rather than at construction so the job takes
 * its `Client` from the event instead of importing `discordClient` (which
 * would pull in `src/index.ts` and its cycle).
 */
@EventHandler(BotReadyEvent)
public async onBotReady(event: BotReadyEvent): Promise<void> {
  // ...
}
```

## Return statements

Return a concise expression directly instead of assigning to a single-use variable first.

## Dead code

No useless variables; don't assign to a variable used once immediately after. No useless methods; don't extract a method called from one place that adds no clarity. Inline it. This governs the code you write; don't inline pre-existing single-use methods you weren't asked to touch.

## Spacing

No blank lines between trivial or adjacent logic. Add vertical space only to separate genuinely large, distinct operations where it meaningfully improves readability.

## Braces

Never inline control-flow bodies. Always use braces, even for a single statement. Applies to `if`, `else`, `for`, `while`, `do`, and `try`/`catch`/`finally`.

## Async/Await

Prefer `async`/`await` over `.then` chains: it reads top-to-bottom, composes with `try`/`catch`, and avoids nested callback scope.

## Scope

Don't make sweeping changes. Edit the existing code that's directly relevant to the task; leave unrelated code untouched.

- Change only what the task requires. Don't rename, reformat, reorganize, or refactor code outside that scope, even if it looks outdated or inconsistent.
- Prefer surgical edits over rewrites. A targeted change is easier to review, less likely to break something, and easier to revert.
- Preserve existing structure, naming, and conventions. If you must touch a file, minimize the diff.

## Verify

Finish every change by verifying it builds and passes. Do not submit code that fails any of these.

- Format: `bunx prettier --write <changed files>` (add `prettier` to devDependencies if missing), or `bunx prettier --check <changed files>` to verify without writing. Never run prettier over the whole repo; it would reformat unrelated files.
- Type-check: `bunx tsc --noEmit`, which must pass with zero errors.
- Test: when tests exist, `bun test <path>` for the touched area while iterating, and the full `bun test` before finishing a broad change. Both baselines are clean.
