# Levelling System Plan

A per-guild levelling feature for Shiroko. Users earn XP from guild activity
(messages, voice time), level up along a configurable curve, and unlock
rewards at milestone levels. Built as a **consumer of the stats feature's
derived events**. Levelling never touches the discord.js gateway directly.

## 1. Model

### XP sources (all via the event bus)

| Source  | Event consumed                        | XP rule                                                     |
| ------- | ------------------------------------- | ----------------------------------------------------------- |
| Message | `MessageRecordedEvent` (from stats)   | Flat `messageXp` per message, gated by a per-guild cooldown |
| Voice   | `VoiceSessionEndedEvent` (from stats) | `voiceXpPerMinute` × whole minutes, awarded at session end  |

Bots and webhooks never reach the bus (filtered in `event-bridge.ts`), so XP
is inherently human-only. The stats listeners already emit
`MessageRecordedEvent`; **`VoiceSessionStarted/EndedEvent` are currently
defined but never posted. Emitting them from the stats service is part of
this work.**

### Level-up detection

XP is **cumulative**. After each grant:

1. The service recomputes the level from the cached/new XP total under the
   current curve (see §3).
2. Every level crossed ≥ the old level emits one `LevelUpEvent`
   (`prevLevel`, `newLevel`, `guild`, `userId`).

Role rewards subscribe to `LevelUpEvent` and grant **all** unlocked reward
roles, so the config can be edited without missing earlier milestones.

### Rewards

`level_rewards` is reward-type agnostic from day one:

- `(guild_id, level)` primary key; one reward row per level.
- `type` is an enum stored as text; only `Role` is implemented now. Future
  types (currency, items, titles) add a discriminated row, not a new table.
- For `Role` rewards, `role_id` is the Discord role to grant on level-up.
  Role assignment only ever happens **in the guild** via
  `member.roles.add`; failure (deleted role / missing permission) is logged,
  never fatal.
- **No un-granting**: levels don't go down, so rewards are never removed.

### Per-guild configuration

One `level_config` row per guild:

| Setting                    | Default | Notes                                                   |
| -------------------------- | ------- | ------------------------------------------------------- |
| `curve`                    | normal  | `normal` / `easy` / `hard`; selects preset              |
| `message_xp`               | 10      | XP per eligible message                                 |
| `message_cooldown_seconds` | 60      | Seconds between XP-granting messages (min 10, enforced) |
| `voice_xp_per_min`         | 5       | XP per whole minute of voice                            |
| `ignored_channel_ids`      | `[]`    | Channels (e.g. `#bots`) that never grant XP             |
| `announce_channel_id`      | `null`  | Channel for level-up announcements (null = none)        |

## 2. XP curves

A curve is one quadratic function: `xpForLevel(l) = a·l² + b·l + c`, with
pure helpers `levelForXp` (inverse) and `xpForNext` (delta to the next
level). All presets use `c = 0` so a new user starts at level 1 with 0 XP;
the first level-up lands after a few messages, not a long silent stretch.
Three presets:

| Curve  | a   | b   | c   | XP to L2 (delta) | Relative pace |
| ------ | --- | --- | --- | ---------------- | ------------- |
| normal | 5   | 50  | 0   | 55               | 1×            |
| easy   | 3   | 30  | 0   | 33               | ~0.6× (fast)  |
| hard   | 8   | 80  | 0   | 88               | ~1.6× (grind) |

```
    total XP
      │           hard ─────────────
      │        normal ───────
      │     easy ───
      └──────────────────────────────▶ level
```

## 3. Data model

### Per-guild user (`guild_users`)

One row per user per guild (`guild_users`), wrapping a `global_users`
row: `lastMessageAt` (`last_message_at`) is the timestamp of the user's
most recent message, gating the message-XP cooldown. Row creation is
idempotent (`INSERT ... ON CONFLICT DO NOTHING`).

### Level snapshot (`UserLevelSnapshot`)

`{ level, xp, curve }` derived **fresh from `user_levels` on every read**
under the guild's current curve. There is **no in-memory cache and no
stored level column**; the level and curve always travel with the xp
total, so a read never mixes a stale curve with a fresh total.

- **Read**: `LevelsService.getLevel` reads `user_levels` + `level_config`
  straight from the DB on every call.
- **Write** (`grantXp`): upserts `user_levels` in one statement and
  derives the level from the returned total under the current curve.
  Message grants additionally stamp `guild_users.last_message_at`.
- **Config** (`getConfig`/`setConfig`): **not cached**; read straight from
  `level_config` on every request.
- **Schema changes**: `bunx drizzle-kit generate` evolution, no backfill
  needed.

Invariant: **`level` is always derived from `xp` under the current curve**;
a read never mixes a stale curve with a fresh total because the level,
xp, and curve ship together (as a single snapshot), and every read
re-derives from the DB.

## 4. Schema

```ts
// src/db/schema.ts additions
export const guildUsers = pgTable(
  "guild_users",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.userId] })]
);

export const userLevels = pgTable(
  "user_levels",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    xp: integer("xp").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.userId] })]
);

export const levelRewards = pgTable(
  "level_rewards",
  {
    guildId: text("guild_id").notNull(),
    level: integer("level").notNull(),
    type: text("type").notNull(), // "Role" for now
    roleId: text("role_id"), // set for Role rewards
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.level] })]
);

export const levelConfigs = pgTable("level_configs", {
  guildId: text("guild_id").primaryKey(),
  curve: text("curve").notNull().default("normal"),
  messageXp: integer("message_xp").notNull().default(10),
  messageCooldownSeconds: integer("message_cooldown_seconds").notNull().default(60),
  voiceXpPerMin: integer("voice_xp_per_min").notNull().default(5),
  ignoredChannelIds: text("ignored_channel_ids").notNull().default("[]"), // JSON array
  announceChannelId: text("announce_channel_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

`user_levels.userId` FKs to `global_users.id` (cascade delete, matching every
other user-scoped table). `level_rewards` and `level_configs` are guild-scoped,
no user FK.

Migration: `0019_levelling_balance` drops the `user_levels.level` column
(level is always derived from `xp`), adds `level_configs.announce_channel_id`,
and bumps `voice_xp_per_min` default to 5.

## 5. Events

No gateway events are bridged (levelling is a pure bus consumer).

| Event                    | Emitted by    | Consumed by              |
| ------------------------ | ------------- | ------------------------ |
| `MessageRecordedEvent`   | stats         | levelling (message XP)   |
| `VoiceSessionEndedEvent` | stats (newly) | levelling (voice XP)     |
| `LevelUpEvent` (new)     | levelling     | levelling reward granter |

```ts
// src/event/events/level-up.event.ts
export default class LevelUpEvent extends Event {
  public override readonly userId: string;
  public readonly guildData: Guild;
  public readonly prevLevel: number;
  public readonly newLevel: number;
  constructor(options: { userId: string; guild: Guild; prevLevel: number; newLevel: number }) {
    super({ guild: options.guild, userId: options.userId, featureId: FeatureIds.Levels });
    ...
  }
}
```

The bus gates `LevelUpEvent` handlers on `FeatureIds.Levels`, so the whole
levelling pipeline (XP award → level-up → reward grant) is disabled with the
feature toggle.

## 6. Feature & commands

```
src/feature/levels/
├── index.ts                 # LevelsFeature + LevelsListeners (EventBus.subscribe)
├── levels.service.ts        # grantXp / getRankState / leaderboard / config (DB, uncached)
├── user-level-snapshot.ts   # UserLevelSnapshot (immutable level/xp/curve read model)
├── xp.ts                    # pure curve math (xpForLevel, levelForXp, xpForNext, presets)
└── command/
    ├── levels.command.ts    # parent "levels" (reward + curve + voice + message + rank + leaderboard)
    └── sub/
        ├── rank.command.ts
        ├── leaderboard.command.ts
        └── config.command.ts    # admin: reward/curve/voice/message subcommands
```

- `LevelsFeature` registers in `FeatureManager` (in `src/feature/index.ts`),
  with `FeatureIds.Levels = "levels"` in `feature-ids.ts`.
- `LevelsListeners` instantiates once in `src/index.ts`, mirroring
  `StatsListeners`.
- **`/levels`** is admin-gated (`requiredFlags`), guild-only, with
  subcommands, mirroring `/permissions`.
- **`/levels reward`** sets a level's reward role (admin, `Manage Roles`
  checked). **`/levels curve`** picks the preset. **`/levels voice`** and
  **`/levels message`** tune the rates and cooldown. **`/levels rank`** shows
  your (or another user's) level card. **`/levels leaderboard`** shows the
  top XP holders.

## 7. Anti-farm

- **Message cooldown**: `last_message_at` on `guild_users`; a message only
  grants XP once the per-guild cooldown elapses.
- **Ignored channels**: configurable per-guild list (default empty); messages
  there never grant XP. Message content is never inspected (`message_events`
  is metadata-only per `DESIGN.md`), so channel filters are the lever.
- **Bots/webhooks**: already excluded at the bridge.

## 8. Open questions

- **Member departure**: `user_levels` rows cascade-delete with `global_users`
  today. Keeping levels across a ban/rejoin would need dropping the cascade;
  deferred, existing convention wins for now.
- **Announcement format**: level-ups post to a configured channel (via
  `/levels config`). DM-based announcements or per-user opt-out are not
  implemented; `LevelUpEvent` is where those would hook in.

## 9. Design decisions

- **Levels are consumers, not producers**, of gateway events. The stats
  events are the single source of activity truth; disabling levelling never
  affects stats.
- **`level_rewards` is typed** (reward-type discrimininated) even though only
  `Role` exists. Adding currency/item rewards is a new type, not a table.
- **Cached curve + level + xp travel together**; one cache entry, no
  mixed-source reads, no curve recompute on hot paths.
- **No un-granting**: levels are monotonic; rewards only ever add.
- **Failure-tolerant role grants**: a dead role or missing permission logs
  and continues; the level-up is never rolled back.
