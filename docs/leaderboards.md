# Leaderboard Service Plan

A generic, fully DB-backed leaderboard service for Shiroko. It ranks
entities (users, guilds, and anything else added later) by a score derived
from a table, and exposes paged listings plus per-entity position lookups
that commands can render.

No cache, no in-memory ranking, no new tables: every read hits
Postgres, mirroring the `LevelsService` and `InvitesService` convention.

## 1. Where it lives

Leaderboards cut across features (level XP, messages, invites, voice), so
they do not belong inside a single feature folder. They read the central
`src/db/schema.ts` the same way the feature services do, so the whole
service is self-contained in one top-level folder, sibling to
`src/permission/` and `src/event/`:

```
src/leaderboard/
  leaderboard.ts        shared types + abstract Leaderboard<T>
  user-leaderboard.ts   abstract UserLeaderboard<T>
  guild-leaderboard.ts  abstract GuildLeaderboard<T>
  impl/
    level-leaderboard.ts    concrete LevelLeaderboard
    message-leaderboard.ts  concrete MessageLeaderboard
    invite-leaderboard.ts   concrete InviteLeaderboard
    voice-leaderboard.ts    concrete VoiceLeaderboard
  index.ts                  LeaderboardManager: static registry
```

The base classes sit at the folder root; every concrete board lives in
`impl/`, so the folder reads as "the generic service" plus "the boards".
There is no barrel: `index.ts` is the `LeaderboardManager` registry only
and does not re-export the implementations. Callers go through
`LeaderboardManager` for a board and import `LeaderboardId` from
`leaderboard.ts` when they need the slug type.

## 2. Class hierarchy

```
Leaderboard<T>            abstract contract + generic page/position mechanics
├── UserLeaderboard<T>    entity tier: ranks user ids (default guild-scoped)
│   ├── LevelLeaderboard    concrete: XP per guild from user_levels
│   ├── MessageLeaderboard  concrete: message count per guild from message_events
│   ├── InviteLeaderboard   concrete: attributed invites per guild from invite_joins
│   └── VoiceLeaderboard    concrete: voice seconds per guild from voice_sessions
└── GuildLeaderboard<T>   entity tier: ranks guild ids (global scope)
    └── (no concrete board yet; first one arrives with a real metric)
```

- `Leaderboard<T>` owns the mechanics that are identical for every board:
  page clamping, page counts, position math, empty-board handling. `T` is
  the row type the board emits (what appears in a page and in a position).
- `UserLeaderboard` / `GuildLeaderboard` are thin entity tiers: they fix
  `entity` and the default `scope` and give subclasses a semantic seam.
  The real per-board work is four small SQL methods (see §3).
- A concrete board is: pick a table, pick the score, write the four query
  methods. Nothing else.

### Types

```ts
export type LeaderboardEntity = "user" | "guild";
export type LeaderboardScope = "guild" | "global";

export enum LeaderboardId {
  Invites = "invites",
  Level = "level",
  Messages = "messages",
  Voice = "voice",
}

/** One ranked entity. `id` is the user id or guild id; `value` is the
 *  score in the board's units (XP, message count, seconds, ...). */
export interface LeaderboardRow {
  id: string;
  value: number;
}

export interface LeaderboardPage<T extends LeaderboardRow> {
  page: number; // 1-based, clamped
  pageSize: number;
  pageCount: number; // max(1, ceil(total / pageSize))
  total: number; // ranked entities in scope
  rows: T[];
}

export interface LeaderboardPosition<T extends LeaderboardRow> {
  position: number | null; // null when the entity has no score row
  total: number;
  row: T | null; // the entity's own row, so callers can show
  // "you are 5th with 1,234 XP" without refetching
}
```

### `Leaderboard<T>` (abstract)

```ts
export abstract class Leaderboard<T extends LeaderboardRow> {
  /** The board's registry slug ({@link LeaderboardId}). */
  public abstract readonly id: LeaderboardId;
  /** What is ranked: user ids or guild ids. Drives name resolution. */
  public abstract readonly entity: LeaderboardEntity;
  /** "guild": scope is a guild id. "global": scope is ignored. */
  public abstract readonly scope: LeaderboardScope;

  public abstract getPage(scope: string, page: number, pageSize?: number): Promise<LeaderboardPage<T>>;
  public abstract getPosition(scope: string, id: string): Promise<LeaderboardPosition<T>>;
}
```

The three public methods are implemented by the base (in
`UserLeaderboard`/`GuildLeaderboard`, see §3) over a small protected query
surface, so a new board never re-implements paging or position math.

**Scope parameter.** The interface is uniform: `scope` is always a string.
Guild-scoped boards interpret it as the guild id; global boards ignore it
(callers pass `"global"`). This keeps one signature across the hierarchy
and lets a future command layer drive any board the same way.

**Ordering contract.** Every board orders `value DESC, id ASC`. The `id`
tiebreak makes pages deterministic across calls. Ties on `value` share the
same position (competition ranking: 1, 2, 2, 4), matching the old rank
card and `/levels leaderboard` behaviour.

**Page size.** `DEFAULT_PAGE_SIZE = 10` (matches the current
`/levels leaderboard` render); `pageSize` is clamped to `[1, 50]`.

## 3. The generic mechanics

`UserLeaderboard` and `GuildLeaderboard` share identical mechanics, so the
base declares four protected abstract query methods and implements the
public API on top:

```ts
export abstract class UserLeaderboard<T extends LeaderboardRow> extends Leaderboard<T> {
  public override readonly entity: LeaderboardEntity = "user";
  public override readonly scope: LeaderboardScope = "guild"; // overridable

  /** Top `limit` rows starting at `offset`, in board order. */
  protected abstract fetchTop(scope: string, limit: number, offset: number): Promise<T[]>;
  /** The single row for one entity, or null when it has no score. */
  protected abstract fetchRow(scope: string, id: string): Promise<T | null>;
  /** Entities in scope with strictly greater value. */
  protected abstract countAhead(scope: string, value: number): Promise<number>;
  /** All ranked entities in scope. */
  protected abstract total(scope: string): Promise<number>;

  public async getPage(
    scope: string,
    page: number,
    pageSize = DEFAULT_PAGE_SIZE
  ): Promise<LeaderboardPage<T>> {
    const clampedSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
    const [rows, total] = await Promise.all([
      this.fetchTop(scope, clampedSize, (page - 1) * clampedSize),
      this.total(scope),
    ]);
    const pageCount = Math.max(1, Math.ceil(total / clampedSize));
    const clampedPage = Math.min(Math.max(1, page), pageCount);
    return { page: clampedPage, pageSize: clampedSize, pageCount, total, rows };
  }

  public async getPosition(scope: string, id: string): Promise<LeaderboardPosition<T>> {
    const row = await this.fetchRow(scope, id);
    if (!row) {
      return { position: null, total: await this.total(scope), row: null };
    }
    const ahead = await this.countAhead(scope, row.value);
    return { position: ahead + 1, total: await this.total(scope), row };
  }
}
```

`GuildLeaderboard` is the same class with `entity = "guild"` and
`scope = "global"`. (It has no concrete board yet; it exists because the
service is requested to support guild rankings, and the first guild board
then costs one file.)

Round-trips: `getPage` is 2 parallel queries; `getPosition` is 3 sequential
queries (fetchRow, then countAhead, then total), or 2 when the entity
has no row. That is at or below what the old rank card already did, and it
buys back the uniform API.

## 4. The two table shapes

Every source table is one of two shapes; the four query methods map
straight onto them.

### Shape A: value table (one row per entity, score column)

`user_levels` is the example: `(guild_id, user_id)` PK, `xp` is the score.

| Method       | SQL                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `fetchTop`   | `select user_id as id, xp as value from user_levels where guild_id = $1 order by xp desc, user_id asc limit $2 offset $3` |
| `fetchRow`   | `select user_id as id, xp as value from user_levels where guild_id = $1 and user_id = $2`                                 |
| `countAhead` | `select count(*) filter (where xp > $2) from user_levels where guild_id = $1`                                             |
| `total`      | `select count(*) from user_levels where guild_id = $1`                                                                    |

Already covered by the existing `user_levels_guild_xp_idx (guild_id, xp
desc)` index; no migration needed.

### Shape B: event table (many rows per entity, score = count or sum)

`message_events`, `invite_joins`, `voice_sessions`. The score is an
aggregate, so pages group first, and `countAhead` counts groups via a
derived table:

| Method       | SQL (count example, `message_events`)                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fetchTop`   | `select user_id as id, count(*) as value from message_events where guild_id = $1 group by user_id order by value desc, user_id asc limit $2 offset $3` |
| `fetchRow`   | `select user_id as id, count(*) as value from message_events where guild_id = $1 and user_id = $2 group by user_id`                                    |
| `countAhead` | `select count(*) from (select user_id, count(*) as value from message_events where guild_id = $1 group by user_id) t where t.value > $2`               |
| `total`      | `select count(*) from (select user_id from message_events where guild_id = $1 group by user_id) t`                                                     |

In Drizzle this is a grouped query passed through `.as("t")` into
`.from(...)` (supported in drizzle-orm 0.45). Sum boards (voice seconds)
replace `count(*)` with `sum(duration_seconds)`; note `duration_seconds`
is nullable for still-open sessions, so voice boards either exclude open
sessions or coalesce.

Index note: `invite_joins` already has `(guild_id, inviter_id)`, ideal for
the invite board. `message_events` and `voice_sessions` had
`(guild_id, created_at/joined_at desc)` indexes, which do not serve a
per-user `group by`; migration `0024` added
`message_events_guild_user_idx (guild_id, user_id)` and
`voice_sessions_guild_user_idx (guild_id, user_id)`.

## 5. Boards

| Board                | Tier               | Table            | Shape | Score              |
| -------------------- | ------------------ | ---------------- | ----- | ------------------ |
| `LevelLeaderboard`   | `UserLeaderboard`  | `user_levels`    | value | `xp`               |
| `MessageLeaderboard` | `UserLeaderboard`  | `message_events` | count | messages           |
| `InviteLeaderboard`  | `UserLeaderboard`  | `invite_joins`   | count | attributed invites |
| `VoiceLeaderboard`   | `UserLeaderboard`  | `voice_sessions` | sum   | seconds            |
| (first guild board)  | `GuildLeaderboard` | TBD              | TBD   | TBD                |

Each board file exports only its class; `LeaderboardManager` constructs
the boards, and consumers look them up by id through
`LeaderboardManager.getLeaderboard`.

### `LevelLeaderboard` (`src/leaderboard/impl/level-leaderboard.ts`)

```ts
export default class LevelLeaderboard extends UserLeaderboard<LeaderboardRow> {
  public override readonly id: string = "level";
  // entity/scope inherited: "user" / "guild"
  // fetchTop / fetchRow / countAhead / total per Shape A above
}
```

`value` is the raw XP; display derives the level via the existing
`levelForXp` in the command layer, so the board stays unit-agnostic.

## 6. Registry

```ts
// src/leaderboard/index.ts
import InviteLeaderboard from "./impl/invite-leaderboard";
import LevelLeaderboard from "./impl/level-leaderboard";
import MessageLeaderboard from "./impl/message-leaderboard";
import VoiceLeaderboard from "./impl/voice-leaderboard";
import type Leaderboard from "./leaderboard";
import { LeaderboardId, type LeaderboardRow } from "./leaderboard";

/**
 * The registered leaderboards, keyed by id. This is a registry, not a
 * barrel: implementations are never re-exported, so consumers look a
 * board up here by id.
 */
export default class LeaderboardManager {
  private static BOARDS: Record<LeaderboardId, Leaderboard<LeaderboardRow>> = {
    [LeaderboardId.Level]: new LevelLeaderboard(),
    [LeaderboardId.Messages]: new MessageLeaderboard(),
    [LeaderboardId.Invites]: new InviteLeaderboard(),
    [LeaderboardId.Voice]: new VoiceLeaderboard(),
  };

  public static getLeaderboard(id: LeaderboardId): Leaderboard<LeaderboardRow> {
    return LeaderboardManager.BOARDS[id];
  }

  public static listLeaderboards(): Leaderboard<LeaderboardRow>[] {
    return Object.values(LeaderboardManager.BOARDS);
  }
}
```

`LeaderboardManager` (in `src/leaderboard/index.ts`, sibling to the other
managers) constructs the boards and exposes them only through
`getLeaderboard` and `listLeaderboards`; implementations are never
re-exported. The registry is total over `LeaderboardId`, so
`getLeaderboard` never returns undefined, and no new board may be added
without an enum member and a registry entry. Commands look their board up
by id (the existing `/levels leaderboard` and `/invites leaderboard`
subcommands use `LeaderboardManager.getLeaderboard(LeaderboardId.Level)`
and `LeaderboardManager.getLeaderboard(LeaderboardId.Invites)`); the same
lookup serves the future generic `/leaderboard <kind>` command.

## 7. Cutover

Both existing leaderboard surfaces were switched over to the service, and
the old ranking code was deleted. No shims, no legacy paths.

- `/levels leaderboard`
  (`src/feature/levels/command/levels/sub/leaderboard.command.ts`) now
  calls `LeaderboardManager.getLeaderboard(LeaderboardId.Level).getPage(guildId, 1)` and renders the rows
  identically (`ordinal`, user mention, `levelForXp(value)`, formatted XP).
- `LevelsService.leaderboard` and the private `LevelsService.rankAndTotal`
  were deleted. The `/levels rank` card (`getRankState`) now reads through
  `LeaderboardManager.getLeaderboard(LeaderboardId.Level).getPosition(guildId, userId)`: `guildRank` is
  `position.position`, `totalTracked` is `position.total`, and the XP and
  level fields derive from `position.row?.value ?? 0`.
- `/invites leaderboard`
  (`src/feature/invites/command/invites/sub/leaderboard.command.ts`) now
  calls `LeaderboardManager.getLeaderboard(LeaderboardId.Invites).getPage(guildId, 1)` over `page.rows` (replacing
  the old `rows.slice(0, 10)`); `InvitesService.leaderboard` and its
  `InviteLeaderRow` type were deleted. The command keeps its
  `invitesService.canTrack` footer.

No new commands in this work. A future generic `/leaderboard <kind>`
command would resolve the board from the registry and is a separate task.

## 8. Out of scope

- Rendering: embeds, names, pagers are command-layer concerns. The service
  returns plain data. (`attachPager` in `src/lib/pagination.ts` already
  exists and can wire multi-page rendering later.)
- Caching of any kind, Redis, or in-memory ranking.
- New tables. Phase 1 needs none; phase 2 needs at most new indexes.
- The `GuildLeaderboard` concrete board: the tier exists, the metric does
  not (there is no per-guild score table yet).

## 9. Phases

1. **Foundation** (done)
   - `src/leaderboard/leaderboard.ts`: types + abstract `Leaderboard<T>`.
   - `src/leaderboard/user-leaderboard.ts`, `guild-leaderboard.ts`: entity
     tiers with the shared mechanics.
   - `src/leaderboard/impl/level-leaderboard.ts`: `LevelLeaderboard` (Shape A).
   - `src/leaderboard/index.ts`: registry.
2. **Cutover** (done)
   - `/levels leaderboard` reads through `LevelLeaderboard`;
     `LevelsService.leaderboard` and `rankAndTotal` deleted.
   - `/invites leaderboard` reads through `InviteLeaderboard`;
     `InvitesService.leaderboard` deleted.
3. **Event-shape boards** (done)
   - `MessageLeaderboard`, `InviteLeaderboard`, `VoiceLeaderboard`
     (Shape B), plus the `(guild_id, user_id)` index migration
     (`drizzle/0024`).
4. **Later (separate task)**
   - Generic `/leaderboard <kind>` command over the registry, with
     `attachPager` for multi-page results.

## 10. Verification

- `bunx tsc --noEmit` and `bunx prettier --write .` after each phase;
  `bun test` passes (11 tests, pure logic).
- No DB test infrastructure exists (the only test file is pure-logic,
  `src/permission/permissions.test.ts`), so the service was verified with a
  throwaway `bun` script against the running Postgres 18
  (`docker compose up -d`), seeding a scratch guild and four users:
  - `getPage`: ordering with ties broken by `id asc`, `pageCount`,
    clamping of page and `pageSize`, empty-guild page,
  - `getPosition`: top user, tied user (shared position), unknown user
    (`position: null`, `row: null`, `total` still correct),
  - `total` matches the seeded group count, per board,
  - event boards: absent user (null position), invite attribution
    (null-inviter rows excluded), voice sum over completed sessions only
    (open sessions excluded).
- All 21 checks passed; the scratch rows were cleaned up afterwards.

## 11. Open questions

- Default page size 10 (current behaviour) vs a different constant?
- Global user boards (cross-guild ranking) are possible via the
  overridable `scope` on `UserLeaderboard`, but no board uses it yet;
  keep the scope parameter uniform (`"global"` string) or allow `null`?
- When the first `GuildLeaderboard` arrives, what is the per-guild metric
  (total XP awarded, message volume, active users)? It determines whether
  a new aggregate table is needed.
