import { fetchGuildMember } from "@/lib/guild";
import { formatDuration, parseDuration } from "@/lib/time";
import Panel, { type PanelAccess, type PanelControl, type PanelView } from "@/panel/panel";
import Permissions, { PermissionFlags } from "@/permission/permissions";
import SettingsManager from "@/settings/index";
import type SettingsModule from "@/settings/settings-module";
import type { RuntimeFieldDescriptor } from "@/settings/settings-module";
import type { Guild } from "discord.js";

/**
 * The aggregated per-guild state the hub renders over: every enabled
 * settings module's values, nested under the module's id, so a control's
 * dotted key (`levels.messageXp`, `logging.enabled.message`) resolves to
 * one stored setting.
 */
type SettingsHubConfig = Record<string, Record<string, unknown>>;

/**
 * The hub the `/settings` command opens: one generic config panel over
 * every registered settings module. Each module whose feature is enabled
 * becomes a view, so the engine's automatic view switcher is the category
 * dropdown, and each module's descriptors are translated into the engine's
 * controls. Reads and writes go through each module's own
 * `SettingsModule`, so storage and per-guild caching are unchanged.
 *
 * Maps are not editable here: their keys are dynamic, so a map's view
 * shows a note pointing at the feature's own command instead of controls.
 */
export default class SettingsPanel extends Panel<SettingsHubConfig> {
  public readonly segment = "settings";
  public readonly title = "Settings";

  public override readonly access: PanelAccess<SettingsHubConfig> = {
    authorized: async context => {
      const member = await fetchGuildMember(context.guild, context.user.id);
      return (
        member !== null && Permissions.memberHas(context.guild, member, PermissionFlags.SETTINGS_COMMAND)
      );
    },
    denied: () => "You don't have permission to configure settings.",
  };

  /**
   * Aggregate every enabled module's values under its id. A module is
   * included only when its feature is on, so a view disappears the moment
   * its feature is disabled.
   */
  public async getConfig(guild: Guild): Promise<SettingsHubConfig> {
    const modules = await SettingsManager.enabledModules(guild);
    const entries = await Promise.all(
      modules.map(async module => [module.id, await module.values(guild.id)] as const)
    );
    return Object.fromEntries(entries) as SettingsHubConfig;
  }

  public override async updateConfig(
    guild: Guild,
    _view: PanelView<SettingsHubConfig>,
    key: string,
    value: unknown
  ): Promise<void> {
    const dot = key.indexOf(".");
    if (dot <= 0) {
      return;
    }
    const module = SettingsManager.get(key.slice(0, dot));
    if (!module) {
      return;
    }
    await module.set(guild.id, key.slice(dot + 1) as never, value as never);
  }

  public views(config: SettingsHubConfig): readonly PanelView<SettingsHubConfig>[] {
    return Object.keys(config).map(moduleId => makeView(moduleId));
  }
}

/**
 * Build one hub view from a module: its label is the module's display
 * name, and its controls are the module's descriptors translated to
 * engine controls.
 */
function makeView(moduleId: string): PanelView<SettingsHubConfig> {
  const module = SettingsManager.get(moduleId);
  if (!module) {
    throw new Error(`Unknown settings module "${moduleId}"`);
  }
  return {
    id: moduleId,
    label: module.displayName,
    segment: module.id,
    controls: () => toControls(module, moduleId),
    summary: () => mapSummaries(module),
  };
}

/**
 * Translate a module's runtime descriptors into the engine's control kinds.
 * Groups recurse into their fields; maps are skipped (a map's keys are
 * dynamic, so it is edited by the feature's own command). Each control's
 * `key` is the full dotted path, so the hub's `updateConfig` can route the
 * write to the right module and leaf.
 */
function toControls(module: SettingsModule<any>, moduleId: string): PanelControl<SettingsHubConfig>[] {
  const controls: PanelControl<SettingsHubConfig>[] = [];
  for (const descriptor of module.runtimeDescriptors) {
    collectControls(`${moduleId}.${descriptor.key}`, descriptor, controls);
  }
  return controls;
}

function collectControls(
  key: string,
  descriptor: RuntimeFieldDescriptor,
  controls: PanelControl<SettingsHubConfig>[]
): void {
  if (descriptor.type === "group") {
    for (const field of descriptor.fields ?? []) {
      collectControls(`${key}.${field.key}`, field, controls);
    }
    return;
  }
  if (descriptor.type === "map") {
    return;
  }
  controls.push(controlFor(key, descriptor));
}

/** A read-only note for each map setting, naming where it is edited. */
function mapSummaries(module: SettingsModule<any>): string[] {
  return module.runtimeDescriptors
    .filter(descriptor => descriptor.type === "map")
    .map(descriptor => `-# **${descriptor.label}:** edited with the feature's own command.`);
}

function controlFor(key: string, descriptor: RuntimeFieldDescriptor): PanelControl<SettingsHubConfig> {
  const description = descriptor.description;

  switch (descriptor.type) {
    case "boolean":
      return {
        kind: "toggle",
        key,
        label: descriptor.label,
        description,
        state: value => (value ? "On" : "Off"),
      };

    case "choice":
      return {
        kind: "choice",
        key,
        label: descriptor.label,
        description,
        options: () => Object.entries(descriptor.choices ?? {}).map(([value, label]) => ({ value, label })),
      };

    case "number":
      return {
        kind: "dialog",
        key,
        input: "text",
        label: descriptor.label,
        description,
        hint: "Enter a number. Leave empty to reset to the default.",
        validate: input => numberProblem(descriptor, input),
        validateValue: value => numberValueProblem(descriptor, value),
        transform: input => (input.trim() === "" ? null : Number(input)),
      };

    case "duration":
      return {
        kind: "dialog",
        key,
        input: "text",
        label: descriptor.label,
        description,
        hint: "Enter a duration like 90s, 1h30m, or 2d. Leave empty to reset to the default.",
        validate: input => durationProblem(descriptor, input),
        validateValue: value => durationValueProblem(descriptor, value),
        transform: input => (input.trim() === "" ? null : parseDuration(input)),
        format: value => (value === null ? "*(none)*" : formatDuration(Number(value))),
      };

    case "string":
      return {
        kind: "dialog",
        key,
        input: "text",
        label: descriptor.label,
        description,
        hint: "Enter the value. Leave empty to reset to the default.",
        format: value => (value === null ? "*(none)*" : String(value)),
      };

    case "string-list":
      return {
        kind: "dialog",
        key,
        input: "paragraph",
        label: descriptor.label,
        description,
        hint: "One entry per line. Remove all lines to clear.",
        transform: input =>
          input
            .trim()
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean),
        format: value =>
          descriptor.format
            ? descriptor.format(value)
            : Array.isArray(value) && value.length > 0
              ? (value as string[]).join(", ")
              : "*(none)*",
      };

    case "channel":
      return {
        kind: "dialog",
        key,
        input: "channel",
        label: descriptor.label,
        description,
        hint: "Choose a channel, or clear the selection to unset it.",
        format: value => (typeof value === "string" ? `<#${value}>` : "*(none)*"),
      };

    case "role":
      return {
        kind: "dialog",
        key,
        input: "role",
        label: descriptor.label,
        description,
        hint: "Choose a role, or clear the selection to unset it.",
        format: value => (typeof value === "string" ? `<@&${value}>` : "*(none)*"),
      };

    case "role-list":
      return {
        kind: "dialog",
        key,
        input: "role-list",
        label: descriptor.label,
        description,
        hint: `Choose up to ${roleListLimit(descriptor)} roles. Remove all to clear.`,
        maxRoles: roleListLimit(descriptor),
        format: value =>
          Array.isArray(value) && value.length > 0 ? value.map(id => `<@&${id}>`).join(", ") : "*(none)*",
      };

    default:
      throw new Error(`Unsupported settings type "${descriptor.type}"`);
  }
}

/** A number's bounds problem, or null when the input is empty or in range. */
function numberProblem(descriptor: RuntimeFieldDescriptor, input: string): string | null {
  if (input.trim() === "") {
    return null;
  }
  const num = Number(input);
  if (!Number.isFinite(num)) {
    return `${descriptor.label} must be a number.`;
  }
  if (descriptor.min !== undefined && num < descriptor.min) {
    return `${descriptor.label} must be at least ${descriptor.min}.`;
  }
  if (descriptor.max !== undefined && num > descriptor.max) {
    return `${descriptor.label} must be at most ${descriptor.max}.`;
  }
  return null;
}

/** A duration's parse/bounds problem, or null when empty or in range. */
function durationProblem(descriptor: RuntimeFieldDescriptor, input: string): string | null {
  if (input.trim() === "") {
    return null;
  }
  const ms = parseDuration(input);
  if (ms === null) {
    return `${descriptor.label} must be a duration like "90s" or "1h30m".`;
  }
  if (descriptor.min !== undefined && ms < descriptor.min) {
    return `${descriptor.label} must be at least ${formatDuration(descriptor.min)}.`;
  }
  if (descriptor.max !== undefined && ms > descriptor.max) {
    return `${descriptor.label} must be at most ${formatDuration(descriptor.max)}.`;
  }
  return null;
}

/** The most roles a role-list can hold: the descriptor's `max`, capping 25. */
function roleListLimit(descriptor: RuntimeFieldDescriptor): number {
  const max = descriptor.max ?? 25;
  return Math.min(Math.max(1, max), 25);
}

/**
 * Validate a finalized number against the descriptor's bounds and its own
 * `validate` hook. Called after the transform, so it sees the stored value
 * (a number, or null when the field was cleared).
 */
function numberValueProblem(descriptor: RuntimeFieldDescriptor, value: unknown): string | null {
  if (value !== null) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return `${descriptor.label} must be a number.`;
    }
    if (descriptor.min !== undefined && num < descriptor.min) {
      return `${descriptor.label} must be at least ${descriptor.min}.`;
    }
    if (descriptor.max !== undefined && num > descriptor.max) {
      return `${descriptor.label} must be at most ${descriptor.max}.`;
    }
  }
  return descriptor.validate?.(value) ?? null;
}

/** As {@link numberValueProblem}, for a duration stored as milliseconds. */
function durationValueProblem(descriptor: RuntimeFieldDescriptor, value: unknown): string | null {
  if (value !== null) {
    const ms = Number(value);
    if (!Number.isFinite(ms)) {
      return `${descriptor.label} must be a duration like "90s" or "1h30m".`;
    }
    if (descriptor.min !== undefined && ms < descriptor.min) {
      return `${descriptor.label} must be at least ${formatDuration(descriptor.min)}.`;
    }
    if (descriptor.max !== undefined && ms > descriptor.max) {
      return `${descriptor.label} must be at most ${formatDuration(descriptor.max)}.`;
    }
  }
  return descriptor.validate?.(value) ?? null;
}

/** The one instance shared by the router and `/settings`. */
export const settingsPanel = new SettingsPanel();
