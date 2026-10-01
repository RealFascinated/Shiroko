# Birthday Plan

A per-guild birthday feature. Members save their date of birth, the bot posts
an announcement on the day itself, and optionally gives them a temporary role
for it. There are **no per-user timers**: one nightly cron at 00:01 UTC is the
only scheduler and it does all of the work in a single sweep. Built on the
existing feature, settings, and schema conventions.

## 1. Model

### What a birthday is

The **full date of birth** is collected and stored, year included, so age can
be **derived** as well as the anniversary. The date is stored as a real `date`
column and never as loose day/month integers, so one value carries the
anniversary and the birth year together and they can never drift apart.

Age is always computed from the stored date and never stored as its own
column: an age is only correct for one instant, and a stored number would
start drifting the day after a birthday.

One row per `(guild, user)` pair, so a member can save a birthday in each
guild independently. That matches how levels, activity, and invites are
already scoped per guild.

### The daily lifecycle

```
   00:01 UTC sweep for guild G
   ├── remove the birthday role from every member who holds it   (yesterday's)
   ├── grant it to members whose (month, day) is today           (today's)
   └── announce today's members in the announce channel, if configured
```

The role is worn for exactly one day: granted at 00:01, stripped by the next
run. Removal happens **before** the grant in the same pass, so a sweep can
never strip the role it just handed out.

### Why a nightly sweep and not per-user timers

A birthday is a date, not a duration. Nothing needs to happen at second
precision, and "it is their birthday" is a question with one answer per day.
One scheduled pass keeps state in the database and out of memory: there are
no jobs to rebuild on restart, nothing to leak on reload, and the rule is
just "the rows matching today". It also makes the whole feature
restart-safe, since both the role swap and the announcement are derived from
the stored date rather than from a timer that survived since it was set.

## 2. Data model

### `guild_birthdays` (`src/db/schemas/guild-birthdays.ts`)

| Column       | Type                                      | Notes                             |
| ------------ | ----------------------------------------- | --------------------------------- |
| `guild_id`   | text, not null                            | Composite PK with `user_id`       |
| `user_id`    | text, not null, FK `global_users` cascade | Matches every other user table    |
| `birth_date` | date, not null                            | Full date of birth, year included |
| `updated_at` | timestamp with tz, not null default now   | Last write                        |

PK `(guild_id, user_id)`, plus a functional index on the extracted month and
day for the sweep.

```ts
// src/db/schemas/guild-birthdays.ts
export const guildBirthdays = pgTable(
  "guild_birthdays",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    birthDate: date("birth_date", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index("guild_birthdays_month_day_idx").on(
      sql`extract(month from ${table.birthDate})`,
      sql`extract(day from ${table.birthDate})`
    ),
  ]
);

export type GuildBirthdaySchema = typeof guildBirthdays.$inferSelect;
```

**Why one `date` and not `month` + `day` + `year` columns.** A single `date`
is the domain's own type. It stores the birth year with the anniversary in
one value, so there is no way for a year to be missing, stale, or set
inconsistently against its month and day. Postgres also **rejects impossible
dates at the column**: `1998-02-29`, `2001-04-31`, and `1994-13-01` all fail
with `date/time field value out of range`, so a garbage row cannot exist even
if a code path forgets to validate. Three separate integers would each need
their own validation and could still be written as a state that never
occurred.

`{ mode: "date" }` makes drizzle hand the column back as a JS `Date` at UTC
midnight rather than a string, which is what the pure helpers in `lib/date.ts`
expect. Read the components back with `getUTCFullYear`, `getUTCMonth`, and
`getUTCDate`; reading them with local-time getters would shift the date for
any server not on UTC.

The functional index is what keeps the sweep fast while the year stays in the
column:

```sql
CREATE INDEX "guild_birthdays_month_day_idx"
  ON "guild_birthdays" USING btree (
    extract(month from "birth_date"), extract(day from "birth_date")
  );
```

`extract` is `IMMUTABLE` for `date`, so Postgres accepts it in an index, and
the planner uses it for the sweep's predicate (`Index Scan using
guild_birthdays_month_day_idx`, with the extracts as the index condition).
Equalities are handled by the plain primary key. Age needs no index at all:
it is derived from `birth_date` on the rows a query already returns, which is
why a stored `age` column is not needed and would only be another value to
keep in sync.

Add the table to the aggregate `schema` object in `src/db/index.ts`. The file
lives under `src/db/schemas/`, which is the directory `drizzle.config.ts`
points at, so `bunx drizzle-kit generate --name=birthdays` picks it up. A
table declared anywhere else is invisible to `generate`.

### Service (`birthday.service.ts`)

No cache; every read hits the DB, matching `LevelsService` and
`InvitesService`.

```ts
setBirthday(guildId, userId, birthDate): Promise<void>   // upsert on (guild_id, user_id)
removeBirthday(guildId, userId): Promise<boolean>        // true when a row was deleted
getBirthday(guildId, userId): Promise<BirthdayRow | null>
upcoming(guildId, memberIds, now): Promise<UpcomingBirthday[]>  // next 10, sorted by days until
birthdaysOn(month, day, now): Promise<Map<string, Celebrant[]>> // guildId -> celebrants, all guilds
stripRole(guild, userId): Promise<void>                  // on /birthday remove
```

The nightly sweep lives in `birthday-sweep.ts`, not on the service, because
it renders embeds and `lib/embed.ts` imports `discordClient` from
`src/index.ts`: a module on that static import chain would re-enter the graph
mid-initialization. The service stays DB-only, mirroring `LevelsService`.

`upcoming` takes a reference instant rather than a separate month and day, so
"today" cannot disagree with itself within one call; the same applies to
`birthdaysOn`. Each `Celebrant` carries the age they turn today, so the
announcement can render it without the caller reading a birth year.

`birthdaysOn` answers the whole sweep in **one query**. Guilds are grouped in
memory afterwards rather than queried per guild, so the nightly cost is one
round trip plus one round trip per configured guild to read its settings.

## 3. Configuration

Config goes through the generic settings system, so it is edited in
`/settings` under a "Birthdays" category and stored in `guild_settings`. The
feature defines **no config table of its own**.

```ts
// src/feature/impl/birthday/birthday-settings.ts
export interface BirthdaySettingsData {
  roleId: string | null;
  announceChannelId: string | null;
}

export const birthdaySettings = new SettingsModule<BirthdaySettingsData>({
  id: "birthday",
  displayName: "Birthdays",
  featureId: FeatureIds.Birthday,
  defaults: { roleId: null, announceChannelId: null },
  descriptors: [
    { key: "roleId", label: "Birthday role", type: "role", default: null },
    { key: "announceChannelId", label: "Announce channel", type: "channel", default: null },
  ],
});
```

Stored keys are `birthday.roleId` and `birthday.announceChannelId`. The key
is built as `` `${module.id}.${descriptorKey}` ``, so descriptors must stay
camelCase: the levels module's own migration wrote snake_case keys that the
code's camelCase descriptors cannot read (a known bug in that migration, not
a pattern to copy).

Both settings are **independent and optional**:

| `roleId` | `announceChannelId` | Result                                |
| -------- | ------------------- | ------------------------------------- |
| unset    | unset               | nothing happens; the feature is inert |
| set      | unset               | role granted and removed, no message  |
| unset    | set                 | announced, no role                    |
| set      | set                 | announced and role granted            |

Because an unconfigured guild does nothing, the feature keeps the default
`enabled = true`. There is no new permission flag: `/birthday` is
self-service and open, and the config is gated by the existing
`SETTINGS_COMMAND` flag on `/settings` (`requiredFlags` needs no change).

## 4. Commands

`/birthday` is a parent with subcommands, so it declares no options and no
`onExecuteSlash` of its own; Discord always sends a subcommand, and the
parent's handler is never called. It is guild-only, since every row is
guild-scoped, so `userInstallable` stays at its default `false`.

```
src/feature/impl/birthday/command/birthday/
├── birthday.command.ts
└── sub/
    ├── set.command.ts
    ├── remove.command.ts
    ├── view.command.ts
    └── upcoming.command.ts
```

### `/birthday set <day> <month> <year>`

- Three required integer options: `day` (1-31), `month` (1-12), and `year`
  (1900 to the current UTC year), using Discord's native min/max so the
  obvious garbage never arrives. Discord's own upper bound is `Number.MAX_SAFE_INTEGER`,
  so an explicit `max` is required; without it `99999` is a valid option value.
- Validates the combination in code (`31 2` is rejected). One helper,
  `isValidCalendarDate(year, month, day)` (in `src/lib/date.ts`), round-trips through
  `Date.UTC(year, month - 1, day)`: it checks the constructed date's
  `getUTCMonth()` and `getUTCDate()` still match the input, which correctly
  rejects `31 2`, `30 2`, and `29 2` in a non-leap year while accepting
  `29 2` in one. The same rules then apply again at the column (§2).
- **Self only.** There is no `user` option, so nobody can set or change
  another member's birthday. Staff cannot either; there is no override.
- Re-running replaces the stored date (upsert), so `/birthday remove` is
  only needed to opt out entirely.
- Replies **ephemerally**: the value is personal data, and a public
  confirmation would broadcast it to the channel. This is the one deliberate
  departure from "success cards stay public", and it applies to `remove`
  too.
- If the member has not been seen before, resolve them through
  `GlobalUsersManager.getUser` first, so the FK is satisfied.

### `/birthday remove`

Deletes the caller's row. If the member currently holds the birthday role,
it is removed immediately rather than lingering until the next sweep. Reply
ephemeral, and report the stored date that was cleared.

### `/birthday view [user]`

- One optional `user` option, defaulting to the caller, so it doubles as "my
  birthday" and "their birthday".
- Shows the stored month and day and how long until the next occurrence
  (or "today"), or says the member has not saved one.
- **Never shows the birth year**, matching `upcoming`: `getBirthday` returns
  only month and day, so the age stays private until the announcement on the
  day itself. Readable by anyone: the anniversary is already public in
  `upcoming`.
- Public reply, unlike `set`/`remove`: this is a lookup, not a disclosure of
  data the caller just typed.

### `/birthday upcoming`

- Takes no options. Always shows the next 10.
- Reads the guild's rows, drops members no longer in the guild, computes
  days until each next occurrence, sorts ascending, and takes the first 10.
- Shows today's birthdays first, marked as today rather than "in 0 days".
- One embed, **each member mentioned exactly once** per `DESIGN.md`, with the
  date as `14th May` (reuse `ordinal` from `lib/format.ts`).
- Public reply: the list is the shared, opt-in half of the feature.

## 5. Nightly sweep

### Scheduling

`Bun.cron` with the in-process callback overload, pinned to UTC. The scheduler
lives on the feature itself, which is already an `EventListener`:

```ts
// src/feature/impl/birthday/index.ts
const CRON = "1 0 * * *"; // 00:01 daily

export default class BirthdayFeature extends Feature {
  private job: Bun.CronJob | undefined;

  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    this.job?.stop();
    this.job = Bun.cron(CRON, () => runBirthdaySweep(event.client), { tz: "UTC" });
  }
}
```

- Started from `BotReadyEvent` rather than at construction, so the handler gets
  its `Client` from the event and never imports `discordClient` (which would
  create the `src/index.ts` import cycle `lib/embed.ts` already documents).
  This mirrors `PresenceListener`, which also arms its timer on ready.
- The old job is stopped before a new one is registered, mirroring
  `PresenceListener.clearInterval`, so a second ready cannot double-register.
- `tz: "UTC"` makes "today" the UTC date at 00:01 UTC, a single fixed notion
  of the day for every guild. No per-guild timezone setting.
- The instance is created once in `src/index.ts`, beside the other listeners.

### Handler

```
sweep(client):
  { month, day } = todayUtc()
  byGuild = service.birthdaysOn(month, day)            // one query, all guilds

  for guild of client.guilds.cache.values():
    if !GuildFeatures.isFeatureEnabled(guild, Birthday): continue
    roleId = settings.roleId; channelId = settings.announceChannelId
    celebrants = byGuild.get(guild.id) ?? []           // each carries the age they turn

    if roleId:  swapRoles(guild, roleId, celebrants)   // remove all, then add today's
    if channelId && celebrants.length: announce(guild, channelId, celebrants)
```

The announcement names each celebrant once and gives the age they turn, not
the date:

```
🎂 Happy Birthday!
Happy birthday!

@Lee turns 30 today!
@Bray turns 36 today!
```

The date is omitted because it is redundant on the day itself (the channel
already knows what day it is) and because the age is the part people
actually want. The birth year is still never rendered: the service derives
the age and the sweep only ever sees that number.

`swapRoles` removes the role from everyone holding it, then adds it to today's
celebrants.

**The sweep must never reject.** `Bun.cron` surfaces a rejected promise as
`unhandledRejection`, and with no listener installed the process exits with
code 1. Every guild is therefore wrapped in its own `try`/`catch` that logs
and continues, and the top-level body is wrapped as well. One broken guild
must not skip the rest or take the bot down.

Failure rules, mirroring the level-up announcer:

- Missing or deleted role, or a role above the bot's highest: log, keep going.
- Channel not configured, missing, or not sendable (`isSendable()`): log, skip.
- A celebrant who is no longer a member: skip them; the row is left alone.
- Role and announce failures are independent; one never blocks the other.

### Role removal

Removal targets **every member currently holding the configured role**, not
"the users who had a birthday yesterday". Iterating `guild.members.cache`
and filtering removes stale grants from members who left and rejoined,
survives a missed run, and needs no `granted_at` column. The full member
cache is populated and maintained because the client already requests the
`GuildMembers` intent, so this costs no API calls; it is a nightly pass over
the cache, not per-user timers.

Adding the role is `member.roles.add(roleId)` per celebrant, idempotent, so
the grant is safe to repeat.

## 6. Files

```
src/db/schemas/guild-birthdays.ts        new table + row type
src/db/index.ts                          import + add to aggregate schema object
drizzle/00NN_birthdays.sql               generated: bunx drizzle-kit generate --name=birthdays

src/feature/feature-ids.ts               + Birthday = "birthday"
src/feature/index.ts                     + new BirthdayFeature() in FeatureManager

src/feature/impl/birthday/
├── index.ts                  BirthdayFeature + cron handler (§5)
├── birthday-settings.ts      settings module (§3)
├── birthday.service.ts       DB reads/writes (§2)
├── birthday-sweep.ts         nightly sweep (§5)
└── command/birthday/         parent + sub/ (§4)

src/lib/date.ts               pure date helpers (generic, shared)
```

`src/lib/date.ts` holds only pure functions (generic calendar math any feature
can reuse), and is the natural home for a small `bun test` file covering
`isValidCalendarDate` (31/4, 29/2 in leap and non-leap years, 30/2),
`daysUntil` wrap-around across the new year, and `ageInYears` on a birthday
that has not yet occurred this year.

## 7. Edge cases and decisions

- **Leap day.** 29 February is observed only in leap years: the sweep matches
  `(2, 29)` exactly, so in non-leap years there is no announcement, and
  `upcoming` skips to the next leap-year occurrence (four years ahead) rather
  than showing an impossible date. Chosen over rolling to 1 March so that the
  sweep and `upcoming` cannot disagree about when a birthday is.
- **Same day, different dates per guild.** Because rows are per guild, the
  same member can store different dates in different guilds and the bot will
  not notice or object. The per-guild row is the atomic unit of every
  read/grant, so the two guilds can legitimately disagree. That is
  inconsistent data, not a bug, and it is the price of per-guild scoping. It
  is also what makes repointing the feature later (a `user_birthdays` table
  keyed only by user) mechanically cheap.
- **A date set after the sweep already ran today.** The member's birthday is
  not announced and the role is not granted until the next sweep, which is a
  full year away. This is accepted: the sweep is the only moment the feature
  acts, and a same-day catch-up would re-open the idempotency problem in §8.
  `/birthday set` should say so when the date it just stored is today.
- **Missed run.** A process restart spanning 00:01 UTC skips that night. The
  state stays consistent (the role swap is derived from the stored date, so
  the next run repairs it), but the announcement for that day is lost. See
  open questions.
- **Unsetting the role config** leaves any currently granted role in place
  until an admin removes it, because the bot no longer knows which role it
  was granting. Same when the feature is disabled mid-grant.
- **Disabling the feature** stops the sweep for that guild immediately, but
  does not strip roles already granted.
- **Member departure** leaves the row, since the FK cascades from
  `global_users`, not from guild membership. Departed members are skipped by
  both the sweep and `upcoming`.
- **Timezone.** 00:01 UTC means a member in UTC+13 celebrates on the UTC day,
  which can be the previous local day. Accepted, and the reason per-guild
  timezones are listed below rather than built now.

## 8. Open questions

- **Missed-run recovery.** Announcements are not idempotent, so a catch-up
  run on boot would duplicate them. Exact-once would need a per-guild
  `last_run` marker. Not implemented; the simple cron is the agreed scope.
- **Per-guild timezone.** An IANA timezone setting plus an hourly run would
  announce on each guild's local midnight. Real complexity for a feature
  that currently has a fixed UTC day; deferred.
- **February 29 policy.** If "observed on 1 March in non-leap years" is
  preferred, it is a change in one helper plus the sweep's match.
- **What consumes the age?** Nothing in this plan. The stored year is what
  makes an age computable at all (for "turning N today" wording or age-gated
  birthday roles) without another schema change. Until something asks for
  it, nothing renders it.
- **Pruning departed members.** Rows for members who left the guild are kept.
  A member-leave event would let us delete them, but no such event exists
  today and the existing tables keep their rows too.

## 9. Verification

- `bunx prettier --write .`
- `bunx tsc --noEmit` with zero errors.
- `bun test`, including the new `lib/date.ts` cases.
- `bunx drizzle-kit generate` reports "No schema changes" once the migration
  is committed, confirming the table is picked up from `src/db/schemas/`.
- Confirm the generated DDL declares `birth_date date NOT NULL` and creates
  the functional index (verified: `CREATE INDEX ... USING btree (extract(month from "birth_date"), extract(day from "birth_date"))`).
- Manual: set a date in a test guild with both settings configured, confirm
  the announcement and the role, run the sweep again and confirm the role is
  replaced rather than stacked, then `/birthday remove` and confirm the role
  goes with it.
