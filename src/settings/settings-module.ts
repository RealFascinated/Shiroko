import type { JsonValue } from "../db/schema";
import type { FeatureIds } from "../feature/feature-ids";
import GuildSettings from "./guild-settings";

/**
 * The kind of a setting, driving both its edit dialog and its value shape.
 */
export type SettingType =
  "boolean" | "number" | "string" | "choice" | "channel" | "role" | "duration" | "string-list";

/**
 * The JSON value shape each SettingType requires of `C[K]`.
 */
export type SettingValueMap = {
  boolean: boolean;
  number: number;
  string: string;
  choice: string;
  channel: string | null; // null = unset
  role: string | null; // null = unset
  duration: number; // milliseconds
  "string-list": string[];
};

interface SettingDescriptorBase<C, K extends keyof C, T extends SettingType> {
  key: K;
  label: string;
  description?: string;
  type: T;
  default: C[K];
  /** Option values, required for `choice`. */
  choices?: T extends "choice" ? Record<string, string> : never;
  min?: T extends "number" | "duration" ? number : never;
  max?: T extends "number" | "duration" ? number : never;
  /** Return an error message, or null when the value is valid. */
  validate?(value: C[K]): string | null;
  /** Display formatting for the panel. */
  format?(value: C[K]): string;
}

/**
 * A descriptor whose value shape matches `C[K]`. A mismatched pair
 * compiles to `never`, so TypeScript rejects it.
 */
type ValidSettingDescriptor<C, K extends keyof C, T extends SettingType> = C[K] extends SettingValueMap[T]
  ? SettingDescriptorBase<C, K, T>
  : never;

/**
 * Every valid (key, type) pair for the module's config type `C`.
 */
export type SettingDescriptor<C> = {
  [K in keyof C]: {
    [T in SettingType]: ValidSettingDescriptor<C, K, T>;
  }[SettingType];
}[keyof C];

export interface SettingsModuleConfig<C> {
  id: string;
  displayName: string;
  /** The feature whose settings these are; `/settings` hides the module when the feature is disabled. */
  featureId: FeatureIds | null;
  defaults: C;
  descriptors: ReadonlyArray<SettingDescriptor<C>>;
}

/**
 * The runtime descriptor shape the panel consumes. Converted from the
 * typed descriptors at module construction so the interaction code never
 * has to narrow the generic union.
 */
export interface RuntimeSettingDescriptor {
  key: string;
  label: string;
  description?: string;
  type: SettingType;
  default: unknown;
  choices?: Record<string, string>;
  min?: number;
  max?: number;
  validate?(value: unknown): string | null;
  format?(value: unknown): string;
}

/**
 * A typed set of settings for one feature/area, namespaced under
 * `id` in the `guild_settings` table. Consumers read and write values
 * through {@link get} / {@link set} with the config type's exact types.
 */
export default class SettingsModule<C> {
  public readonly id: string;
  public readonly displayName: string;
  public readonly featureId: FeatureIds | null;
  public readonly defaults: C;
  /** Typed descriptors, validated against `C` at construction. */
  public readonly descriptors: ReadonlyArray<SettingDescriptor<C>>;
  /** Runtime view of the same descriptors for the panel. */
  public readonly runtimeDescriptors: ReadonlyArray<RuntimeSettingDescriptor>;
  private readonly byKey = new Map<string, RuntimeSettingDescriptor>();

  public constructor(config: SettingsModuleConfig<C>) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.featureId = config.featureId;
    this.defaults = config.defaults;
    this.descriptors = config.descriptors;
    this.runtimeDescriptors = config.descriptors.map(toRuntimeDescriptor);
    for (const descriptor of this.runtimeDescriptors) {
      this.byKey.set(descriptor.key, descriptor);
    }
  }

  /**
   * Look up a runtime descriptor by key string (used by the panel's
   * custom ids).
   */
  public descriptor(key: string): RuntimeSettingDescriptor | undefined {
    return this.byKey.get(key);
  }

  /**
   * Read a setting for a guild, falling back to the module default when no
   * row exists.
   */
  public async get<K extends keyof C>(guildId: string, key: K): Promise<C[K]> {
    const raw = await GuildSettings.get(guildId, `${this.id}.${String(key)}`);
    return (raw ?? this.defaults[key]) as C[K];
  }

  /**
   * Persist a setting; the value must match the descriptor's shape.
   */
  public async set<K extends keyof C>(guildId: string, key: K, value: C[K]): Promise<void> {
    await GuildSettings.set(guildId, `${this.id}.${String(key)}`, value as JsonValue);
  }
}

/**
 * Convert a typed descriptor to its runtime shape: the plain-data fields
 * pass through, and the typed callbacks are widened to `unknown`.
 */
function toRuntimeDescriptor<C>(descriptor: SettingDescriptor<C>): RuntimeSettingDescriptor {
  return {
    key: String(descriptor.key),
    label: descriptor.label,
    description: descriptor.description,
    type: descriptor.type,
    default: descriptor.default,
    choices: descriptor.choices,
    min: descriptor.min,
    max: descriptor.max,
    validate: descriptor.validate as ((value: unknown) => string | null) | undefined,
    format: descriptor.format as ((value: unknown) => string) | undefined,
  };
}
