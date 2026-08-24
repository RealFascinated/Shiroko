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
  .then((user) => getUserProfile(user.id))
  .then((profile) => saveProfile(user.id, profile))
  .then(() => log("saved"))
  .catch((err) => console.error(err));
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
