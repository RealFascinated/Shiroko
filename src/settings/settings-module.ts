import type { JsonValue } from "../db/schemas/guild-settings";
import type { FeatureIds } from "../feature/feature-ids";
import GuildSettings from "./guild-settings";

/**
 * The scalar setting kinds. `group` and `map` are structural and handled by
 * {@link SettingDescriptor} directly.
 */
export type ScalarSettingType =
  "boolean" | "number" | "string" | "choice" | "channel" | "role" | "role-list" | "duration" | "string-list";

/**
 * The JSON value shape each scalar type requires of the config position.
 */
export type SettingValueMap = {
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

type IsArray<V> = V extends readonly unknown[] ? true : false;

/** A closed key set: an object with named keys and no index signature. */
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

/** An open key set: a record with a string or number index signature. */
type IsMap<V> =
  IsArray<V> extends true ? false : V extends object ? (IsGroup<V> extends true ? false : true) : false;

type Groupable<V> = IsGroup<V> extends true ? V : never;

type MapEntry<V> = V extends { [k: number]: infer E } ? E : V extends { [k: string]: infer E } ? E : never;

type ScalarSpec<V, T extends ScalarSettingType> = V extends SettingValueMap[T]
  ? {
      type: T;
      label: string;
      description?: string;
      default: V;
      /** Option values, for `choice`. */
      choices?: Record<string, string>;
      min?: number;
      max?: number;
      /**
       * Return an error message, or null when the value is valid.
       */
      validate?(value: V): string | null;
      /**
       * Display formatting for the panel.
       */
      format?(value: V): string;
    }
  : never;

/**
 * A spec for one value: a scalar, a fixed-shape group, or a map of entry
 * values. `V` is the config type at this position, so a mismatched scalar
 * compiles to `never` and a record cannot be a group.
 */
export type SettingDescriptor<V> =
  | { [T in ScalarSettingType]: ScalarSpec<V, T> }[ScalarSettingType]
  | {
      type: "group";
      label: string;
      default: Groupable<V>;
      fields: ReadonlyArray<FieldDescriptor<Groupable<V>>>;
    }
  | { type: "map"; label: string; default: V; entry: SettingDescriptor<MapEntry<V>> };

/**
 * A keyed spec: the key must exist on `V` and the spec must match `V[K]`.
 */
export type FieldDescriptor<V> = {
  [K in keyof V & string]: SettingDescriptor<V[K]> & { key: K };
}[keyof V & string];

/**
 * Every readable dotted path into `C`: scalars, groups, and group leaves.
 * Maps are excluded, since their keys are not statically enumerable.
 */
export type Paths<T> = T extends readonly unknown[]
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

export type PathValue<T, P extends string> = P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? PathValue<T[K], R>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Paths that can be written: scalar and array leaves and group leaves. A
 * whole group or map is never writable, so every write is one leaf row.
 */
export type WritablePaths<T> = {
  [K in keyof T & string]: IsGroup<T[K]> extends true
    ? `${K}.${WritablePaths<T[K]>}`
    : IsMap<T[K]> extends true
      ? never
      : K;
}[keyof T & string];

export type MapKeys<C> = { [K in keyof C]: IsMap<C[K]> extends true ? K : never }[keyof C];

export interface SettingsModuleConfig<C> {
  id: string;
  displayName: string;
  /** The feature whose settings these are; `/settings` hides the module when the feature is disabled. */
  featureId: FeatureIds | null;
  defaults: C;
  descriptors: ReadonlyArray<FieldDescriptor<C>>;
}

/**
 * The runtime descriptor shape the panel consumes and the module assembles
 * with. `fields` carries a group's children and `entry` a map's entry
 * spec; both are the same shape recursively.
 */
export interface RuntimeFieldDescriptor {
  key: string;
  label: string;
  description?: string;
  type: ScalarSettingType | "group" | "map";
  default: unknown;
  choices?: Record<string, string>;
  min?: number;
  max?: number;
  validate?(value: unknown): string | null;
  format?(value: unknown): string;
  fields?: readonly RuntimeFieldDescriptor[];
  entry?: RuntimeFieldDescriptor;
}

/**
 * The typed descriptor as it exists at runtime, before conversion. Only
 * used at the boundary where the erased runtime view is built.
 */
interface RawDescriptor {
  key?: PropertyKey;
  type: ScalarSettingType | "group" | "map";
  label: string;
  description?: string;
  default: unknown;
  choices?: Record<string, string>;
  min?: number;
  max?: number;
  validate?(value: unknown): string | null;
  format?(value: unknown): string;
  fields?: readonly unknown[];
  entry?: unknown;
}

/**
 * A typed set of settings for one feature/area, namespaced under `id` in
 * the `guild_settings` table. Values are stored one row per leaf; reads
 * merge stored rows over the code-side defaults.
 */
export default class SettingsModule<C> {
  public readonly id: string;
  public readonly displayName: string;
  public readonly featureId: FeatureIds | null;
  public readonly defaults: C;
  public readonly descriptors: ReadonlyArray<FieldDescriptor<C>>;
  /** Erased view of the same descriptors, used for reads, writes, and the panel. */
  public readonly runtimeDescriptors: ReadonlyArray<RuntimeFieldDescriptor>;

  public constructor(config: SettingsModuleConfig<C>) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.featureId = config.featureId;
    this.defaults = config.defaults;
    this.descriptors = config.descriptors;
    this.runtimeDescriptors = (config.descriptors as readonly unknown[]).map(field => toRuntimeField(field));
  }

  /**
   * Every setting for a guild, defaults merged, from one store read.
   */
  public async values(guildId: string): Promise<C> {
    const store = await GuildSettings.all(guildId);
    const value: Record<string, unknown> = {};
    for (const descriptor of this.runtimeDescriptors) {
      value[descriptor.key] = assembleValue(store, `${this.id}.${descriptor.key}`, descriptor);
    }
    return value as C;
  }

  /**
   * Read a scalar, array, group, or group leaf by typed dotted path.
   */
  public async get<P extends Paths<C>>(guildId: string, path: P): Promise<PathValue<C, P>> {
    const store = await GuildSettings.all(guildId);
    const descriptor = this.resolve(path);
    return assembleValue(store, `${this.id}.${path}`, descriptor) as PathValue<C, P>;
  }

  /**
   * Write a leaf; each write is one row.
   */
  public async set<P extends WritablePaths<C>>(
    guildId: string,
    path: P,
    value: PathValue<C, P>
  ): Promise<void> {
    await GuildSettings.set(guildId, `${this.id}.${path}`, value as JsonValue);
  }

  /**
   * Read a whole open map.
   */
  public async entries<K extends MapKeys<C>>(guildId: string, key: K): Promise<C[K]> {
    const store = await GuildSettings.all(guildId);
    return assembleValue(store, `${this.id}.${String(key)}`, this.mapEntry(key)) as C[K];
  }

  /**
   * Write one map entry; an object entry writes one row per field.
   */
  public async setEntry<K extends MapKeys<C>>(
    guildId: string,
    key: K,
    entryKey: string,
    value: MapEntry<C[K]>
  ): Promise<void> {
    await writeEntry(guildId, `${this.id}.${String(key)}.${entryKey}`, this.mapEntry(key), value);
  }

  /**
   * Delete every row of one map entry.
   */
  public async removeEntry<K extends MapKeys<C>>(guildId: string, key: K, entryKey: string): Promise<void> {
    await clearEntry(guildId, `${this.id}.${String(key)}.${entryKey}`, this.mapEntry(key));
  }

  private field(key: string): RuntimeFieldDescriptor | undefined {
    return this.runtimeDescriptors.find(candidate => candidate.key === key);
  }

  private mapEntry<K extends MapKeys<C>>(key: K): RuntimeFieldDescriptor {
    const field = this.field(String(key));
    if (!field || field.type !== "map" || !field.entry) {
      throw new Error(`"${String(key)}" is not a map setting on module "${this.id}"`);
    }
    return field.entry;
  }

  private resolve(path: string): RuntimeFieldDescriptor {
    const [head, ...rest] = path.split(".");
    const field = this.field(head ?? "");
    if (!field) {
      throw new Error(`Unknown setting "${path}" on module "${this.id}"`);
    }
    return resolveDescriptor(field, rest, this.id, path);
  }
}

function resolveDescriptor(
  descriptor: RuntimeFieldDescriptor,
  segments: string[],
  moduleId: string,
  path: string
): RuntimeFieldDescriptor {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return descriptor;
  }
  if (descriptor.type !== "group") {
    throw new Error(`"${path}" descends into a non-group setting on module "${moduleId}"`);
  }
  const field = descriptor.fields?.find(candidate => candidate.key === head);
  if (!field) {
    throw new Error(`Unknown setting "${path}" on module "${moduleId}"`);
  }
  return resolveDescriptor(field, rest, moduleId, path);
}

function assembleValue(
  store: Map<string, JsonValue>,
  key: string,
  descriptor: RuntimeFieldDescriptor
): unknown {
  if (descriptor.type === "group") {
    const value: Record<string, unknown> = {};
    for (const field of descriptor.fields ?? []) {
      value[field.key] = assembleValue(store, `${key}.${field.key}`, field);
    }
    return value;
  }
  if (descriptor.type === "map" && descriptor.entry) {
    const value: Record<string, unknown> = {};
    for (const entryKey of entryKeys(store, `${key}.`)) {
      value[entryKey] = assembleValue(store, `${key}.${entryKey}`, descriptor.entry);
    }
    return value;
  }
  return store.get(key) ?? descriptor.default;
}

function entryKeys(store: Map<string, JsonValue>, prefix: string): string[] {
  const keys = new Set<string>();
  for (const key of store.keys()) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    keys.add(key.slice(prefix.length).split(".")[0]!);
  }
  return [...keys];
}

async function writeEntry(
  guildId: string,
  key: string,
  entry: RuntimeFieldDescriptor,
  value: unknown
): Promise<void> {
  if (entry.type === "group") {
    const record = value as Record<string, unknown>;
    for (const child of entry.fields ?? []) {
      await GuildSettings.set(guildId, `${key}.${child.key}`, (record[child.key] ?? null) as JsonValue);
    }
    return;
  }
  await GuildSettings.set(guildId, key, value as JsonValue);
}

async function clearEntry(guildId: string, key: string, entry: RuntimeFieldDescriptor): Promise<void> {
  if (entry.type === "group") {
    for (const child of entry.fields ?? []) {
      await GuildSettings.set(guildId, `${key}.${child.key}`, null);
    }
    return;
  }
  await GuildSettings.set(guildId, key, null);
}

/**
 * Erase a typed descriptor into the runtime shape. This is the one
 * boundary where the generic union is widened; every read, write, and
 * panel interaction below it works on the plain runtime view.
 */
function toRuntimeField(field: unknown): RuntimeFieldDescriptor {
  const raw = field as RawDescriptor;
  return { ...toRuntimeValue(raw), key: String(raw.key ?? "") };
}

function toRuntimeValue(descriptor: RawDescriptor): Omit<RuntimeFieldDescriptor, "key"> {
  if (descriptor.type === "group") {
    return {
      type: "group",
      label: descriptor.label,
      default: descriptor.default,
      fields: (descriptor.fields ?? []).map(field => toRuntimeField(field)),
    };
  }
  if (descriptor.type === "map") {
    return {
      type: "map",
      label: descriptor.label,
      default: descriptor.default,
      entry: toRuntimeField(descriptor.entry),
    };
  }
  return {
    type: descriptor.type,
    label: descriptor.label,
    description: descriptor.description,
    default: descriptor.default,
    choices: descriptor.choices,
    min: descriptor.min,
    max: descriptor.max,
    validate: descriptor.validate,
    format: descriptor.format,
  };
}
