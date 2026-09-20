import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
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
 * value.
 */
export async function dialogFor<C>(
  module: SettingsModule<C>,
  descriptor: RuntimeSettingDescriptor,
  guild: Guild,
  page: number = 0
): Promise<ModalBuilder> {
  const current = await module.get(guild.id, descriptor.key as keyof C);
  const prefill = prefillFor(descriptor, current);
  const isParagraph = descriptor.type === "string-list";
  const modal = new ModalBuilder()
    .setCustomId(controlId(module.id, guild.id, page, descriptor.key, PANEL_ACTION.submit))
    .setTitle(descriptor.label);

  const hintLines: string[] = [];
  if (descriptor.description) {
    hintLines.push(`*${descriptor.description}*`);
  }
  hintLines.push(dialogHintFor(descriptor));
  modal.addTextDisplayComponents(new TextDisplayBuilder().setContent(hintLines.filter(Boolean).join("\n")));

  modal.addComponents(
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
  return modal;
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
      return descriptor.description
        ? "Paste a #channel mention or the channel name/id. Leave empty to clear."
        : "Paste a #channel mention or channel name/id. Leave empty to clear.";
    case "role":
      return "Paste an @role mention or role name/id. Leave empty to clear.";
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
 * re-render the module page in place (on the page the dialog opened
 * from, encoded in the modal's custom id).
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
  const finalized = await finalizeValue(descriptor, parsed.value, guild);
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
