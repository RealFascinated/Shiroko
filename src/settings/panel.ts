import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type EmbedBuilder,
  type Guild,
  type ModalActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { baseEmbed, errorEmbed } from "../lib/embed";
import { formatDuration, parseDuration } from "../lib/time";
import type SettingsModule from "./settings-module";
import type { RuntimeSettingDescriptor } from "./settings-module";

export const PANEL_ACTION = {
  modules: "modules",
  edit: "edit",
  submit: "submit",
  apply: "apply",
} as const;

/**
 * The module-id select is the panel's navigation row.
 */
export function modulesSelectRow(moduleIds: string[]): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`settings:modules`)
      .setPlaceholder("Choose a settings module…")
      .addOptions(
        moduleIds.map(id =>
          new StringSelectMenuOptionBuilder().setLabel(id.charAt(0).toUpperCase() + id.slice(1)).setValue(id)
        )
      )
  );
}

/**
 * The overview embed listing every available module.
 */
export function overviewEmbed(commandName: string | null): EmbedBuilder {
  return baseEmbed(commandName)
    .setTitle("⚙️ Settings")
    .setDescription("Choose a module below to edit its settings.");
}

/**
 * The module page embed: one line per descriptor showing its label and
 * current value.
 */
export async function moduleEmbed<C>(
  commandName: string | null,
  module: SettingsModule<C>,
  guild: Guild
): Promise<EmbedBuilder> {
  const lines = await Promise.all(
    module.runtimeDescriptors.map(async descriptor => {
      const value = await module.get(guild.id, descriptor.key as keyof C);
      const display = formatValue(descriptor, value);
      return `**${descriptor.label}:** ${display === null ? "*(none)*" : display}`;
    })
  );
  return baseEmbed(commandName)
    .setTitle(`⚙️ ${module.displayName} Settings`)
    .setDescription(lines.join("\n") || "No settings in this module.");
}

/**
 * Format a descriptor's value for display, honoring `format` when present.
 */
export function formatValue(descriptor: RuntimeSettingDescriptor, value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (descriptor.format) {
    return descriptor.format(value);
  }
  switch (descriptor.type) {
    case "duration":
      return formatDuration(typeof value === "number" ? value : Number(value));
    case "channel":
      return `<#${value}>`;
    case "role":
      return `<@&${value}>`;
    case "string-list":
      return (value as string[]).join(", ");
    default:
      return String(value);
  }
}

/**
 * The module page's components: a row of "✏️" edit buttons for the
 * text-input setting types, and one select menu per boolean/choice setting
 * (an immediate-apply dropdown).
 */
export async function moduleControls<C>(
  module: SettingsModule<C>,
  guild: Guild
): Promise<Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>> {
  const guildId = guild.id;
  const buttons = new ActionRowBuilder<ButtonBuilder>();
  const selectRows: Array<ActionRowBuilder<StringSelectMenuBuilder>> = [];

  for (const descriptor of module.runtimeDescriptors) {
    if (descriptor.type === "boolean" || descriptor.type === "choice") {
      const current = await module.get(guild.id, descriptor.key as keyof C);
      selectRows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${module.id}:${guildId}:${descriptor.key}:${PANEL_ACTION.apply}`)
            .setPlaceholder(`Set: ${descriptor.label}`)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(selectOptionsFor(descriptor, current))
        )
      );
    } else {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`${module.id}:${guildId}:${descriptor.key}:${PANEL_ACTION.edit}`)
          .setLabel(`✏️ ${descriptor.label}`)
          .setStyle(ButtonStyle.Secondary)
      );
    }
  }

  const rows: Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> = [];
  if (buttons.components.length > 0) {
    rows.push(buttons);
  }
  return [...rows, ...selectRows];
}

/**
 * The select options for a boolean or choice descriptor, with the current
 * value preselected.
 */
function selectOptionsFor(
  descriptor: RuntimeSettingDescriptor,
  current: unknown
): StringSelectMenuOptionBuilder[] {
  if (descriptor.type === "boolean") {
    return [
      new StringSelectMenuOptionBuilder()
        .setLabel("Enabled")
        .setValue("true")
        .setDefault(current === true),
      new StringSelectMenuOptionBuilder()
        .setLabel("Disabled")
        .setValue("false")
        .setDefault(current !== true),
    ];
  }
  if (descriptor.type === "choice") {
    return Object.entries(descriptor.choices ?? {}).map(([value, label]) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setValue(value)
        .setDefault(String(current) === value)
    );
  }
  return [];
}

/**
 * Build the edit dialog (modal) for a descriptor, pre-filled with the
 * guild's current value.
 */
export async function dialogFor<C>(
  module: SettingsModule<C>,
  descriptor: RuntimeSettingDescriptor,
  guild: Guild
): Promise<ModalBuilder> {
  const current = await module.get(guild.id, descriptor.key as keyof C);
  const prefill = prefillFor(descriptor, current);
  const isParagraph = descriptor.type === "string-list";
  return new ModalBuilder()
    .setCustomId(`${module.id}:${guild.id}:${descriptor.key}:${PANEL_ACTION.submit}`)
    .setTitle(descriptor.label)
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("value")
          .setLabel(descriptor.label)
          .setStyle(isParagraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setValue(prefill)
          .setRequired(true)
          .setPlaceholder(placeholderFor(descriptor))
      )
    );
}

/**
 * The pre-fill text for a modal text input.
 */
function prefillFor(descriptor: RuntimeSettingDescriptor, value: unknown): string {
  const formatted = formatValue(descriptor, value);
  return formatted === null ? "" : formatted;
}

/**
 * A short placeholder hint for a text-input dialog.
 */
function placeholderFor(descriptor: RuntimeSettingDescriptor): string {
  switch (descriptor.type) {
    case "number":
      return "A number";
    case "duration":
      return "e.g. 90s, 1h30m, 2d";
    case "channel":
      return "#channel, channel name, or id (or empty to clear)";
    case "role":
      return "@role, role name, or id (or empty to clear)";
    case "string-list":
      return "One entry per line";
    default:
      return "";
  }
}

/**
 * Validate and parse a submitted dialog value into a JSON value. For
 * channel/role an empty input means "clear" (null); resolution against the
 * guild happens in {@link handleDialogSubmit}. Select-sourced values
 * (boolean/choice) are also parsed here for {@link handleSelectApply}.
 */
export function parseDialogValue(
  descriptor: RuntimeSettingDescriptor,
  raw: string | readonly string[]
): { error?: string; value?: unknown } {
  switch (descriptor.type) {
    case "boolean": {
      return { value: (Array.isArray(raw) ? raw[0] : raw) === "true" };
    }
    case "choice": {
      const selected = Array.isArray(raw) ? raw[0] : raw;
      if (selected === undefined || (descriptor.choices ?? {})[selected] === undefined) {
        return { error: `Invalid choice for ${descriptor.label}.` };
      }
      return { value: selected };
    }
    case "number": {
      const text = Array.isArray(raw) ? raw[0] : raw;
      const num = Number(text);
      if (!Number.isFinite(num)) {
        return { error: `${descriptor.label} must be a number.` };
      }
      if (descriptor.min !== undefined && num < descriptor.min) {
        return { error: `${descriptor.label} must be at least ${descriptor.min}.` };
      }
      if (descriptor.max !== undefined && num > descriptor.max) {
        return { error: `${descriptor.label} must be at most ${descriptor.max}.` };
      }
      return { value: num };
    }
    case "duration": {
      const text = (Array.isArray(raw) ? raw[0] : raw).trim();
      const ms = parseDuration(text);
      if (ms === null) {
        return { error: `${descriptor.label} must be a duration like "90s" or "1h30m".` };
      }
      if (descriptor.min !== undefined && ms < descriptor.min) {
        return { error: `${descriptor.label} must be at least ${formatDuration(descriptor.min)}.` };
      }
      if (descriptor.max !== undefined && ms > descriptor.max) {
        return { error: `${descriptor.label} must be at most ${formatDuration(descriptor.max)}.` };
      }
      return { value: ms };
    }
    case "channel":
    case "role": {
      const text = (Array.isArray(raw) ? raw[0] : raw).trim();
      return { value: text.length === 0 ? null : text };
    }
    case "string-list": {
      const text = (Array.isArray(raw) ? raw[0] : raw).trim();
      const entries =
        text.length === 0
          ? []
          : text
              .split("\n")
              .map((line: string) => line.trim())
              .filter(Boolean);
      return { value: entries };
    }
    case "string": {
      return { value: Array.isArray(raw) ? raw[0] : raw };
    }
    default:
      return { error: `Unsupported setting type for ${descriptor.label}.` };
  }
}

/**
 * Resolve a `#mention` / `@mention` / name / id against the guild. Returns
 * the stable id, or `null` when nothing matches.
 */
async function resolveMentionLike(guild: Guild, input: string): Promise<string | null> {
  const bare = input.replace(/^<#(\d+)>$/, "$1").replace(/^<@&(\d+)>$/, "$1");
  if (/^\d+$/.test(bare)) {
    return bare;
  }
  const lower = input.toLowerCase();
  const foundChannel = Array.from(guild.channels.cache.values()).find(ch => ch.name.toLowerCase() === lower);
  if (foundChannel) {
    return foundChannel.id;
  }
  const foundRole = Array.from(guild.roles.cache.values()).find(r => r.name.toLowerCase() === lower);
  return foundRole?.id ?? null;
}

/**
 * Read the submitted value out of a modal by its component custom id.
 */
export function dialogValueFrom(interaction: ModalSubmitInteraction): string | readonly string[] {
  const selectValues = interaction.fields.getStringSelectValues("value");
  return selectValues.length > 0 ? selectValues : interaction.fields.getTextInputValue("value");
}

/**
 * Validate and resolve a raw dialog value (channel/role resolution
 * included), returning the JSON value to persist.
 */
async function finalizeValue(
  descriptor: RuntimeSettingDescriptor,
  value: unknown,
  guild: Guild
): Promise<{ error?: string; value?: unknown }> {
  let result: unknown = value;
  if (descriptor.type === "channel" || descriptor.type === "role") {
    if (value === null) {
      result = null;
    } else {
      const resolved = await resolveMentionLike(guild, String(value));
      if (resolved === null) {
        return { error: `Could not find a ${descriptor.type} matching that.` };
      }
      result = resolved;
    }
  }
  if (descriptor.validate) {
    const message = descriptor.validate(result);
    if (message !== null) {
      return { error: message };
    }
  }
  return { value: result };
}

/**
 * Handle a modal submit: validate, resolve channel/role, persist, and
 * re-render the module page in place.
 */
export async function handleDialogSubmit<C>(
  interaction: ModalSubmitInteraction,
  module: SettingsModule<C>,
  descriptor: RuntimeSettingDescriptor,
  commandName: string | null
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  const parsed = parseDialogValue(descriptor, dialogValueFrom(interaction));
  if (parsed.error !== undefined) {
    await interaction.reply({
      embeds: [errorEmbed(commandName).setDescription(parsed.error)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const finalized = await finalizeValue(descriptor, parsed.value, guild);
  if (finalized.error !== undefined) {
    await interaction.reply({
      embeds: [errorEmbed(commandName).setDescription(finalized.error)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await module.set(guild.id, descriptor.key as keyof C, finalized.value as never);
  const embed = await moduleEmbed(commandName, module, guild);
  const controls = await moduleControls(module, guild);
  // ModalSubmitInteraction typings don't declare `update`; guard the
  // message (null when the modal was not opened from a message
  // component) and edit the source panel in place.
  if (!interaction.message) {
    return;
  }
  await interaction.deferUpdate();
  await interaction.message.edit({ embeds: [embed], components: controls });
}

/**
 * Shared submit path for select-menu applies (boolean/choice), which
 * update the panel in place exactly like a modal submit.
 */
export async function handleSelectApply<C>(
  interaction: StringSelectMenuInteraction,
  module: SettingsModule<C>,
  descriptor: RuntimeSettingDescriptor,
  commandName: string | null
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  const parsed = parseDialogValue(descriptor, interaction.values);
  if (parsed.error !== undefined) {
    await interaction.reply({
      embeds: [errorEmbed(commandName).setDescription(parsed.error)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const finalized = await finalizeValue(descriptor, parsed.value, guild);
  if (finalized.error !== undefined) {
    await interaction.reply({
      embeds: [errorEmbed(commandName).setDescription(finalized.error)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await module.set(guild.id, descriptor.key as keyof C, finalized.value as never);
  const embed = await moduleEmbed(commandName, module, guild);
  const controls = await moduleControls(module, guild);
  await interaction.update({ embeds: [embed], components: controls });
}
