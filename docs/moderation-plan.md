# Moderation System Plan

A per-guild moderation feature for Shiroko: punishments (`kick`, `ban`,
`tempban`, `unban`, `timeout`, `unmute`), a warning system (`warn`,
`delwarn`, `clearwarns`), message cleanup (`purge`), and a full audit trail
(`history`) backed by a single `moderation_cases` table.

## 1. Model

### Data: `moderation_cases`

One row per moderation action. `id` is a **global incrementing id**, so
cases are unique across guilds and a warning is addressable anywhere as
"case #1234" (`delwarn` takes this id).

| Column        | Type                   | Notes                                            |
| ------------- | ---------------------- | ------------------------------------------------ |
| `id`          | serial / bigserial     | Global incrementing case id, PK                  |
| `guild_id`    | text, not null         | Guild where the action happened                  |
| `user_id`     | text, not null         | Target; FK → `global_users.id`                   |
| `actor_id`    | text, not null         | Moderator who acted; FK → `global_users.id`      |
| `type`        | text, not null         | `kick` / `ban` / `tempban` / `unban` / `timeout` / `unmute` / `warn` / `warn_clear` / `purge` |
| `reason`      | text, not null default `""` | Free text, empty allowed                      |
| `expires_at`  | timestamp with tz, null | Only set for temporary actions (`tempban`, `timeout`) |
| `created_at`  | timestamp with tz, not null default now | When the action happened              |

Index: `(guild_id, created_at desc)` and `(guild_id, user_id)` so `history`
can page newest-first per guild or per user.

`type` stays a text column (enums as text, matching `level_rewards.type`).
Future action types add a string, not a migration.

This table is the **only** moderation state. There is no separate warnings
table: a warning is a case with `type = "warn"`, `delwarn` deletes the row,
`clearwarns` deletes all `warn` rows for a user in a guild, and `history`
just reads the table.

### Why one table for everything

Every action is a row with the same shape: who, whom, what, why, when,
optionally until when. One table means:

- `history` shows bans and warnings in one timeline, newest first.
- `delwarn` is `DELETE WHERE id = ? AND guild_id = ? AND type = 'warn'`. A
  globally unique id also prevents cross-guild misaddresses.
- Temp-ban / timeout expiry is one query: `expires_at <= now`, regardless of
  type.

## 2. Commands

All commands are guild-only, subcommand-free or with a small subcommand
tree where noted. Non-targeting actions we considered and dropped:
`softban` (purge via ban/unban is niche for this bot), custom rank
assignment (belongs to a roles feature, not moderation).

**Each command has its own permission flag.** Nothing is grouped: a role
can hold exactly kick, or exactly purge, or purge + warn, in any
combination. The gate lives on the command's `requiredFlags` (or the
parent's, when the command is part of a family like `/history
warns-config`), exactly like `/level-config` today.

| Command | Permission flag | Options | Behavior |
| ------- | --------------- | ------- | -------- |
| `/kick` | `KICK_COMMAND` | `user`, `reason?` | `member.kick(reason)`, log case. |
| `/ban` | `BAN_COMMAND` | `user`, `reason?`, `delete_days?` (0-7) | `member.ban({ reason, deleteMessageSeconds })`, log case. |
| `/tempban` | `TEMP_BAN_COMMAND` | `user`, `duration`, `reason?` | Ban + set `expires_at = now + duration`, log `tempban` case. |
| `/unban` | `UNBAN_COMMAND` | `user` (mention or **raw ID**), `reason?` | `guild.members.unban(id, reason)`, log `unban` case. |
| `/timeout` | `TIMEOUT_COMMAND` | `user`, `duration`, `reason?` | `member.timeout(ms, reason)`. Discord caps at 28 days; reject longer durations with an error. Log `timeout` case with `expires_at`. |
| `/unmute` | `UNMUTE_COMMAND` | `user`, `reason?` | `member.timeout(null)`; also removes the muted role if role-mutes ever land. Log `unmute` case. |
| `/warn` | `WARN_COMMAND` | `user`, `reason` | Insert a `warn` case. Reply with the case id: "Warning #1234 added". |
| `/history` | `HISTORY_COMMAND` | `user`, optional `page` | Page through the user's cases newest-first, with the same pager as `attachPager`. |
| `/delwarn` | `DEL_WARN_COMMAND` | `case_id`, optional `reason?` | Delete only if `type = "warn"` for that exact id in this guild. The deleted case is logged as a `warn_clear` row so the audit trail keeps a trace. |
| `/clearwarns` | `CLEAR_WARNS_COMMAND` | `user` | Delete all `warn` rows for the user in this guild, log one `warn_clear` case. |
| `/purge` | `PURGE_COMMAND` | `count` (1-100), `user?`, `contains?` | `channel.bulkDelete` with optional filters. If `count` is a hot path, bulk-delete first then filter in memory for `user`/`contains`. Log one case per purge (any target user + reason summarizing filters). |

`duration` parsing: no parser exists in the repo (`src/lib/time.ts` only
has `formatDuration` and `TimeUnit`). Add `parseDuration("2d", "1h30m")` to
`src/lib/time.ts`, returning milliseconds, with a clear error for garbage
input. Shared by `tempban` and `timeout`.

## 3. Enforcement and expiry

### Who can run these

- Discord `Administrator` and the guild owner bypass bot permission checks
  (already the case via `Permissions`).
- **One flag per command**, none grouped. Add eleven flags to
  `PermissionFlags` (next free bits, starting `1n << 4n`):
  `KICK_COMMAND`, `BAN_COMMAND`, `TEMP_BAN_COMMAND`, `UNBAN_COMMAND`,
  `TIMEOUT_COMMAND`, `UNMUTE_COMMAND`, `WARN_COMMAND`, `HISTORY_COMMAND`,
  `DEL_WARN_COMMAND`, `CLEAR_WARNS_COMMAND`, `PURGE_COMMAND`, each with an
  entry in `FLAG_DISPLAY_NAMES`.
- Each command's `requiredFlags` returns its own flag. A role holding only
  `WARN_COMMAND` can warn and nothing else; `PURGE_COMMAND` alone grants
  only purge. Bans, kicks, timeouts, and history reads are all granted
  independently.
- For the `/history` family this means the parent command stays open
  (so `requiredFlags` of `0n` on the parent for `/warn`, `/history` where
  it makes sense) or gates on its own flag; subcommands inherit the
  parent's flag unless they declare their own. The rule from
  `AGENTS.md`/`COMMANDS` applies: a gate usually lives on the parent, and a
  subcommand can override to be stricter, never looser.

### Expired tempbans and timeouts

`expires_at` is written at action time; the bot does not hold timers.
Expiry is enforced lazily, mirroring how nothing else in the repo holds
state in memory:

1. On `BotReadyEvent`, and then every N minutes via the same sweep loop,
   query `SELECT * FROM moderation_cases WHERE expires_at <= now`.
2. For `timeout` rows: `member.timeout(null)` if the member is still
   present and muted.
3. For `tempban` rows: `guild.members.unban(id)` (the ban is permanent in
   Discord; lifting it is simply `unban`).
4. Optionally log an expiry `unban` / `unmute` case so `history` shows the
   full lifecycle. Cheap and makes the timeline honest.

The sweep supplements (not replaces) Discord, which auto-clears timeouts at
the 28-day cap. Idempotency comes free: unbanning an unbanned user and
clearing an already-clear timeout throw errors we catch and log.

A restart loses nothing: `expires_at` is in the DB, and the next sweep
picks up anything that expired while the bot was offline.

## 4. Logging and the event bus

Actions can happen through commands, but the write path should not be
embedded in each command handler. Instead, a `ModerationService` owns all
writes:

- `recordCase(guild, { userId, actorId, type, reason, expiresAt? })` is the
  single insert path. Every command calls this.
- It then posts a `ModerationCaseCreatedEvent` on the bus
  (`src/event/events/moderation-case-created.event.ts`, with a
  `featureId: Moderation` tag). A `ModerationListeners` class consumes it
  and, if configured, posts the case to a mod-log channel.
- The mod-log channel is config (below), one row per guild.

This keeps commands thin: they perform the Discord mutation, call
`recordCase`, and reply. The audit post is a listener concern.

A consistent user-visible shape, following existing result cards:

- Success: `baseEmbed`, title per action ("🚪 Kicked", "🔨 Banned", "⏰
  Timed Out", "⚠️ Warning #1234"), layer-1 line carries the target, layer-2
  carries reason + expiry when present.
- Error: `ephemeralErrorReply(commandName, errorEmbed(...))` when the
  action fails (missing permission, target is the owner, duration past the
  28-day cap, non-existent case id in `delwarn`).

Mod-log posting reads `moderation.mod_log_channel` through the settings
system (`moderationSettings.get(guildId, "modLogChannelId")`); when unset
(no row → default `null`), no post is made.

### The `purge` case shape

`purge` deletes other users' messages and no single `user_id` fits; log
with `user_id` = the target user when filtered, else the actor, `type =
"purge"`, reason summarizing the count and filters ("Deleted 42 messages
containing `discord.gg`").

## 5. Configuration

The moderation feature has no config table of its own. Its settings live
in the global `guild_settings` table (one row per guild per key,
`moderation.mod_log_channel`), read and written through the generic
settings system (`SettingsModule`, `/settings` command). See
`docs/settings-plan.md`; that system's first consumer is levelling
(`level_configs` migration), and the moderation feature follows the same
pattern for its own settings.

Current settings:

| Key | Type | Default | Notes |
| --- | ---- | ------- | ----- |
| `moderation.mod_log_channel` | channel id | null | Where `ModerationCaseCreatedEvent` posts land |

Auto-actions (X warns → timeout, Y → ban) are explicitly deferred: they
need a warn-counter read and a policy table, and add real complexity. The
first version is warnings as a manual, audited layer.

## 6. Structure

```
src/feature/moderation/
  index.ts                    # ModerationFeature (registers commands) + ModerationListeners (mod-log posting)
  moderation.service.ts       # recordCase, listCases, deleteWarn, clearWarns, sweepExpired
  command/
    kick.command.ts           # requiredFlags: KICK_COMMAND
    ban.command.ts            # BAN_COMMAND; tempban separate (TEMP_BAN_COMMAND), see §7
    tempban.command.ts
    unban.command.ts          # UNBAN_COMMAND
    timeout.command.ts        # TIMEOUT_COMMAND
    unmute.command.ts         # UNMUTE_COMMAND
    warn/warn.command.ts      # WARN_COMMAND
    warn/delwarn.command.ts   # DEL_WARN_COMMAND
    warn/clearwarns.command.ts# CLEAR_WARNS_COMMAND
    history/history.command.ts# HISTORY_COMMAND
    purge.command.ts          # PURGE_COMMAND
    sub/                      # shared helpers for the warn family and duration parsing
```

## 7. Command surface decisions (to confirm)

- **`ban` vs `tempban`**: one `/ban` with a `duration?` option (durations
  through `parseDuration`) vs two commands. With per-command flags this
  decides whether a role can hold `TEMP_BAN_COMMAND` without full
  `BAN_COMMAND`. Two commands is the recommendation here: `tempban` is its
  own grant, and an untrusted mod can ban briefly without permanent ban
  power. If merged instead, both actions share one flag.
- **`timeout` vs `mute`**: Discord's native timeout caps at 28 days. `mute`
  naming implies role-based mutes, which we are not building yet.
  Recommendation: `/timeout` now; add role-based mutes later if a use case
  actually appears. `unmute` keeps its name for discoverability and accepts
  a `duration?` too, so "unmute in 2 hours" works.
- **`warn` require reason?** A warning without a reason is noise. Make
  `reason` required on `/warn` and optional elsewhere.
- **`history` under `HISTORY_COMMAND` or open?** Reading history is
  low-risk; a guild may want any mod to see it while only senior mods act.
  Keep it behind `HISTORY_COMMAND` so it can be granted or denied like
  everything else, and a guild can simply grant it to the same roles that
  hold the punishment flags.

## 8. Out of scope (first version)

- Auto-moderation on message content (filters, caps, spam). Discord's
  native AutoMod covers this; revisit only if a use case appears.
- Warn auto-actions at thresholds (§5). Deferred.
- Appeals, DM notifications, case statuses (open/closed).
- Softban (`ban` + immediate `unban`).
- Voice-only mutes: Discord's timeout already silences voice.