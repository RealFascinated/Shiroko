# Agents

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

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

# Code Style

## Braces

Never inline control-flow bodies. Always use braces, even for a single statement.

Bad:

```js
if (user)
  user.save()

for (const item of cart)
  total += item.price

if (res.ok)
  return res.json()
  log("saved")
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
