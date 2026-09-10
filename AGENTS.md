# Agents

## Behavior

Think before coding — pick the simplest valid approach and say why. State assumptions explicitly; ask when something critical is unclear, never guess silently.

- Write the minimum code that solves the problem. No speculative features, no abstractions for single-use code, no error handling for impossible scenarios. If a solution could be half the size it is, rewrite it.
- No backward-compat shims unless explicitly requested: no migration paths, dual-format loaders, deprecated-key fallbacks, or legacy shims when changing configs, persisted data, serialized fields, or APIs. Default to the new shape. If a change could break something live, ask first.
- Touch only what you must. Don't "improve" adjacent code, formatting, or comments; don't refactor working code you weren't asked to change. Remove imports/variables/methods that _your_ changes made unused; leave pre-existing dead code alone.

### Commits

When the user asks you to commit, stage and commit only the files for the current task — not everything dirty in the working tree.

- Identify the scope first. From this chat's edits (and `git diff` / `git status`), list the files that belong to the feature, fix, or request you just finished. Ignore unrelated local changes from other work.
- Stage paths explicitly: `git add <path>…` for those files only. Never `git add -A`, `git add .`, or `git commit -a` unless the user explicitly asked to commit _all_ current changes.
- One logical change per commit. If unrelated files would be included, leave them unstaged.
- Before committing, briefly list the staged files so the user can see the scope. If a dirty file might belong to this task but you're unsure, ask — don't guess and sweep it in.
- Never commit automatically: suggest a short, plain commit message (no `feat:`/`fix:` prefixes), then let the user commit.
- Exclude ephemeral debug code (instrumentation the user added for this session) unless they asked to keep it.
- Never stage secrets (`.env`, credentials, tokens). Warn the user if they ask to commit those.

### Commands

Required command options can't be empty or null. When reading a required option with the strict flag (`getString("name", true)`), assert non-null with `!` — the option is guaranteed present.

```typescript
const question = ctx.options.getString("question", true)!;
```

Every command should be user-installable unless it needs the guild. Override `userInstallable` to return `true` so the command registers for both guild and user installs and can be used in servers and DMs. Only return `false` when the command genuinely needs a guild context.

A command that registers subcommands cannot be invoked directly — Discord always sends a subcommand, so the parent's `onExecuteSlash` is never called. Don't implement a "choose a subcommand" handler or reply on such parents; leave `onExecuteSlash` at its default no-op and put all logic in the subcommands. `executeSlash` already short-circuits: it dispatches to the subcommand, or returns silently if none is supplied.

Subcommands live in their own files under a `sub/` folder next to the parent command file (e.g. `src/command/commands/user/sub/avatar.command.ts`). Never inline subcommand classes into the parent file — the parent only imports and registers them. Shared helpers for those subcommands go in the same `sub/` folder (e.g. `sub/permissions-helpers.ts`).

A command that has subcommands gets its own folder: parent file plus `sub/` (e.g. `src/command/commands/user/user.command.ts` + `src/command/commands/user/sub/`). Standalone commands with no subcommands stay flat files in `src/command/commands/`.

Commands owned by a feature live inside that feature's folder, under `command/` (e.g. `src/feature/stats/command/stats/stats.command.ts`, `src/feature/social/command/react/react.command.ts`). A feature with commands keeps them there — not in `src/command/commands/`. The general commands (`ping`, `user`, `botstats`, `guildinfo`, `/permissions`) stay in `src/command/commands/` (and `src/permission/`).

## Permissions

Bot permissions live entirely under `src/permission/` — the logic in `src/permission/permissions.ts` (the `Permissions` class + `PermissionFlags`), its tests, and the `/permissions` command in `src/permission/command/`. Do not put permission code anywhere else.

- Flags are BigInt bitfields (`1n << n`) named after the command they gate, e.g. `FEATURE_COMMAND`, `PERMISSIONS_COMMAND`. Bits are permanent — never reuse a retired bit. `FLAG_DISPLAY_NAMES` maps each flag to its user-facing label and is the single source of truth for choice labels and `/permissions view` decoding.
- Commands declare a `requiredFlags: bigint` getter (default `0n` = anyone). `CommandManager` enforces it after the feature check; the guild owner and members with Discord `Administrator` (when `ALLOW_ADMIN_BYPASS` is on) bypass all checks.
- Effective flags: a role's own flags OR'd with its parent's effective flags (additive inheritance, cycle-safe), then OR'd across all the member's roles.
- Cache resolution per guild (`loadGuild`) with invalidation on role events — mirror the existing pattern, don't add ad-hoc checks.
- Subcommands of `/permissions` live in `src/permission/command/sub/`, and shared helpers in the same folder (e.g. `sub/permissions-helpers.ts`). Only the parent imports `Command` from `src/command/command` — `../../command` would resolve to `src/command/index.ts` (`CommandManager`).

## Events

Internal event system in `src/event/` (Docs: `DESIGN.md`, see "Internal Events"). It models Meteor's Orbit: typed event classes posted to a bus, listeners subscribe via `@EventHandler` annotations. **No code outside `src/event/event-bridge.ts` ever calls `client.on`** — the bridge is the single adapter from the discord.js gateway to the bus.

### Adding a new event

1. **Define the event class** in `src/event/events/<name>.event.ts`, extending `Event` and wrapping the raw payload + resolved context (guild, userId, optionally a pre-resolved `GlobalUser`). Export it from `src/event/events/index.ts`.

```ts
import type { Guild, VoiceState } from "discord.js";
import Event from "../event";
import { FeatureIds } from "../../feature/feature-ids";

export default class VoiceSessionEndedEvent extends Event {
  public override readonly userId: string;
  public readonly guildData: Guild;
  public readonly channelId: string | null;

  constructor(options: { userId: string; guild: Guild; channelId: string | null }) {
    super({ guild: options.guild, userId: options.userId, featureId: FeatureIds.Stats });
    this.userId = options.userId;
    this.guildData = options.guild;
    this.channelId = options.channelId;
  }
}
```

2. **Bridge it** in `src/event/event-bridge.ts`: add one `client.on(<Events.X>, ...)` that posts the new event. Keep it minimal — the bridge is the only place gateway payloads are touched; filtering (bot/webhook/DM) is fine here or in the event constructor.

3. **Listen** via a class extending `EventListener`:

```ts
import { EventBus } from "../event-bus";
import { EventListener } from "../event-listener";
import { EventHandler } from "../event-handler";
import { MessageCreatedEvent } from "../events/message-created.event";

export class MyListeners extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(MessageCreatedEvent)
  public async onMessageCreated(event: MessageCreatedEvent): Promise<void> { ... }
}
```

Co-locate the listener class with the code it serves: a feature listener (e.g. `StatsListeners`) lives in that feature's `index.ts` beside the feature class, `PermissionsListeners` lives in `src/permission/permissions.ts`, the slash-dispatch listener in `src/command/index.ts`, the context-menu one in `src/context-menu/context-menu-command-manager.ts`, voice keepalive in `src/lib/voice.ts`, lifecycle in `src/index.ts`. Instantiate each listener once in `src/index.ts` near the other listeners.

### Rules

- **`@EventHandler` takes the event class explicitly** — standard decorators can't infer the param type at runtime (no `emitDecoratorMetadata`). Signature: `@EventHandler(MyEvent, { featureId?: FeatureIds })`.
- **Feature gating is per-listener**: pass `{ featureId: FeatureIds.X }` and the bus checks `GuildFeatures.isFeatureEnabled(event.guild, featureId)` before dispatch. Leave it out for ungated listeners. Prefer per-listener over baking the feature into the event class.
- **`this` is bound**: the bus binds each handler to its listener instance, so `this.myHelper()` works inside handlers.
- **Resolve global users via `GlobalUsersManager.getCached(user)`** — cached per process; never call `getUser` directly from hot paths (per-message events).
- **Dispatch order**: handlers run in subscription order (priority tier reserved for later). Multiple listeners for one event are fine.
- **Lifecycle**: listeners subscribe in their constructor via `EventBus.subscribe(this)`; remove via `EventBus.unsubscribe(listener)`.
- **Import discipline** (avoid cycles): listeners import from leaf modules (`../event-bus`, `../event-listener`, `../event-handler`, `../events/<name>.event`), never the `src/event/index.ts` barrel which only re-exports the core (`Event`, `EventBus`, `EventHandler`, `EventListener`). Feature code imports `FeatureIds` from `./feature-ids` (leaf), and `Feature` never statically imports `CommandManager` (dynamic import to dodge the command/feature cycle).

## Read the Subsystem

Read the subsystem before you write code. A change sits inside a framework, manager, registry, or feature area — explore base classes, registration paths, config hooks, and existing implementations first.

- Follow integration points. New code registers where its siblings register; find that spot and do the same.
- No loose workarounds. Don't reach around a framework with one-off hacks, duplicated logic, or hard-coded values an existing abstraction already handles. If the framework lacks support, extend it at the right layer.
- Mirror a nearby example end-to-end: setup → registration → config → behavior. That path is your template.

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Libraries

Prefer an existing, well-maintained library over writing a new implementation. Reuse beats reinvention: libraries are tested, maintained, and handle edge cases you will otherwise forget.

- Reach for a package first. Only write your own implementation when no library satisfies the requirement, or when a custom version is meaningfully simpler than the dependency.
- Avoid reimplementing what the standard library, Bun, or a dependency already provides: hashing, validation, date handling, parsing, pagination, retries, etc.
- Add dependencies to `dependencies`, not `devDependencies`. Keep the dependency footprint small; prefer one package that covers many needs over several narrow ones.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Database

Postgres runs via Docker Compose (`docker-compose.yml`, `postgres:16-alpine`); start it with `docker compose up -d`. Connection config lives in `.env` (`DATABASE_URL`).

Drizzle ORM wraps the `pg` driver (`drizzle-orm/node-postgres`). `db` is exported from `src/db/index.ts`; tables are exported from `src/db/schema.ts`.

- Migrations: `bunx drizzle-kit generate` to create, `bunx drizzle-kit migrate` to apply. `push` applies schema without migration files; `drop` removes them.
- `drizzle/meta/` is machine-generated and prettier-ignored; don't hand-edit it.
- Exception to the "use `Bun.sql`" rule: drizzle's `pg` driver is permitted — drizzle is an ORM layer, not raw `pg` usage.

# Code Style

## Design

Model variation with types, not branching. When behaviour differs by kind, category, or role, use inheritance and polymorphic dispatch — not `if`/`switch` chains, string discriminators, or flag fields that need comments to interpret.

- Extend existing abstractions. Read siblings and follow the hierarchy.
- Pull shared logic up; subclasses override only what varies; call sites depend on the supertype and let dispatch select the implementation.
- Abstract only where it earns its keep. A single implementation with no realistic second variant stays concrete — don't create a base class for one subclass.

Bad:

```js
if (type === "currency") { ... }
else if (type === "item") { ... }
```

Good:

```js
abstract class Reward {
  abstract grant(user: User): void;
}
```

## Class Members

Every class member must declare an explicit visibility modifier (`public`, `protected`, `private`) and, for fields and methods, an explicit return type.

Bad:

```js
class Foo {
  counter = 0;
  compute() {
    return this.counter;
  }
}
```

Good:

```js
class Foo {
  public counter: number = 0;
  public compute(): number { return this.counter; }
}
```

Applies to class fields, methods, getters, and setters. Constructors inherit their class's visibility (no modifier needed).

## Comments

Only full JSDoc comments on methods. Never use 1-line comments (`/** ... */` or `// ...`) on methods — if a method needs a comment, write a complete JSDoc block describing it. 1-line comments are acceptable only as brief inline section markers inside a method body.

## Return statements

Return a concise expression directly instead of assigning to a single-use variable first.

Bad:

```js
const total = this.calculateSum(a, b);
return total;
```

Good:

```js
return this.calculateSum(a, b);
```

## Dead code

No useless variables — don't assign to a variable used once immediately after. No useless methods — don't extract a method called from one place that adds no clarity; inline it.

Bad:

```js
const name = data.get("name");
this.name = name;
```

Good:

```js
this.name = data.get("name");
```

## Spacing

No blank lines between trivial or adjacent logic. Add vertical space only to separate genuinely large, distinct operations where it meaningfully improves readability.

## Braces

Never inline control-flow bodies. Always use braces, even for a single statement.

Bad:

```js
if (user) user.save();

for (const item of cart) total += item.price;

if (res.ok) return res.json();
log("saved");
```

Good:

```js
if (user) {
  user.save();
}

for (const item of cart) {
  total += item.price;
}

if (res.ok) {
  return res.json();
}
log("saved");
```

Applies to `if`, `else`, `for`, `while`, `do`, and `try`/`catch`/`finally`.

## Async/Await

Prefer `async`/`await` over `.then` chains. Read top-to-bottom, composes with `try`/`catch`, and avoids nested callback scope.

Bad:

```js
getUser(id)
  .then(user => getUserProfile(user.id))
  .then(profile => saveProfile(user.id, profile))
  .then(() => log("saved"))
  .catch(err => console.error(err));
```

Good:

```js
async function saveProfileFlow(id) {
  try {
    const user = await getUser(id);
    const profile = await getUserProfile(user.id);
    await saveProfile(user.id, profile);
    log("saved");
  } catch (err) {
    console.error(err);
  }
}
```

## Scope

Don't make sweeping changes. Edit the existing code that's directly relevant to the task; leave unrelated code untouched.

- Change only what the task requires. Don't rename, reformat, reorganize, or refactor code outside that scope — even if it looks outdated or inconsistent.
- Prefer surgical edits over rewrites. A targeted change is easier to review, less likely to break something, and easier to revert.
- Preserve existing structure, naming, and conventions. If you must touch a file, minimize the diff.

## Verify

Finish every change by verifying it builds and passes. Do not submit code that fails any of these.

- Format: run `bunx prettier --write .`. Add `prettier` to devDependencies if it is not installed.
- Type-check: run `bunx tsc --noEmit`. `tsconfig.json` is `strict` with `noEmit`, so this catches type errors without emitting files. This must pass with zero errors.
- Test: run `bun test` when tests exist.
