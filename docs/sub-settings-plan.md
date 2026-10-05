# Sub-Settings Plan

Replaces the flat settings descriptor/storage API with a single nested
system, and moves the remaining feature config tables onto `guild_settings`.
There is no compatibility layer: the old descriptor types, the `get`/`set`
API, and the per-feature config tables, caches, and service indirection are
all deleted and rewritten against the new code. Net result is substantially
less code, because four tables, three caches, and several service methods
disappear. Permissions keeps its own system and is out of scope.

Storage is **one row per leaf** under a deep dotted key, so every write
stays an atomic per-key upsert and "absence of a row" still means "use the
code-side default".

This plan supersedes the flat descriptor model in `settings-plan.md`. It is
not additive: `SettingDescriptor<C>`, `ValidSettingDescriptor`, the flat
single-key `SettingsModule.get`/`set`/`allValues` methods, and the runtime
`byKey` lookup are removed, and their call sites are rewritten.

## 1. Goals

- **One descriptor model.** A single recursive `SettingDescriptor<V>` for
  scalars, groups, and maps. No parallel flat and nested shapes.
- **One storage table.** No feature owns a config table.
- **Fully typed.** A descriptor is linked to its config type `C[K]` at
  compile time; a mismatch is a type error. Paths and map entries are
  typed lookups.
- **Atomic per-key writes.** Nesting never turns a write into
  read-modify-write of a shared blob.
- **Defaults in code.** A missing leaf falls back to its default; deleting
  a row resets it, and deleting a map entry's rows removes the entry.
- **Delete, do not adapt.** Feature tables, their caches, and their
  bespoke read/write methods are removed, not kept behind shims.

### Non-goals

- Not a general JSON document store. Telemetry and per-user data stay in
  their own indexed tables (§2).
- Not a data migration. Old tables are dropped; rows start empty.
- Not an add/remove collection editor in the generic `/settings` hub.
  Maps with dynamic keys are edited by feature-owned panels (§8).

## 2. What moves

Config tables move onto `guild_settings` and are deleted:

| Table            | Config shape                              | Descriptor kind    |
| ---------------- | ----------------------------------------- | ------------------ |
| `logging`        | `Record<LogType, boolean>` (default true) | `group` (closed)   |
| `guild_features` | `Record<FeatureId, boolean>`              | `group` (closed)   |
| `autoroles`      | `string[]`                                | `role-list` scalar |
| `level_rewards`  | `Record<number, { type, roleId }>`        | `map` (open)       |

`level_configs` was already moved; the same rewrite applies to it so it
uses the new API.

`permission_roles` **stays its own system** (`src/permission/`, its table,
its cache, and its recursive ancestry query are untouched). It is not a
sub-settings consumer.

Telemetry/data tables **stay tables** and are untouched: `voice_sessions`,
`message_events`, `user_levels`, `guild_users`, `global_users`,
`guild_birthdays`, `guild_invites`, `invite_joins`, `media`,
`command_calls`, `interactions`.

## 3. Storage layout

One row per leaf in `guild_settings`, keyed `<module>.<setting>[.<path>]`:

| Config shape | Example                    | Stored rows                                        |
| ------------ | -------------------------- | -------------------------------------------------- |
| scalar       | `levels.messageXp`         | `levels.messageXp`                                 |
| group        | `logging.enabled.message`  | `logging.enabled.message`                          |
| scalar map   | `logging.channels[5]`      | `logging.channels.5`                               |
| object map   | `levels.rewards[5].roleId` | `levels.rewards.5.roleId`, `levels.rewards.5.type` |

Reads merge stored leaves over code defaults, recursively: a group with one
stored leaf returns that leaf's value and defaults for the rest. A map has
no implicit entries; absent rows mean the entry does not exist.

Writes stay single-row upserts. Writing an object map entry touches one row
per field, so two writers on the **same** entry can interleave fields;
different entries never race. Panel writes are serial, so this is not a
practical concern.

> **Cache capacity.** `guild-settings` uses `max: 5_000` entries per
> registry, one map per guild. Config now contributes many more keys per
> guild, so raise the `max` when the first map feature lands.

## 4. Descriptor model

`SettingType`, `SettingDescriptorBase`, `ValidSettingDescriptor`, and the
flat `SettingDescriptor<C>` are deleted. One recursive type replaces them.

```ts
type ScalarSettingType =
  "boolean" | "number" | "string" | "choice" | "channel" | "role" | "role-list" | "duration" | "string-list";

/** The value shape each scalar type requires of the config position. */
type SettingValueMap = {
  boolean: boolean;
  number: number;
  string: string;
  choice: string;
  channel: string | null; // null = unset
  role: string | null; // null = unset
  "role-list": string[];
  duration: number; // milliseconds
  "string-list": string[];
};

/** A closed key set (no index signature, not an array). */
type IsArray<V> = V extends readonly unknown[] ? true : false;
type IsGroup<V> =
  IsArray<V> extends true
    ? false
    : V extends object
      ? number extends keyof V
        ? false
        : string extends keyof V
          ? false
          : true
      : false;
type IsMap<V> =
  IsArray<V> extends true ? false : V extends object ? (IsGroup<V> extends true ? false : true) : false;
type Groupable<V> = IsGroup<V> extends true ? V : never;

/** The entry value of an open record map. */
type MapEntry<V> = V extends { [k: number]: infer E } ? E : V extends { [k: string]: infer E } ? E : never;

type ScalarSpec<V, T extends ScalarSettingType> = V extends SettingValueMap[T]
  ? { type: T; label: string; default: V; description?: string; min?: number; max?: number }
  : never;

/** A descriptor carries one key; `FieldDescriptor` adds it at object level. */
type FieldDescriptor<V> = {
  [K in keyof V & string]: SettingDescriptor<V[K]> & { key: K };
}[keyof V & string];

type SettingDescriptor<V> =
  | { [T in ScalarSettingType]: ScalarSpec<V, T> }[ScalarSettingType]
  | {
      type: "group";
      label: string;
      default: Groupable<V>;
      fields: ReadonlyArray<FieldDescriptor<Groupable<V>>>;
    }
  | { type: "map"; label: string; default: V; entry: SettingDescriptor<MapEntry<V>> };
```

`SettingsModuleConfig<C>.descriptors` is `ReadonlyArray<FieldDescriptor<C>>`.

### Group vs map

The two are decided by the config type, so there is no ambiguity and no
runtime discriminator:

- **Closed key set** (`Record<LogType, boolean>`,
  `Record<FeatureIds, boolean>`) is a `group`: `keyof V` is a finite union,
  so `IsGroup` is true. Each key is one leaf descriptor, and the panel
  renders them directly.
- **Open key set** (`Record<number, Reward>`, `Record<string, RoleConfig>`)
  is a `map`: the index signature makes `IsGroup` false, `IsMap` true. It
  uses the map accessors and a feature-owned panel.
- An open record **cannot** be a group (`Groupable` is `never`), and a
  closed record **cannot** be a map. Both are compile errors (verified).

**String enums need a literal alias.** A dotted path into
`Record<FeatureIds, boolean>` resolves to `never`, because a raw path
segment like `"general"` is not assignable to the nominal enum type.
`FeatureIds` therefore gets a `FeatureId = \`${FeatureIds}\``alias, and
the toggle record is keyed by`FeatureId`, whose members are plain string
literals a path can index.

### Closed records generate their fields

A closed record is a group, so its descriptors are one per key. Generate
them from the same table that defines the keys. The two helpers are generic
and live in generic homes, never in a feature:

- `mapRecord` is an object utility: `src/lib/utils.ts`.
- `booleanFields` is a descriptor factory: `src/settings/descriptors.ts`,
  beside the descriptor types it builds.

```ts
// src/lib/utils.ts  (generic object utility)
/**
 * Map every key of a lookup table to a value, preserving the key union.
 * The only cast is the localized `Object.fromEntries` widening.
 */
export function mapRecord<K extends string, I, O>(
  source: Record<K, I>,
  value: (key: K, entry: I) => O
): Record<K, O> {
  return Object.fromEntries(
    (Object.keys(source) as K[]).map(key => [key, value(key, source[key])])
  ) as Record<K, O>;
}
```

```ts
// src/settings/descriptors.ts  (generic to the settings subsystem)
import type { FieldDescriptor } from "./settings-module";

/** One boolean descriptor per key of a closed record, defaults included. */
export function booleanFields<K extends string>(
  labels: Record<K, string>,
  defaults: Record<K, boolean>
): ReadonlyArray<FieldDescriptor<Record<K, boolean>>> {
  return (Object.keys(labels) as K[]).map(key => ({
    key,
    type: "boolean",
    label: labels[key],
    default: defaults[key],
  }));
}
```

A feature settings module then contains only its own keys, defaults, and
descriptors:

```ts
// src/feature/impl/logging/logging-settings.ts
import { mapRecord } from "@/lib/utils";
import { booleanFields } from "@/settings/descriptors";

const LOG_LABELS = mapRecord(logTypes, (_key, meta) => meta.label);
const LOG_DEFAULTS = mapRecord(logTypes, () => true);

export const loggingSettings = new SettingsModule<LoggingSettingsData>({
  id: "logging",
  displayName: "Logging",
  featureId: FeatureIds.Logging,
  defaults: { channelId: null, enabled: LOG_DEFAULTS },
  descriptors: [
    { key: "channelId", type: "channel", label: "Log channel", default: null },
    {
      key: "enabled",
      type: "group",
      label: "Log types",
      default: LOG_DEFAULTS,
      fields: booleanFields(LOG_LABELS, LOG_DEFAULTS),
    },
  ],
});
```

General object utilities go in `src/lib/`; anything that builds or walks a
descriptor goes in `src/settings/`; feature modules hold only their own
config. The same applies to the map accessors (`entries`/`setEntry`/
`removeEntry`) that feature-owned panels call.

## 5. Path and map typing

Groups get compile-time dotted paths; maps get typed entry accessors.

```ts
/** Every readable dotted path: scalars, groups, group leaves. Maps excluded. */
type Paths<T> = T extends readonly unknown[]
  ? never
  : T extends object
    ? number extends keyof T
      ? never
      : string extends keyof T
        ? never
        : {
            [K in keyof T & string]: K | (IsGroup<T[K]> extends true ? `${K}.${Paths<T[K]>}` : never);
          }[keyof T & string]
    : never;

type PathValue<T, P extends string> = P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? PathValue<T[K], R>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/** Writable paths: scalar/array leaves and group leaves. Never a whole group/map. */
type WritablePaths<T> = {
  [K in keyof T & string]: IsGroup<T[K]> extends true
    ? `${K}.${WritablePaths<T[K]>}`
    : IsMap<T[K]> extends true
      ? never
      : K;
}[keyof T & string];

/** Config keys whose value is an open record map. */
type MapKeys<C> = { [K in keyof C]: IsMap<C[K]> extends true ? K : never }[keyof C];
```

Verified against `tsc --strict`: `Paths<C>` yields `"messageXp"`,
`"enabled.message"`, `"roleIds"` but never `"rewards"`; `WritablePaths<C>`
rejects a whole group (`"enabled"`) and any map; `MapKeys<C>` selects
`"rewards"` and `"roles"` but not `"enabled"` or `"roleIds"`.

## 6. Module API

The flat single-key `get`, `set`, and `allValues` are replaced by one
path-aware value API. `get`/`set` are kept by name, but their `path`
argument is a typed dotted path, so one pair covers scalars, groups, and
group leaves:

```ts
export default class SettingsModule<C> {
  public readonly id: string;
  public readonly displayName: string;
  public readonly featureId: FeatureIds | null;
  public readonly defaults: C;
  public readonly descriptors: ReadonlyArray<FieldDescriptor<C>>;
  public readonly runtimeDescriptors: ReadonlyArray<RuntimeFieldDescriptor>;

  /** Every setting for a guild, defaults merged, in one store read. */
  public values(guildId: string): Promise<C>;

  /** Read a scalar, array, group, or group leaf by typed dotted path. */
  public get<P extends Paths<C>>(guildId: string, path: P): Promise<PathValue<C, P>>;

  /** Write a leaf; group leaves write one row each. */
  public set<P extends WritablePaths<C>>(guildId: string, path: P, value: PathValue<C, P>): Promise<void>;

  /** Read a whole open map. */
  public entries<K extends MapKeys<C>>(guildId: string, key: K): Promise<C[K]>;

  /** Write one map entry; an object entry writes one row per field. */
  public setEntry<K extends MapKeys<C>>(
    guildId: string,
    key: K,
    entryKey: string,
    value: MapEntry<C[K]>
  ): Promise<void>;

  /** Delete every row of one map entry. */
  public removeEntry<K extends MapKeys<C>>(guildId: string, key: K, entryKey: string): Promise<void>;
}
```

`descriptor(key)` and its `byKey` map are deleted: the panel routes writes
by path, so no runtime descriptor lookup remains.

`RuntimeFieldDescriptor` is the recursive runtime projection used by the
panel and by `SettingsManager` (`fields?` for groups, `entry?` for maps).

## 7. Store

`GuildSettings` keeps only what the module needs:

```ts
export default class GuildSettings {
  /** Every stored key for a guild, from the per-guild cache. */
  public static all(guildId: string): Promise<Map<string, JsonValue>>;

  /** Upsert one leaf; null deletes it. */
  public static set(guildId: string, key: string, value: JsonValue | null): Promise<void>;
}
```

`all` is a cache load (the per-guild map already holds every key), so
`values`, `get` for a group, and `entries` are in-memory prefix filters
over one cached map. The old single-key `get` is removed; nothing outside
the module reads settings rows directly (`LoggingService` and the others
stop doing so, §9).

## 8. Panel

The engine already supports nested display: `getPath`/`setPath`
(`src/panel/path.ts`) traverse any depth and `PanelView.controls(config,
context)` receives the config.

1. **Recursive controls.** `toControls` walks the recursive runtime
   descriptors. Scalars become their existing control kinds; a group's
   `fields` become controls with dotted keys; a map is **not** expanded, it
   becomes a read-only line naming the feature panel that edits it. The hub
   therefore only ever renders scalars and groups.
2. **Deep write routing.** `SettingsPanel.updateConfig`
   (`src/feature/impl/general/command/settings/settings-panel.ts`)
   currently splits the key into `[moduleId, settingKey]`. It must keep the
   whole remaining dotted path and call `module.set(guildId, rest, value)`.
   Map entries are never written through the hub.
3. **Feature-owned commands/panels** call
   `entries`/`setEntry`/`removeEntry` directly. This is the welcomer
   pattern (register storage, own the editing surface), now the rule for
   every map. Level rewards use `/levels reward-add` and
   `/levels reward-remove`, gated by a `LEVELS_COMMAND` permission flag,
   while `/levels rewards` lists.

## 9. Feature moves

Each move deletes the old table access and cache; there is no dual path.

### Logging

- Replace `loggingService`'s table access and `enabledCache` with
  `loggingSettings`:

  ```ts
  isEnabled(guild, logType)  ->  loggingSettings.get(guild.id, `enabled.${logType}`)
  setEnabled(guild, logType) ->  loggingSettings.set(guild.id, `enabled.${logType}`, enabled)
  getChannelId(guild)        ->  loggingSettings.get(guild.id, "channelId")
  ```

- The `/logging` commands (`channel`, `toggle`, `info`) call the module.
- Delete `src/db/schemas/logs.ts`, its `schema` entry, and the logging
  cache registration.

### Features

- Replace `GuildFeatures`' table access and `guild-features` cache with a
  `featureSettings` module: `enabled: Record<FeatureIds, boolean>`, the
  group default built from `Feature.options.defaultEnabled`.
- Keep the `toggleable === false` always-on short-circuit.
- Delete `src/db/schemas/guild-features.ts`, its `schema` entry, and the
  cache registration. `/feature` reads and writes module paths.

### Autoroles

- Replace `AutorolesService`' table access and `autoroles` cache with an
  `autorolesSettings` module: one `roleIds: string[]` of type `role-list`.
- `add`/`remove` read the array, check membership, and `set`; the
  table's `onConflictDoNothing().returning()` guard is gone. `list` still
  resolves role IDs against the guild role cache.
- Delete `src/db/schemas/autoroles.ts`, its `schema` entry, and the cache
  registration.

### Level rewards

- Add `rewards: Record<number, { type: string; roleId: string | null }>` to
  `levelsSettings` as a `map`. Default `{}`.
- `LevelsService` reads `entries(guildId, "rewards")` and sorts/filters the
  numeric keys in JS for `nextReward`, `rewards`, and `rewardsBetween`; the
  add/remove paths use `setEntry`/`removeEntry`.
- Delete `src/db/schemas/level-rewards.ts` and its `schema` entry.
  `/levels rewards` lists, `/levels reward-add` and `/levels reward-remove`
  edit (both gated by `PermissionFlags.LEVELS_COMMAND`).

### Permissions

Not moved. Permissions keeps its own system: `src/permission/`, the
`permission_roles` table, its authoritative cache, and the recursive
ancestry query in `pageConfigs` all stay exactly as they are. It is
untouched by this plan.

## 10. What is deleted

- Tables and schemas: `autoroles`, `guild-features`, `logs`,
  `level-rewards`, plus their entries in the `schema` aggregate in
  `src/db/index.ts`. `drizzle-kit generate` emits the drops.
- Caches: `autoroles`, `logging`, `guild-features`. (`permissions` stays,
  §9.)
- Flat descriptor code: `SettingType`, `SettingDescriptorBase`,
  `ValidSettingDescriptor`, the flat `SettingDescriptor<C>`,
  `toRuntimeDescriptor`, and `SettingsModule.descriptor`/`byKey`.
- The flat single-key module methods (`get`/`set` over one key,
  `allValues`) and `descriptor`/`byKey`.
- The per-table read/write methods they replace in each service.

## 11. Rollout

One pass, no compatibility window:

1. Rewrite `settings-module.ts` to the recursive descriptor model and the
   new API; rewrite `guild-settings.ts` to `all`/`set`.
2. Add the generic helpers: `mapRecord` in `src/lib/utils.ts`, the
   descriptor factories (starting with `booleanFields`) in
   `src/settings/descriptors.ts`.
3. Rewrite `levelsSettings`, `birthdaySettings`, and `welcomerSettings` to
   the new descriptor shape so the system compiles end to end.
4. Rewrite `SettingsPanel` for recursive controls and deep routing.
5. Move logging, features, autoroles, level rewards.
6. Delete schemas, caches, and dead methods; regenerate migrations.

Each step ends with `bunx tsc --noEmit`, `bun test` for the touched area,
and `bunx prettier --write` on the changed files.

## 12. Decisions

- **One recursive `SettingDescriptor<V>`**, replacing the flat union.
- **Closed records are groups; open records are maps**, decided by the
  config type, with no runtime discriminator and no dual descriptors.
- **One row per leaf**, deep dotted keys, preserving atomic upserts and
  defaults-as-absence.
- **A single value API** (`values`/`get`/`set`/`entries`/`setEntry`/
  `removeEntry`); `get`/`set` take a typed dotted path, and the flat
  single-key forms and `allValues` are gone.
- **Maps are edited by feature-owned panels**, not the generic hub.
- **Permissions stays its own system.** `src/permission/`, its table, its
  cache, and its recursive ancestry query are out of scope.
- **Generic code has one home**: object utilities in `src/lib/`, descriptor
  factories in `src/settings/descriptors.ts`, the store and module in
  `src/settings/`. Feature modules hold only their own config; a helper
  used by one feature stays out of that feature's file and goes generic.
- **No migration and no legacy paths.** Old tables and code are deleted.
- **Telemetry tables stay tables.**
