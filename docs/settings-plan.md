# Settings System Plan

Generic per-guild configuration for every feature: one global
`guild_settings` table, one `/settings` command, and a components-driven
panel built from typed setting descriptors. Adding a setting is a handful
of lines in a `SettingsModule`; the table, command, and UI are shared.

This plan supersedes `config-panel-plan.md`. The levelling feature is its
**first consumer**: `level_configs` migrates onto `guild_settings` and the
`/level-config` command tree is removed (see §6). The moderation feature
consumes it next for its mod-log channel.

## 1. Goals

- One storage table for all feature config. No per-feature config tables
  going forward; `level_configs` is the first one migrated onto it (§6).
- One `/settings` command that renders an interactive panel: an embed plus
  buttons, select menus, and modals, all driven by descriptors.
- Generic to the core: `SettingsModule<C>` + typed descriptors; the store
  and the UI know nothing about any feature.
- The levelling feature's config moves to this system (data plus
  read/write paths), replacing `level_configs` and `/level-config`. The
  moderation feature reads its settings the same way and defines no config
  table of its own.

## 2. Data: `guild_settings`

Key-value table, one row per (guild, setting). Keys are namespaced
`<feature>.<setting>`, e.g. `moderation.mod_log_channel`.

| Column       | Type               | Notes                                    |
| ------------ | ------------------ | ---------------------------------------- |
| `guild_id`   | text, not null     | Composite PK with `key`                  |
| `key`        | text, not null     | `moderation.mod_log_channel`, etc.       |
| `value`      | jsonb, not null    | Any JSON-serializable value              |
| `updated_at` | timestamp with tz, not null default now | Last write                  |

PK `(guild_id, key)`.

**Why key-value, not one JSON blob per guild:**

- Atomic per-key upsert (`INSERT ... ON CONFLICT DO UPDATE`). A JSON blob
  needs read-modify-write; two concurrent listeners patching different
  settings could clobber each other. Per-key writes never race.
- Defaults live in code; the table holds only overrides. A row's absence
  means "use the default". Resetting a setting is deleting its row.
- Queries are per-key and trivially indexable.

### Store API (`src/settings/guild-settings.ts`)

```ts
export default class GuildSettings {
  /** Read a setting, or null when no row exists (caller falls back to its default). */
  public static async get(guildId: string, key: string): Promise<JsonValue | null>;

  /** Upsert a value; passing null deletes the row (back to default). */
  public static async set(guildId: string, key: string, value: JsonValue | null): Promise<void>;

  /** All rows for a guild, for the panel's overview. */
  public static async all(guildId: string): Promise<Map<string, JsonValue>>;
}
```

No in-process cache, matching `level_configs` reads and the repo's
"read fresh every call" convention.

## 3. Generic settings modules

### Descriptor types (`src/settings/settings-module.ts`)

```ts
export type SettingType =
  | "boolean"
  | "number"
  | "string"
  | "choice"
  | "channel"
  | "role"
  | "duration"
  | "string-list";

/** The setting-value shape each SettingType requires of `C[K]`. */
export type SettingValueMap = {
  boolean: boolean;
  number: number;
  string: string;
  choice: string;
  channel: string | null;   // null = unset
  role: string | null;      // null = unset
  duration: number;         // milliseconds
  "string-list": string[];
};

interface SettingDescriptorBase<C, K extends keyof C, T extends SettingType> {
  key: K;
  label: string;                    // shown in the panel
  description?: string;             // shown under the label
  type: T;
  default: C[K];                    // code-side default
  choices?: T extends "choice" ? Record<string, string> : never;  // "choice" only
  min?: T extends "number" ? number : never;                      // "number" only
  max?: T extends "number" ? number : never;                      // "number" only
  validate?(value: C[K]): string | null;  // error message, or null when valid
  format?(value: C[K]): string;     // display formatting
}

/**
 * A descriptor whose value shape matches `C[K]`. A mismatched pair
 * (`"boolean"` on a `string` key, `"string"` on a `number` key, ...)
 * compiles to `never`, so TypeScript rejects the object literal.
 */
type ValidSettingDescriptor<C, K extends keyof C, T extends SettingType> =
  C[K] extends SettingValueMap[T] ? SettingDescriptorBase<C, K, T> : never;

/** Every valid (key, type) pair for the module's config type `C`. */
export type SettingDescriptor<C> = {
  [K in keyof C]: {
    [T in SettingType]: ValidSettingDescriptor<C, K, T>;
  }[SettingType];
}[keyof C];

export interface SettingsModuleConfig<C> {
  id: string;                       // namespaces keys: "moderation"
  displayName: string;              // "Moderation"
  defaults: C;
  descriptors: ReadonlyArray<SettingDescriptor<C>>;
}
```

`SettingType` and the value shape are linked through `SettingValueMap`, so
the compiler checks the whole descriptor against `C[K]`:

- `key` must be a key of `C`, and `default` / `validate` / `format` are
  typed on that exact `C[K]`.
- `type` must match `C[K]`'s shape. `"channel"` and `"role"` require
  `string | null` (null = unset, so `default: null` type-checks); the
  moderation sample below uses `"channel"` for `modLogChannelId: string |
  null` and passes with zero casts.
- `"choice"` requires `choices`, `"number"` allows `min`/`max`; a stray
  `choices` on any other type is a type error, not a runtime surprise.
- `"duration"` stores milliseconds as a `number`; its `format` renders via
  `formatDuration`, keeping the raw JSON value a plain number.

Every `SettingType` maps to a JSON value: boolean, number, string,
channel/role id strings, durations stored as milliseconds, and `string[]`
for `string-list`. All values are JSON-serializable.

### The module base

```ts
export default class SettingsModule<C> {
  public readonly id: string;
  public readonly displayName: string;
  public readonly defaults: C;
  public readonly descriptors: ReadonlyArray<SettingDescriptor<C>>;

  public constructor(config: SettingsModuleConfig<C>) { ... }

  public async get<K extends keyof C>(guildId: string, key: K): Promise<C[K]> {
    const raw = await GuildSettings.get(guildId, `${this.id}.${key}`);
    return (raw ?? this.defaults[key]) as C[K];
  }

  public async set<K extends keyof C>(guildId: string, key: K, value: C[K]): Promise<void> {
    await GuildSettings.set(guildId, `${this.id}.${key}`, value as JsonValue);
  }
}
```

Consumers read typed values with no casts at the call site:
`moderationSettings.get(guildId, "modLogChannelId")` returns
`string | null`.

### Concrete module (first consumer, levelling)

The levelling config has five settings; each becomes a key under the
`levels` module. All rows migrate from `level_configs` (see §6).

```ts
export interface LevelsSettingsData {
  messageXp: number;                 // defaults: message_xp 10
  messageCooldown: number;           // levels.message_cooldown 60000 (ms)
  voiceXpPerMin: number;             // voice_xp_per_min 5
  ignoredChannelIds: string[];       // ignored_channel_ids []
  announceChannelId: string | null;  // announce_channel_id null
}

export const levelsSettings = new SettingsModule<LevelsSettingsData>({
  id: "levels",
  displayName: "Levelling",
  defaults: {
    messageXp: 10,
    messageCooldown: 60_000,         // ms
    voiceXpPerMin: 5,
    ignoredChannelIds: [],
    announceChannelId: null,
  },
  descriptors: [
    { key: "messageXp", label: "Message XP", type: "number", default: 10, min: 1 },
    {
      key: "messageCooldown",
      label: "Message cooldown",
      type: "duration",
      default: 60_000,               // stored as ms; input "60s"
      min: 10_000,                   // the existing 10s floor
    },
    { key: "voiceXpPerMin", label: "Voice XP per minute", type: "number", default: 5, min: 1 },
    {
      key: "ignoredChannelIds",
      label: "Ignored channels",
      type: "string-list",
      default: [],
      format: ids => ids.map(id => `<#${id}>`).join(", ") || "None",
    },
    { key: "announceChannelId", label: "Announce channel", type: "channel", default: null },
  ],
});
```

Notes:

- `messageCooldown` is a `duration` setting stored as milliseconds
  (`default: 60_000`), not the raw seconds integer; the `min` is `10_000`
  (the existing 10s floor). It migrates from `message_cooldown_seconds`.
- Consumers (`LevelsService`, gender announcement listener, etc.) read
  `levelsSettings.get(guildId, "messageXp")`, `get(guildId,
  "announceChannelId")`, etc. instead of `levelConfigs` rows; values are
  typed with no casts at the call site.
- The `duration` descriptor's `format` renders stored milliseconds via
  `formatDuration` (`"60s"`), keeping the raw JSON value a plain number.

### Registry (`src/settings/settings-manager.ts`)

`SettingsManager.register(module)` collects modules; `/settings` and the
component registry look them up by id. A feature registers its module in
its index constructor, mirroring `registerCommand`. Only modules whose
feature is enabled in the guild appear in the panel.

## 4. `/settings` command

One command, no subcommands; the panel handles navigation. Guild-only,
gated on `SETTINGS_COMMAND` (`1n << 4n`, new entry in
`FLAG_DISPLAY_NAMES`).

`SettingsCommand` lives at `src/settings/command/settings.command.ts` and
is registered the same way `FeatureCommand` is; we mirror that integration
point when wiring it.

### Panel layout

1. `/settings` renders the overview: an embed listing each registered
   module (for enabled features), with one `StringSelectMenu` of module
   names. Navigation stays a select; value editing is dialogs.
2. Picking a module renders its page: the embed lists every descriptor as
   "label: current value" (via `format`), and each descriptor gets one
   button ("✏️ <label>") that opens its **edit dialog** (a modal).
   Editing a value is always a modal: the dialog's custom id carries the
   context (`<moduleId>:<guildId>:<key>:submit`), and each `type` gets the
   ergonomic input inside the modal:
   - `string`: single-line text input, current value pre-filled
   - `number`: single-line text input; `min`/`max` are validated in
     `apply` (modal text inputs have no numeric range), rejected with an
     ephemeral error, panel unchanged
   - `duration`: single-line text input pre-filled with the current value
     (e.g. "2d"), parsed by `parseDuration`; invalid input is an error
   - `channel`: single-line text input accepting a `#mention`, channel
     name, or raw id; resolved against the guild's channels, rejected if
     it matches nothing
   - `role`: same shape, `@mention` / name / id, resolved against the
     guild's roles
   - `string-list`: paragraph text input, one entry per line
   - `choice`: `StringSelectMenu` inside the modal (`choices`, current
     value preselected)
   - `boolean`: `StringSelectMenu` inside the modal (Enabled / Disabled,
     current value preselected)
   The prefill text comes from `descriptor.format(value)` when present,
   else `String(value)`.
3. On submit the dialog re-validates (`validate`, numeric bounds,
   channel/role resolution, duration parse), persists via the module's
   `set`, then `interaction.update()` re-renders the module page in place.
   A failed validation replies ephemeral with the error and leaves the
   panel and the stored value untouched.

Dialogs (modals) are the single edit path for every type. Discord allows
`StringSelectMenu` rows inside modals, so even `choice` and `boolean`
fit the dialog: one `showModal` / submit flow for the whole system, no
per-type inline controls, no header layout per setting kind.

## 5. Interaction plumbing

Today the bridge drops component interactions; buttons exist only as
one-shot collectors on a single reply (`watchButtonPress`, `attachPager`),
which cannot drive a persistent panel. Two additions:

1. **Bridge branch** in `src/event/event-bridge.ts`:
   `interaction.isButton() || interaction.isStringSelectMenu() ||
   interaction.isModalSubmit()` posts a new `ComponentReceivedEvent`
   (same event shape as siblings: guild, userId, raw interaction).

2. **Component registry** (`src/settings/component/component-registry.ts`):
   stateless; custom ids are self-describing:
   `<moduleId>:<guildId>:<key>:<action>`, where `action` is `edit` (the
   button that opens the dialog) or `submit` (the dialog form itself).
   On an interaction, resolve the module, then authorize: the presser must
   be a member of `guildId` and hold the flags that `/settings` required
   (`Permissions.memberHas`), unless the owner/administrator bypass
   applies. Only then is the interaction handed to the module's handler:
   `edit` → `interaction.showModal(modalFor(key))`, `submit` → validate,
   persist, re-render.

   No nonce is needed: custom ids only ever come from messages and modals
   we rendered, and authorization is checked fresh on every press.

   Discord caps interaction tokens at 15 minutes; after that
   `interaction.update` / `showModal` throw. Catch and ignore, and the
   panel simply dies on its own. No cleanup timers needed.

`SettingsListeners` (co-located in `src/settings/index.ts`, instantiated
in `src/index.ts` like the other listeners) subscribes to
`ComponentReceivedEvent` and hands presses to the registry. One-shot
buttons keep using `watchButtonPress`; the two paths coexist.

## 6. Rollout

Implementation order:

1. Migration: `guild_settings` table.
2. `GuildSettings` store (`get` / `set` / `all`).
3. `ComponentReceivedEvent` + bridge branch + registry + `SettingsListeners`.
4. `SettingsModule`, `SettingsManager`, `SettingsCommand` (panel render +
   handle for every `SettingType`).
5. First consumer: the levelling `SettingsModule`.

### Migrating `level_configs`

- **Data migration** (one-off, via drizzle schema change + SQL): create
  `guild_settings`; for each `level_configs` row, insert one row per
  setting:
  - `levels.message_xp` ← `message_xp`
  - `levels.message_cooldown` ← `message_cooldown_seconds` × 1000
  - `levels.voice_xp_per_min` ← `voice_xp_per_min`
  - `levels.ignored_channel_ids` ← `ignored_channel_ids` (JSONB as-is)
  - `levels.announce_channel_id` ← `announce_channel_id`
  Then **drop** `level_configs` (and its drizzle table def). Rows absent
  from `guild_settings` fall back to the module defaults, so the
  migration only materializes rows that differ from defaults.
- **Code migration**: `LevelsService` reads config through
  `levelsSettings.get(...)` per key (with the `duration` conversion for
  the cooldown) and drops its `getConfig` / `DEFAULT_CONFIG` /
  `levelConfigs` imports; call sites switch to typed `levelsSettings` reads.
- **Command removal**: delete the `/level-config` command tree
  (`src/feature/impl/levels/command/level-config/` and its registered
  commands and helpers, `configSummaryLines` etc.), and remove its
  `LEVELS_CONFIG_COMMAND` permission flag / `FLAG_DISPLAY_NAMES` entry.
  Its configuration surface is replaced by `/settings` → Levelling. The
  `/levels` command (rank/leaderboard) is untouched.
- Feature toggles move too: `guild_features.levels` stays (that is the
  feature on/off bit, still handled by `/feature`); only the config table
  is folded into settings.

## 7. Decisions

All confirmed on 2026-09-20:

- **Key-value table vs one JSON blob per guild**: key-value.
- **`/settings` gate**: new `SETTINGS_COMMAND` flag (`1n << 4n`), granted
  like any other flag. The moderation flags start at `1n << 5n`.
- **Show only enabled features' modules**: yes; a disabled feature's
  settings are hidden until the feature is re-enabled via `/feature`.
- **`duration` input**: parsed with the new `parseDuration` helper in
  `src/lib/time.ts` (planned in `moderation-plan.md`), stored as
  milliseconds.
- **Edit path**: dialogs (modals) for every setting type. One
  `showModal` / submit flow; `boolean` and `choice` use a
  `StringSelectMenu` row inside the modal. Buttons on the module page only
  open dialogs; navigation is the module picker select.

Deferred:

- **Per-module permissions**: `/settings` is one gate today. If a guild
  needs "only senior mods edit moderation settings", add an optional
  `requiredFlags` per module later, checked at press time by the registry.