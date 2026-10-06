# Reminders Plan

A global, user-scoped reminder feature. A member schedules a message for their
future self with `/reminder set`, choosing whether it lands in their DMs or in
the channel they ran the command in. One process-wide interval sweeps every 30
seconds for due rows and delivers them. There is **no per-guild state**: one
`reminders` table, keyed by a single auto-incrementing id, shared across every
guild the bot is in.

## 1. Model

### What a reminder is

A reminder is a one-shot, user-owned message with an absolute delivery time.
The user supplies two things at creation, both **required**: the **text**
(`about`) and the **delay** (`time`, e.g. `2h`, `1d30m`, `90s`). The delay is
resolved to an absolute `remind_at` timestamp **at set time** and that timestamp
is what is stored. Nothing about "when" lives in memory afterwards, so a restart,
a redeploy, or a crash cannot lose or shift a reminder: the due condition is a
row predicate, not a timer.

The delivery **target** is resolved at set time too, and stored as a concrete
`channel_id`:

| Where it was run              | `dm` resolved | `channel_id` stored                |
| ----------------------------- | ------------- | ---------------------------------- |
| a guild channel               | false         | that channel                       |
| a guild channel, `dm:true`    | true          | the bot's DM channel with the user |
| a DM (user install or bot DM) | true          | that DM channel                    |

`dm` is therefore **inferred, not required**: it defaults to the channel the
command was run in, and the option only ever moves a guild reminder into the
DMs. **In a DM it is always `true`**, whatever the option says: there is no
other channel to post into, so the DM the command arrived in _is_ the target,
and recording `dm:false` there would only make `/reminder list` describe the
destination wrongly. The resolution is one expression:

```ts
const inDm = ctx.channel?.isDMBased() ?? false;
const dm = inDm || (args.boolean("dm") ?? false);
```

Storing the resolved channel for every case is what keeps the sweep branch-free:
it always fetches `channel_id` and sends, whether that id is a DM or a guild
channel. `dm` is kept as a display hint so `/reminder list` can say "DM" without
a channel fetch.

### Global, not per guild

Reminders are **not** scoped to a guild and are **not** gated by a per-guild
feature toggle. A member's reminders follow them across servers: a DM reminder
created while chatting in guild A still fires while they are in guild B, and
`/reminder list` shows the same set everywhere. That is the reason the table has
no `guild_id` column and no composite key: the owning user is the only scope.

The feature is registered with `toggleable: false` (like `General`), which is
what keeps it always-on: `GuildFeatures.isFeatureEnabled` short-circuits to
`true` for a non-toggleable feature, so no stored row can disable it and it never
appears in `/feature`.

### Lifecycle

```
   /reminder set about:"take the bins out" time:2h dm:false
   ├── parseDuration("2h") -> 7_200_000 ms, bounds-checked
   ├── resolve target channel (this channel, or openDmChannel() when dm:true)
   ├── INSERT ... RETURNING id                    -> "#7", reply with the id
   └── row waits in `reminders`

   every 30s, the sweep:
   ├── DELETE FROM reminders WHERE remind_at <= now() RETURNING *   (atomic claim)
   └── for each claimed row: fetch channel, send the reminder embed
```

The row is **removed by the same statement that selects it**. `DELETE ...
RETURNING` is the claim, so two sweeps can never hand the same row to two
sends, and there is no `status` column to keep in sync. A delivered reminder is
simply gone.

## 2. Data model

### `reminders` (`src/db/schemas/reminders.ts`)

| Column       | Type                                      | Notes                                          |
| ------------ | ----------------------------------------- | ---------------------------------------------- |
| `id`         | serial, PK                                | Global auto-increment; this is the reminder ID |
| `user_id`    | text, not null, FK `global_users` cascade | Owner; matches every other user table          |
| `channel_id` | text, not null                            | Resolved delivery target (DM or guild channel) |
| `dm`         | boolean, not null                         | Display hint for `/reminder list`              |
| `about`      | text, not null                            | The reminder text                              |
| `remind_at`  | timestamp with tz, not null               | Absolute delivery time, computed at set time   |
| `created_at` | timestamp with tz, not null default now   | When it was set                                |

PK `id`, plus a plain index on `remind_at` for the sweep's predicate.

```ts
// src/db/schemas/reminders.ts
import { boolean, index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";

export const remindersSchema = pgTable(
  "reminders",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    dm: boolean("dm").notNull(),
    about: text("about").notNull(),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index("reminders_remind_at_idx").on(table.remindAt)]
);

export type ReminderSchema = typeof remindersSchema.$inferSelect;
```

**Why `serial` and not `bigserial`.** The id is user-facing and is passed back
in through `/reminder delete id:<n>`, and a Discord integer option is a signed
32-bit value. `serial` (int4) is exactly that range, so an id the bot hands out
is always an id the delete option can carry back. The 2.1B ceiling is
unreachable for a feature whose rows are deleted on delivery, so nothing is
gained by `bigserial` except a value that could not round-trip through the
option.

**Why `remind_at` and not a stored delay.** A stored delay would need
`created_at + delay` recomputed on every sweep and would silently re-arm if the
row were ever rewritten. An absolute timestamp is the domain's own type, is
what the index is on, and is what makes the due check a single comparison.
`{ withTimezone: true }` matters: a `timestamp without time zone` would make
`now()` comparisons depend on the session time zone.

**Why `dm` is stored even though `channel_id` already encodes the answer.**
Reading it back costs nothing and lets `list` render "DM" vs `<#channel>`
without fetching the channel. It is a denormalised hint, not a second source of
truth: nothing reads `dm` to decide _where_ to send, only how to _describe_ the
destination.

### Service (`reminder.service.ts`)

No cache; every read hits the DB, matching `LevelsService`, `InvitesService`,
and `birthdayService`.

```ts
create(userId, channelId, dm, about, remindAt): Promise<Reminder>  // INSERT ... RETURNING
remove(id, userId): Promise<boolean>                              // scoped DELETE, true when a row went
clear(userId): Promise<number>                                    // DELETE ... RETURNING, count
list(userId): Promise<Reminder[]>                                 // ORDER BY remind_at ASC
claimDue(now): Promise<Reminder[]>                                // DELETE ... WHERE remind_at <= now() RETURNING
```

`remove` and `clear` put the ownership check **in the predicate**
(`where(and(eq(id, id), eq(userId, userId)))`), so a member can never delete
another member's reminder and a wrong id is indistinguishable from a foreign
one: both report "not found". Nothing is read first and compared in memory.

`claimDue` is the whole sweep's read _and_ its write:

```sql
DELETE FROM reminders WHERE remind_at <= $1 RETURNING *;
```

Because the delete is the select, an overlapping sweep (the interval can fire
again while a slow send is still in flight) can only ever see rows the other
sweep did not claim. This is the same "the SQL predicate is the source of
truth" shape as the atomic claim in `src/user/guild-users-manager.ts`.

`reminder-sweep.ts` holds the delivery, not the service, because it builds
embeds and `lib/embed.ts` imports `discordClient` from `src/index.ts`; keeping
embeds out of the DB module mirrors `birthday-sweep.ts` and `LevelsFeature`.

## 3. Commands

`/reminder` is a parent command with four subcommands and therefore no
executable body of its own (Discord always sends a subcommand). It is
`userInstallable`, so it is registered for guild **and** user installs and works
in DMs; no handler touches `ctx.guild`, so a DM context is fine.

```ts
// src/feature/impl/reminders/command/reminder/reminder.command.ts
export default class ReminderCommand extends Command {
  constructor() {
    super({ id: "reminder", displayName: "Schedule a reminder for yourself" });
    this.registerSubCommand(new SetCommand());
    this.registerSubCommand(new DeleteCommand());
    this.registerSubCommand(new ClearCommand());
    this.registerSubCommand(new ListCommand());
  }

  public override get userInstallable(): boolean {
    return true;
  }
}
```

No new permission flag: every subcommand is self-service and open, exactly like
`/birthday`. `requiredFlags` stays at the default `0n`, so anyone can use it in
any guild, and the commands are the same in DMs.

### `/reminder set about:<text> time:<duration> [dm:<boolean>]`

| Option  | Type    | Required | Notes                                                               |
| ------- | ------- | -------- | ------------------------------------------------------------------- |
| `about` | string  | yes      | The reminder text                                                   |
| `time`  | string  | yes      | Relative duration, parsed by `parseDuration`                        |
| `dm`    | boolean | no       | Inferred; forced `true` in a DM, otherwise defaults to this channel |

```ts
public override get options() {
  return [
    stringOption(true, "about", "What to remind you about"),
    stringOption(true, "time", "How long from now, e.g. 30m, 2h, 1d30m"),
    booleanOption(false, "dm", "Send it as a DM instead of in this channel"),
  ];
}
```

Only `about` and `time` are required; `dm` is an override, not a third thing the
user must answer. Read it with the `args` bag so the omitted case is an explicit
`null` rather than an assertion:

```ts
const inDm = ctx.channel?.isDMBased() ?? false;
const dm = inDm || (args.boolean("dm") ?? false);
```

Handler:

1. `const ms = parseDuration(ctx.options.getString("time", true))`.
2. Reject `null` (unparseable) and anything outside `[1m, 3 months]`, expressed
   with `TimeUnit.Minute` and `TimeUnit.Month` so the bounds are written in the
   same units `parseDuration` accepts. The one-minute floor keeps the
   confirmation readable before delivery and comfortably exceeds the 30-second
   sweep. The ceiling is a guard against a typo like `100w` quietly booking a
   reminder for two years out; note that `TimeUnit.Month` is 30 days, so
   "3 months" is 90 days.
3. Trim `about`, then reject it when empty and when longer than 300
   characters. The trim makes a whitespace-only reminder impossible; Discord
   only requires one character, so `"   "` would otherwise pass and store a
   blank reminder. The cap is not about the option: Discord's limit for a string
   option is far larger, and the option helpers in `src/command/option.ts` carry
   no `maxLength`. It is sized so a **full page of `/reminder list` fits one
   embed**. Discord caps an embed description at 4096 characters; a row's markup
   (`**#id** · <t:…:R> · <#channel>` and the newline) is at most 61 characters,
   so 10 rows of 300 come to 3618 and 10 rows of 350 would already be 4118. The
   check is a plain comparison in the handler rather than an extension to the
   shared option shape for one command, and because the cap lives on the stored
   value, `list` renders each `about` in full rather than truncating it.
4. Resolve `dm` as above: `true` whenever the invocation is in a DM, otherwise
   whatever the option says, defaulting to `false` (this channel).
5. Resolve the target: in a DM it is `ctx.channelId` (the DM itself); otherwise
   `dm` ? `openDmChannel(user.discordUser)?.id` : `ctx.channelId`. In a DM
   context the channel is already known, so no DM is opened. `openDmChannel`
   (`src/lib/dm.ts`) wraps `User.createDM()` and returns `null` instead of
   throwing when the user does not accept DMs from the bot, so the command can
   reply with a real message; the util needs no `DirectMessages` intent, which
   only gates _receiving_ DMs.
6. `reminderService.create(user.id, …)`. No extra `GlobalUsersManager.getUser`
   call: `CommandManager` resolves the caller before dispatch, so the
   `global_users` row the foreign key needs already exists.
7. Reply with a card: title `⏰ Reminder Set`, a description holding the
   relative timestamp and the destination followed by the text as inline code,
   and the reminder id appended to the shared footer (`Arona · /reminder · #7`)
   instead of repeated in the description. The footer is where the id belongs:
   it is reference data the other subcommands take as input, so it stays out of
   the way of the message itself. When `dm` came from the DM context rather than
   the option, the wording says "here" instead of claiming a choice the user
   never made. When `dm` was asked for and the DM could not be opened
   (`channelId` is `null`), the command stops before the insert and replies with
   an error embed.

Replies are **not** ephemeral: the feature uses no `MessageFlags.Ephemeral`, so
an error is a plain `errorEmbed` reply rather than `ephemeralErrorReply`.

### `/reminder delete id:<n>`

| Option | Type    | Required | Notes           |
| ------ | ------- | -------- | --------------- |
| `id`   | integer | yes      | The reminder id |

```ts
public override get options() {
  return [integerOption(true, "id", "The reminder id, from /reminder list", 1)];
}
```

`remove(id, user.id)` decides everything: a `true` replies "Reminder #n
deleted", a `false` replies "You have no reminder #n" with an error embed. The
same message covers "does not exist" and "belongs to someone else", so the
command cannot be used to probe for other members' reminders.

### `/reminder clear`

No options. `clear(user.id)` returns the number of rows removed and the reply is
"Deleted N reminder(s)". No confirmation button: the operation is bounded to
the caller's own reminders, and the count in the reply is the receipt.

### `/reminder list`

No options. `list(user.id, page)` returns one page of the caller's pending
reminders, soonest first, rendered into an embed:

```
#7  ·  in 2 hours   ·  #general
take the bins out

#8  ·  in 3 days    ·  DM
renew the domain
```

Paging reuses the existing framework rather than a hand-rolled cap: the service
returns a `Page<Reminder>` via `loadPage`, and the command attaches `attachPager`
under the `reminder-list` namespace, exactly like `/birthday upcoming`. The
count and the `LIMIT`/`OFFSET` window happen in Postgres, so a member with a
thousand reminders still reads one page per press. The id is the first thing on
each line because it is the only value the other subcommands need. Each `about`
is rendered in full, which is safe because the stored value is capped at 300
characters (§3) rather than because the render truncates it.

## 4. Delivery: the 30-second sweep

### Why `setInterval` and not `Bun.cron`

`Bun.cron` takes a **standard 5-field** expression (minute granularity) and
rejects anything with a seconds field, so "every 30 seconds" is not expressible
as a cron schedule. The sweep is therefore a `setInterval(…, 30_000)`, armed
from `BotReadyEvent` and cleared before re-arming, exactly like
`PresenceListener` (`src/lib/presence.ts`) and `VictoriaMetricsExporter`
(`src/metrics/exporter.ts`):

```ts
// src/feature/impl/reminders/index.ts
const SWEEP_INTERVAL_MS = 30_000;

export default class RemindersFeature extends Feature {
  private timer: Timer | undefined;

  constructor() {
    super(FeatureIds.Reminders, { toggleable: false, name: "Reminders", emoji: "⏰" });
    this.registerCommand(new ReminderCommand());
  }

  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    clearInterval(this.timer);
    this.timer = setInterval(() => void runReminderSweep(event.client), SWEEP_INTERVAL_MS);
  }
}
```

Started from the ready event rather than at construction so the sweep takes its
`Client` from the event instead of importing `discordClient` from
`src/index.ts`, which would re-enter the import graph mid-initialization. A
`setInterval` handle is per-process, so it is re-armed on every ready and the
previous one is cleared first, so a second ready cannot register a duplicate
sweeper.

Latency is bounded by the interval: a reminder is delivered within 30 seconds of
its `remind_at`. That is the trade for not running one timer per reminder.

### Handler (`reminder-sweep.ts`)

```ts
export async function runReminderSweep(client: Client, now: Date = new Date()): Promise<void> {
  let due: Reminder[];
  try {
    due = await reminderService.claimDue(now);
  } catch (error) {
    console.error("Reminder sweep failed to claim due reminders:", error);
    return;
  }
  for (const reminder of due) {
    try {
      await deliver(client, reminder);
    } catch (error) {
      console.error(`Failed to deliver reminder #${reminder.id}:`, error);
    }
  }
}
```

`deliver` fetches the stored channel and sends:

```ts
const channel = await client.channels.fetch(reminder.channelId);
if (!channel?.isSendable()) {
  console.warn(`Reminder #${reminder.id} target ${reminder.channelId} is gone; dropping it.`);
  return;
}
await channel.send({
  content: reminder.dm ? undefined : `<@${reminder.userId}>`,
  embeds: [/* baseEmbed("reminder") + about + createdAt + id */],
});
```

`isSendable()` covers the deleted-channel, revoked-access, and wrong-type cases
in one check. A channel reminder mentions the owner (that is the point of
choosing a channel over a DM); a DM reminder does not, because a self-mention in
your own DM is noise.

Never rejects. A rejected promise out of a `setInterval` callback is an
`unhandledRejection`, and this process has no handler for one, so the whole
body is guarded and each row is isolated, mirroring `runBirthdaySweep`.

## 5. Wiring

- `src/db/schemas/reminders.ts` is added and registered in the aggregate
  `schema` object in `src/db/index.ts`; without that entry
  `drizzle-kit generate` would emit a `DROP TABLE` for it.
- `FeatureIds.Reminders = "reminders"` is added to `src/feature/feature-ids.ts`.
  The enum's header comment says "every toggleable feature", but `General` is
  already in it and non-toggleable, so a second always-on id does not change the
  enum's contract; `/feature` and the toggle UI filter on `feature.toggleable`,
  not on membership.
- `new RemindersFeature()` is added to `FeatureManager` in `src/feature/index.ts`.
- No settings module: there is nothing per-guild to configure, which is the
  point of the feature being global.
- No new event: reminders are produced by a command and consumed by a timer, so
  nothing is added to `src/event/`.

## 6. Files

```
src/db/schemas/reminders.ts              new table + row type
src/db/index.ts                          import + add to aggregate schema object
drizzle/00NN_reminders.sql               generated: bunx drizzle-kit generate --name=reminders

src/feature/feature-ids.ts               + Reminders = "reminders"
src/feature/index.ts                     + new RemindersFeature() in FeatureManager

src/lib/dm.ts                            openDmChannel(): DM resolve helper (§3)

src/feature/impl/reminders/
├── index.ts                    RemindersFeature + 30s interval (§4)
├── reminder.service.ts         DB reads/writes (§2)
├── reminder-sweep.ts           due-row delivery (§4)
└── command/reminder/
    ├── reminder.command.ts     parent, subcommands only (§3)
    └── sub/
        ├── set.command.ts
        ├── delete.command.ts
        ├── clear.command.ts
        └── list.command.ts
```

The delay parsing and the relative-timestamp rendering both reuse
`src/lib/time.ts` (`parseDuration`, `discordTimestamp`), and opening a DM
reuses `src/lib/dm.ts` (`openDmChannel`, which mirrors `fetchGuildMember`'s
resolve-or-`null` shape), so no new time or DM logic is introduced.

## 7. Edge cases and decisions

- **Bot offline at `remind_at`.** The reminder is late, not lost. Because the
  due check is `remind_at <= now()`, the first sweep after boot claims every
  overdue row at once and delivers them. This is the opposite of the birthday
  sweep's missed-night behavior and is deliberate: a reminder has exactly one
  correct recipient and no daily anchor, so catch-up is unambiguous.
- **Sweep overlap.** A slow batch can still be sending when the next 30-second
  tick fires. The claim-by-delete makes that safe rather than needing a guard:
  each row is handed to exactly one sweep.
- **Delivery failure is terminal.** If the DM channel cannot be opened, the
  channel is deleted, or the send is rejected, the row is already gone and the
  reminder is dropped with a log line. A retry queue would need a status column,
  a backoff, and a policy for a permanently un-sendable target; for a
  self-service reminder the simple rule ("one attempt, then log") is the agreed
  scope. See open questions.
- **Deleting a guild channel** leaves the reminder row until it is due, at which
  point the fetch fails and the row is dropped. The row is not cleaned up at
  channel-delete time because no channel-delete event is wired and the stale row
  is harmless.
- **Target channel is a DM the user closed.** Discord DM channels are stable
  ids; a closed DM is re-openable, so a DM reminder still lands.
- **`dm:false` (or omitted) in a DM.** Ignored: the resolved `dm` is forced
  `true` and the target is the DM the command arrived in. There is no channel to
  fall back to, and reporting the destination as a channel would be a lie in
  `/reminder list`. The option is only meaningful in a guild, where it is the
  difference between this channel and the DMs.
- **`dm:true` when the user install is used in a guild.** The reminder goes to
  the bot's DM channel with that user, not the guild: `openDmChannel` resolves
  the bot-user DM regardless of where the command was invoked.
- **The user leaves the guild** a channel reminder was set in. The row is keyed
  on the user, not the guild, so it survives; delivery fails only if the bot
  also lost access to that channel.
- **Very short delays.** The one-minute floor is enforced at set time, so the
  earliest a reminder can land is the first sweep after it comes due: 60 to 90
  seconds out. Below a minute the confirmation and the reminder would race,
  since the sweep only looks every 30 seconds.
- **`about` length.** Capped at 300 characters, sized so a full 10-row page of
  `/reminder list` stays inside Discord's 4096-character embed description
  (§3). Because the cap is enforced at set time on the stored value, the list
  renders each `about` in full; there is no per-row truncation to keep in sync
  with the page size. The check exists in the handler because the shared option
  helpers do not expose `maxLength`; raising the cap means re-checking the page
  arithmetic, since 350 already overflows a page.
- **Whitespace-only `about`.** Trimmed before the empty and length checks, so a
  reminder that would render as a blank card cannot be stored. Discord's own
  minimum-length rule only requires one character, which a run of spaces
  satisfies.
- **The user blocks DMs from the bot.** `openDmChannel` returns `null`, so
  `/reminder set … dm:true` replies "I could not open a DM" and stores nothing.
  Only the DM path can fail this way; a channel reminder never needs a DM.
- **Id reuse.** Never. `serial` is a sequence, so deleting a reminder does not
  free its number, and an id shown in an old `/reminder list` can never be
  mistaken for a new reminder.
- **Feature disable.** There is no way to disable reminders per guild, by
  design: they are not a guild feature. Removing the feature entirely would mean
  deleting the `RemindersFeature` registration, which stops the sweeper; rows
  would stay until the feature is re-registered.

## 8. Open questions

- **Retry policy for failed deliveries.** A `status` column plus an attempt
  counter would let a transient Discord error retry on the next tick. Not
  implemented; "one attempt, then log" is the agreed scope.
- **Recurring reminders.** Every row is one-shot. A `repeat_every` interval
  would turn `claimDue` from a delete into an update-and-reschedule, and would
  need a policy for the bot being offline across several occurrences (deliver
  once, or once per missed occurrence). Deferred.
- **Absolute timestamps.** `/reminder set` accepts relative durations only.
  Supporting `2026-10-07 09:00` would need a parser and a timezone rule
  (assume UTC, or accept a timezone option). The stored `remind_at` is already
  absolute, so this is a command-layer change only.
- **Snooze.** A "snooze" button on the delivered embed would need the message to
  carry a custom id and a short-lived collector, plus the reminder id, which is
  already in the embed. Cheap to add later; nothing in the schema blocks it.
- **Delivery audit.** Nothing records that a reminder fired. If that is ever
  wanted (for support or metrics), it is a separate append-only table, not a
  column on `reminders`, since the row is deleted at delivery.

## 9. Verification

- `bunx prettier --write` on the changed files.
- `bunx tsc --noEmit` with zero errors.
- `bun test` (the existing suite; no new unit tests are required, since the
  delay parsing is the already-covered `parseDuration` and the bounds check is a
  three-line comparison in the handler).
- `bunx drizzle-kit generate --name=reminders` produces the migration, and a
  second run reports "No schema changes", confirming the table is picked up from
  `src/db/schemas/` and registered in the aggregate schema object.
- Confirm the generated DDL declares `id serial PRIMARY KEY`,
  `remind_at timestamp with time zone NOT NULL`, and
  `CREATE INDEX "reminders_remind_at_idx" ON "reminders" ("remind_at")`.
- Manual: `/reminder set about:"test" time:2m` in a channel, confirm the
  confirmation with the id, and that the pinged delivery arrives within 30
  seconds of coming due; also confirm `time:30s` and `time:20w` are both
  rejected; repeat with `dm:true` and confirm it arrives as a DM with
  no mention; run it in a DM with `dm` omitted **and** with `dm:false` and
  confirm both store `dm = true` and deliver to that DM; set `about` at 301
  characters and confirm it is rejected, then at 300 and confirm 10 such
  reminders on one page still render (3618 of 4096 characters); with DMs from
  the bot disabled, confirm `dm:true` replies "I could not open a DM" and stores
  nothing; `/reminder list` shows pending rows, their ids, and "DM" vs
  `<#channel>`; `/reminder delete id:<n>` removes one and a second attempt
  reports "no reminder #n"; `/reminder clear` empties the rest; stop the process
  across a due time and confirm the reminder is delivered on the first sweep
  after boot.
