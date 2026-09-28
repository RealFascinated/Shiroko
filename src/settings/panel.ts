import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type EmbedBuilder,
  type Guild,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { baseEmbed, errorEmbed } from "../lib/embed";
import { formatDuration, parseDuration } from "../lib/time";
import type SettingsModule from "./settings-module";
import type { RuntimeSettingDescriptor } from "./settings-module";

/**
 * Settings per panel page. The help section and the action rows both
 * render only the descriptors on the current page, so page size also
 * bounds how many controls a page can carry.
 */
export const PAGE_SIZE = 10;

export const PANEL_ACTION = {
  categories: "categories",
  page: "page",
  edit: "edit",
  submit: "submit",
  apply: "apply",
} as const;

/**
 * The hard ceiling on roles in a `role-list`: Discord's 25 select options.
 */
export const ROLE_LIST_MAX = 25;

const NAV_PREFIX = `settings:${PANEL_ACTION.page}`;

/**
 * The prev/next pagination row. Disabled at the ends; page is 0-based.
 */
export function pageNavRow(
  moduleId: string,
  guildId: string,
  page: number,
  pageCount: number
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${NAV_PREFIX}:${moduleId}:${guildId}:${page}:prev`)
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${NAV_PREFIX}:${moduleId}:${guildId}:${page}:next`)
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pageCount - 1)
  );
}

/**
 * The descriptors on the current page (0-based), at most {@link PAGE_SIZE}.
 */
export function pageDescriptors<C>(module: SettingsModule<C>, page: number): RuntimeSettingDescriptor[] {
  const start = page * PAGE_SIZE;
  return module.runtimeDescriptors.slice(start, start + PAGE_SIZE);
}

/**
 * The number of pages for a module's descriptors.
 */
export function pageCountFor<C>(module: SettingsModule<C>): number {
  return Math.max(1, Math.ceil(module.runtimeDescriptors.length / PAGE_SIZE));
}

/**
 * A custom id for a descriptor control, carrying the page it was rendered
 * on so re-renders stay on the same page.
 */
function controlId(moduleId: string, guildId: string, page: number, key: string, action: string): string {
  return `${moduleId}:${guildId}:${page}:${key}:${action}`;
}

/**
 * The category dropdown: one module per option, with `moduleId`
 * preselected. Changing the selection swaps the action rows below.
 */
export function categorySelectRow(
  moduleIds: string[],
  selectedModuleId: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`settings:${PANEL_ACTION.categories}`)
      .setPlaceholder("Choose a settings category…")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        moduleIds.map(id =>
          new StringSelectMenuOptionBuilder()
            .setLabel(id.charAt(0).toUpperCase() + id.slice(1))
            .setValue(id)
            .setDefault(id === selectedModuleId)
        )
      )
  );
}

/**
 * The module help section for a page: one line per descriptor on that
 * page showing its label, current value, and (when present) description.
 * Read-only.
 */
export async function moduleHelp<C>(
  commandName: string | null,
  module: SettingsModule<C>,
  guild: Guild,
  page: number = 0
): Promise<EmbedBuilder> {
  const lines = await Promise.all(
    pageDescriptors(module, page).map(async descriptor => {
      const value = await module.get(guild.id, descriptor.key as keyof C);
      const display = formatValue(descriptor, value);
      const description = descriptor.description ? `\n*${descriptor.description}*` : "";
      return `**${descriptor.label}:** ${display === null ? "*(none)*" : display}${description}`;
    })
  );
  return baseEmbed(commandName)
    .setTitle(`⚙️ ${module.displayName} Settings`)
    .setDescription(lines.join("\n\n") || "No settings in this module.");
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
    case "role-list":
      return (value as string[]).map(id => `<@&${id}>`).join(", ");
    case "string-list":
      return (value as string[]).join(", ");
    default:
      return String(value);
  }
}

/**
 * The action rows for one page of a settings category (module): a row of
 * "✏️" edit buttons for the text-input setting types on this page, and
 * one select menu per boolean/choice setting (an immediate-apply
 * dropdown). Buttons are chunked into rows of 5 (Discord's per-row cap).
 */
export async function categoryControls<C>(
  module: SettingsModule<C>,
  guild: Guild,
  page: number = 0
): Promise<Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>> {
  const guildId = guild.id;
  const editButtons: ButtonBuilder[] = [];
  const selectRows: Array<ActionRowBuilder<StringSelectMenuBuilder>> = [];

  for (const descriptor of pageDescriptors(module, page)) {
    if (descriptor.type === "boolean" || descriptor.type === "choice") {
      const current = await module.get(guild.id, descriptor.key as keyof C);
      selectRows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(controlId(module.id, guildId, page, descriptor.key, PANEL_ACTION.apply))
            .setPlaceholder(`Set: ${descriptor.label}`)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(selectOptionsFor(descriptor, current))
        )
      );
    } else {
      editButtons.push(
        new ButtonBuilder()
          .setCustomId(controlId(module.id, guildId, page, descriptor.key, PANEL_ACTION.edit))
          .setLabel(`✏️ ${descriptor.label}`)
          .setStyle(ButtonStyle.Secondary)
      );
    }
  }

  const rows: Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> = [];
  for (let i = 0; i < editButtons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(editButtons.slice(i, i + 5)));
  }
  return [...rows, ...selectRows];
}

/**
 * Compose the full panel for a guild: the help section for the selected
 * module's page, the category dropdown (preselected), that page's action
 * rows, and pagination. Used by `/settings` and by every in-place
 * re-render after a navigation or edit.
 */
export async function renderPanel<C>(
  commandName: string | null,
  guild: Guild,
  moduleIds: string[],
  selected: SettingsModule<C>,
  page: number = 0
): Promise<{
  embeds: EmbedBuilder[];
  components: Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>;
}> {
  const help = await moduleHelp(commandName, selected, guild, page);
  const controls = await categoryControls(selected, guild, page);
  const components: Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> = [
    categorySelectRow(moduleIds, selected.id),
    ...controls,
  ];
  const pages = pageCountFor(selected);
  if (pages > 1) {
    components.push(pageNavRow(selected.id, guild.id, page, pages));
  }
  return {
    embeds: [help],
    components,
  };
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
 * Build the edit dialog (modal) for a descriptor on a page, pre-filled
 * with the guild's current value and prefixed by help text (the setting's
 * description plus a per-type hint) so it's obvious how to input the
 * value. Channel and role settings use Discord's native pickers; every
 * other type takes a text input.
 */
export async function dialogFor<C>(
  module: SettingsModule<C>,
  descriptor: RuntimeSettingDescriptor,
  guild: Guild,
  page: number = 0
): Promise<ModalBuilder> {
  const current = await module.get(guild.id, descriptor.key as keyof C);
  const modal = new ModalBuilder()
    .setCustomId(controlId(module.id, guild.id, page, descriptor.key, PANEL_ACTION.submit))
    .setTitle(descriptor.label);

  const hintLines: string[] = [];
  if (descriptor.description) {
    hintLines.push(`*${descriptor.description}*`);
  }
  const hint = dialogHintFor(descriptor);
  if (hint) {
    hintLines.push(hint);
  }
  const content = hintLines.filter(Boolean).join("\n");
  if (content.length > 0) {
    modal.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  }

  if (descriptor.type === "channel") {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel(descriptor.label)
        .setChannelSelectMenuComponent(channelPicker(descriptor, current, guild))
    );
    return modal;
  }
  if (descriptor.type === "role") {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel(descriptor.label)
        .setRoleSelectMenuComponent(rolePicker(descriptor, current, guild))
    );
    return modal;
  }
  if (descriptor.type === "role-list") {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel(descriptor.label)
        .setRoleSelectMenuComponent(roleListPicker(descriptor, current, guild))
    );
    return modal;
  }

  const input = new TextInputBuilder()
    .setCustomId("value")
    .setStyle(descriptor.type === "string-list" ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setValue(prefillFor(descriptor, current))
    .setRequired(true)
    .setPlaceholder(placeholderFor(descriptor));
  modal.addLabelComponents(new LabelBuilder().setLabel(descriptor.label).setTextInputComponent(input));
  return modal;
}

/**
 * The native channel picker for a channel setting: the current value is
 * preselected (when the channel still exists) and clearing it unsets the
 * setting. A target the guild no longer has is skipped, since the API
 * rejects default values it cannot resolve.
 */
function channelPicker(
  descriptor: RuntimeSettingDescriptor,
  current: unknown,
  guild: Guild
): ChannelSelectMenuBuilder {
  const picker = new ChannelSelectMenuBuilder()
    .setCustomId("value")
    .setPlaceholder(`Choose: ${descriptor.label}`)
    .setMinValues(0)
    .setMaxValues(1)
    .setRequired(false);
  if (typeof current === "string" && guild.channels.cache.has(current)) {
    picker.setDefaultChannels(current);
  }
  return picker;
}

/**
 * The native role picker for a role setting; same semantics as
 * {@link channelPicker}.
 */
function rolePicker(
  descriptor: RuntimeSettingDescriptor,
  current: unknown,
  guild: Guild
): RoleSelectMenuBuilder {
  const picker = new RoleSelectMenuBuilder()
    .setCustomId("value")
    .setPlaceholder(`Choose: ${descriptor.label}`)
    .setMinValues(0)
    .setMaxValues(1)
    .setRequired(false);
  if (typeof current === "string" && guild.roles.cache.has(current)) {
    picker.setDefaultRoles(current);
  }
  return picker;
}

/**
 * The most roles a role-list setting can hold: the descriptor's `max`,
 * capped at the 25 select-menu options Discord allows.
 */
export function roleListLimit(descriptor: RuntimeSettingDescriptor): number {
  const max = descriptor.max ?? ROLE_LIST_MAX;
  return Math.min(Math.max(1, max), ROLE_LIST_MAX);
}
/**
 * The native role picker for a role-list setting: up to
 * {@link roleListLimit} roles, all current ones preselected, and an empty
 * selection allowed to clear the list.
 */
function roleListPicker(
  descriptor: RuntimeSettingDescriptor,
  current: unknown,
  guild: Guild
): RoleSelectMenuBuilder {
  const picker = new RoleSelectMenuBuilder()
    .setCustomId("value")
    .setPlaceholder(`Choose up to ${roleListLimit(descriptor)}: ${descriptor.label}`)
    .setMinValues(0)
    .setMaxValues(roleListLimit(descriptor))
    .setRequired(false);
  // default_values must be resolvable, so roles the guild no longer has are dropped.
  const selected = (Array.isArray(current) ? current : []).filter(
    (id): id is string => typeof id === "string" && guild.roles.cache.has(id)
  );
  if (selected.length > 0) {
    picker.setDefaultRoles(...selected.slice(0, roleListLimit(descriptor)));
  }
  return picker;
}

/**
 * A one-line "how to input this" hint for a setting type.
 */
function dialogHintFor(descriptor: RuntimeSettingDescriptor): string {
  switch (descriptor.type) {
    case "number":
      return "Enter a number. Leave empty to reset to the default.";
    case "duration":
      return "Enter a duration like 90s, 1h30m, or 2d. Leave empty to reset to the default.";
    case "channel":
      return "Pick a channel, or clear the selection to unset it.";
    case "role":
      return "Pick a role, or clear the selection to unset it.";
    case "role-list":
      return `Pick up to ${roleListLimit(descriptor)} roles. Remove all to clear.`;
    case "string-list":
      return "One entry per line. Remove all lines to clear.";
    case "string":
      return "Enter the value. Leave empty to reset to the default.";
    default:
      return "";
  }
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
    case "string-list":
      return "One entry per line";
    default:
      return "";
  }
}

/**
 * Validate and parse a submitted dialog value into a JSON value. An empty
 * channel/role picker means "clear" (null). Select-sourced values
 * (boolean/choice) are also parsed here for {@link handleSelectApply}.
 */
export function parseDialogValue(
  descriptor: RuntimeSettingDescriptor,
  raw: string | readonly string[] | null
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
      if (raw === null) {
        return { value: null };
      }
      return { value: Array.isArray(raw) ? (raw[0] ?? null) : raw };
    }
    case "role-list": {
      const ids = raw === null ? [] : typeof raw === "string" ? [raw] : raw;
      if (descriptor.max !== undefined && ids.length > roleListLimit(descriptor)) {
        return { error: `${descriptor.label} allows at most ${roleListLimit(descriptor)} roles.` };
      }
      return { value: ids };
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
 * Read the submitted value out of a modal: the resolved id from a
 * channel/role picker (null when the selection was cleared), otherwise
 * the text-input string. Cleared and untouched pickers are read from the
 * raw field map, because the typed getters throw when a component is
 * absent from the submission rather than reporting an empty selection.
 */
export function dialogValueFrom(
  interaction: ModalSubmitInteraction,
  descriptor: RuntimeSettingDescriptor
): string | readonly string[] | null {
  if (descriptor.type === "channel" || descriptor.type === "role") {
    const field = interaction.fields.fields.get("value") as { values?: readonly string[] } | undefined;
    return field?.values?.[0] ?? null;
  }
  if (descriptor.type === "role-list") {
    const field = interaction.fields.fields.get("value") as { values?: readonly string[] } | undefined;
    return field?.values ?? [];
  }
  return interaction.fields.getTextInputValue("value");
}

/**
 * Run a setting's own validator over a parsed value, returning the JSON
 * value to persist.
 */
function finalizeValue(
  descriptor: RuntimeSettingDescriptor,
  value: unknown
): { error?: string; value?: unknown } {
  if (descriptor.validate) {
    const message = descriptor.validate(value);
    if (message !== null) {
      return { error: message };
    }
  }
  return { value };
}

/**
 * Handle a modal submit: validate, persist, and re-render the module page
 * in place (on the page the dialog opened from, encoded in the modal's
 * custom id).
 */
export async function handleDialogSubmit<C>(
  interaction: ModalSubmitInteraction,
  module: SettingsModule<C>,
  descriptor: RuntimeSettingDescriptor,
  categoryIds: string[],
  page: number,
  commandName: string | null
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  const parsed = parseDialogValue(descriptor, dialogValueFrom(interaction, descriptor));
  if (parsed.error !== undefined) {
    await interaction.reply({
      embeds: [errorEmbed(commandName).setDescription(parsed.error)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const finalized = finalizeValue(descriptor, parsed.value);
  if (finalized.error !== undefined) {
    await interaction.reply({
      embeds: [errorEmbed(commandName).setDescription(finalized.error)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await module.set(guild.id, descriptor.key as keyof C, finalized.value as never);
  const panel = await renderPanel(commandName, guild, categoryIds, module, page);
  // ModalSubmitInteraction typings don't declare `update`; guard the
  // message (null when the modal was not opened from a message
  // component) and edit the source panel in place.
  if (!interaction.message) {
    return;
  }
  await interaction.deferUpdate();
  await interaction.message.edit(panel);
}

/**
 * Shared submit path for select-menu applies (boolean/choice), which
 * update the panel in place exactly like a modal submit, staying on the
 * page the select was rendered on.
 */
export async function handleSelectApply<C>(
  interaction: StringSelectMenuInteraction,
  module: SettingsModule<C>,
  descriptor: RuntimeSettingDescriptor,
  categoryIds: string[],
  page: number,
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
  const finalized = finalizeValue(descriptor, parsed.value);
  if (finalized.error !== undefined) {
    await interaction.reply({
      embeds: [errorEmbed(commandName).setDescription(finalized.error)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await module.set(guild.id, descriptor.key as keyof C, finalized.value as never);
  const panel = await renderPanel(commandName, guild, categoryIds, module, page);
  await interaction.update(panel);
}
