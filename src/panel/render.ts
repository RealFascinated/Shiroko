import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ContainerBuilder,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type ModalSubmitInteraction,
} from "discord.js";
import type Panel from "./panel";
import {
  panelCustomId,
  type ChoiceControl,
  type DialogControl,
  type PanelContext,
  type PanelControl,
  type PanelView,
  type ToggleControl,
  type ViewControl,
} from "./panel";
import { getPath } from "./path";

/** The hard ceiling on roles in a role-list: Discord's 25 select options. */
const ROLE_LIST_MAX = 25;

/** The modal input's field id, read back on submit. */
export const DIALOG_VALUE = "value";

/** Buttons per action row, Discord's cap. */
const BUTTONS_PER_ROW = 5;

/**
 * A rendered panel: a Components V2 payload. `content` and `embeds` are
 * inert under the V2 flag, so everything is a component.
 */
export interface RenderedPanel {
  components: ContainerBuilder[];
  flags: MessageFlags.IsComponentsV2;
}

/**
 * A control's current value as display text: its formatter when it has
 * one, otherwise the raw value, with a blank placeholder when unset. A
 * `view` control has no value, so it is not accepted here.
 */
export function displayValue<C>(
  control: Exclude<PanelControl<C>, ViewControl<C>>,
  config: C,
  context: PanelContext
): string {
  const raw = getPath(config, control.key);
  if (control.kind === "dialog") {
    if (control.format) {
      return control.format(raw, config, context);
    }
    if (raw === null || raw === undefined) {
      return "*(none)*";
    }
    return typeof raw === "string" ? raw : String(raw);
  }
  if (control.kind === "toggle") {
    return control.state(raw === true, config, context);
  }
  const option = control.options(config, context).find(candidate => candidate.value === raw);
  return option?.label ?? "*(none)*";
}

/** The view switcher, present only when a panel declares several views. */
function viewSelectRow<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  config: C,
  context: PanelContext
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const views = panel.views(config);
  if (views.length < 2) {
    return null;
  }
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(panelCustomId(panel.segment, view.segment, "root"))
      .setPlaceholder("View")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        views.map(candidate =>
          new StringSelectMenuOptionBuilder()
            .setLabel(candidate.label)
            .setValue(candidate.segment)
            .setDefault(candidate.segment === view.segment)
        )
      )
  );
}

/**
 * The buttons and selects that edit a view, in declaration order. Dialog
 * and toggle controls become buttons, chunked into rows of five; each
 * choice control takes a row of its own, since a select menu cannot share
 * one.
 */
function controlComponents<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  config: C,
  context: PanelContext
): Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> {
  const buttons: ButtonBuilder[] = [];
  const selects: Array<ActionRowBuilder<StringSelectMenuBuilder>> = [];

  for (const control of view.controls(config, context)) {
    if (control.kind === "choice") {
      selects.push(choiceRow(panel, view, control, config, context));
      continue;
    }
    if (control.kind === "view") {
      buttons.push(viewButton(panel, view, control));
      continue;
    }
    buttons.push(
      control.kind === "toggle"
        ? toggleButton(panel, view, control, config, context)
        : dialogButton(panel, view, control, config, context)
    );
  }

  const rows: Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> = [];
  for (let index = 0; index < buttons.length; index += BUTTONS_PER_ROW) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(index, index + BUTTONS_PER_ROW))
    );
  }
  return [...rows, ...selects];
}

function dialogButton<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  control: DialogControl<C>,
  config: C,
  context: PanelContext
): ButtonBuilder {
  const value = getPath(config, control.key);
  const caption = control.button?.(value, config, context) ?? `✏️ ${control.label}`;
  return new ButtonBuilder()
    .setCustomId(panelCustomId(panel.segment, view.segment, "dialog", control.key))
    .setLabel(caption.slice(0, 80))
    .setStyle(ButtonStyle.Secondary);
}

function toggleButton<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  control: ToggleControl<C>,
  config: C,
  context: PanelContext
): ButtonBuilder {
  const on = getPath(config, control.key) === true;
  return new ButtonBuilder()
    .setCustomId(panelCustomId(panel.segment, view.segment, "toggle", control.key))
    .setLabel(`${control.label}: ${control.state(on, config, context)}`.slice(0, 80))
    .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary);
}

function viewButton<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  control: ViewControl<C>
): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(panelCustomId(panel.segment, view.segment, "view", control.key))
    .setLabel(control.label.slice(0, 80))
    .setStyle(ButtonStyle.Secondary);
}

function choiceRow<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  control: ChoiceControl<C>,
  config: C,
  context: PanelContext
): ActionRowBuilder<StringSelectMenuBuilder> {
  const current = getPath(config, control.key);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(panelCustomId(panel.segment, view.segment, "choice", control.key))
      .setPlaceholder(control.label)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        control.options(config, context).map(option => {
          const option_ = new StringSelectMenuOptionBuilder()
            .setLabel(option.label)
            .setValue(option.value)
            .setDefault(option.value === current);
          if (option.description !== undefined) {
            option_.setDescription(option.description.slice(0, 100));
          }
          return option_;
        })
      )
  );
}

/**
 * The fields block: the subtitle, the panel's intro, the view's summary,
 * and one line per control showing its label and current value.
 */
function fieldLines<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  config: C,
  context: PanelContext
): string[] {
  const lines: string[] = [];
  if (panel.subtitle) {
    lines.push(`-# ${panel.subtitle}`);
  }
  for (const line of panel.intro?.(config, context) ?? []) {
    lines.push(line);
  }
  for (const line of view.summary?.(config, context) ?? []) {
    lines.push(line);
  }
  for (const control of view.controls(config, context)) {
    // A view control's button already names what it opens, so it gets no
    // value line; its description still renders.
    if (control.kind !== "view") {
      lines.push(`**${control.label}:** ${displayValue(control, config, context)}`);
    }
    if (control.description) {
      lines.push(`-# ${control.description}`);
    }
  }
  const footer = panel.footer?.(config, context);
  if (footer) {
    lines.push("", `-# ${footer}`);
  }
  return lines;
}

/**
 * Render one panel view: the heading, the fields, the controls, and any
 * read-only sections below them.
 */
export async function renderPanel<C extends object>(
  panel: Panel<C>,
  context: PanelContext,
  viewSegment: string
): Promise<RenderedPanel> {
  const config = await panel.getConfig(context.guild);
  const view = panel.viewFor(config, viewSegment);
  const container = new ContainerBuilder();
  const accent = panel.accent?.(config, view, context);
  if (accent !== undefined) {
    container.setAccentColor(accent);
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [`## ${panel.title}`, ...fieldLines(panel, view, config, context)].join("\n")
    )
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  const switcher = viewSelectRow(panel, view, config, context);
  if (switcher) {
    container.addActionRowComponents(switcher);
  }
  for (const row of controlComponents(panel, view, config, context)) {
    container.addActionRowComponents(row);
  }

  // Sections that a view control carries are opened on button press, not
  // rendered under the controls.
  const hiddenSections = new Set(
    view
      .controls(config, context)
      .filter(control => control.kind === "view")
      .map(control => control.key)
  );
  const sections: ContainerBuilder[] = [];
  for (const section of view.sections?.(config, context) ?? []) {
    if (hiddenSections.has(section.id)) {
      continue;
    }
    if (section.kind === "embed") {
      continue;
    }
    const body = await section.render(config, context);
    if (body === null || body.length === 0 || typeof body !== "string") {
      continue;
    }
    const block = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    if (accent !== undefined) {
      block.setAccentColor(accent);
    }
    sections.push(block);
  }

  return { components: [container, ...sections], flags: MessageFlags.IsComponentsV2 };
}

/**
 * The embeds a panel wants shown below it, one per embed section that
 * rendered. A V2 message cannot carry embeds, so the caller sends these as
 * a separate message and keeps it reconciled with the panel.
 */
export async function renderPanelEmbeds<C extends object>(
  panel: Panel<C>,
  context: PanelContext,
  viewSegment: string
): Promise<EmbedBuilder[]> {
  const config = await panel.getConfig(context.guild);
  const view = panel.viewFor(config, viewSegment);
  const embeds: EmbedBuilder[] = [];
  for (const section of view.sections?.(config, context) ?? []) {
    if (section.kind !== "embed") {
      continue;
    }
    const body = await section.render(config, context);
    if (body !== null && typeof body !== "string") {
      embeds.push(body);
    }
  }
  return embeds;
}

/**
 * The contents a view control opens: the first text section the view
 * carries under that id, or null when it has none. The router shows the
 * result as its own message on button press.
 */
export async function renderPanelViewSection<C extends object>(
  panel: Panel<C>,
  context: PanelContext,
  viewSegment: string,
  key: string
): Promise<string | null> {
  const config = await panel.getConfig(context.guild);
  const view = panel.viewFor(config, viewSegment);
  for (const section of view.sections?.(config, context) ?? []) {
    if (section.id !== key || section.kind !== "text") {
      continue;
    }
    const body = await section.render(config, context);
    if (typeof body === "string" && body.length > 0) {
      return body;
    }
    return null;
  }
  return null;
}

/**
 * The dialog for a control, pre-filled with the current value so an edit
 * is one keystroke and clearing it unsets the field.
 */
export async function panelDialog<C extends object>(
  panel: Panel<C>,
  context: PanelContext,
  viewSegment: string,
  control: DialogControl<C>
): Promise<ModalBuilder> {
  const config = await panel.getConfig(context.guild);
  const view = panel.viewFor(config, viewSegment);
  const current = getPath(config, control.key);
  const modal = new ModalBuilder()
    .setCustomId(panelCustomId(panel.segment, view.segment, "dialog", control.key))
    .setTitle((control.modalTitle ?? control.label).slice(0, 45));

  if (control.input === "channel") {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel(control.label.slice(0, 45))
        .setDescription((control.hint ?? "Clear the selection to unset.").slice(0, 100))
        .setChannelSelectMenuComponent(channelPicker(context.guild, current))
    );
    return modal;
  }
  if (control.input === "role") {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel(control.label.slice(0, 45))
        .setDescription((control.hint ?? "Clear the selection to unset.").slice(0, 100))
        .setRoleSelectMenuComponent(rolePicker(context.guild, current))
    );
    return modal;
  }
  if (control.input === "role-list") {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel(control.label.slice(0, 45))
        .setDescription((control.hint ?? "Remove every role to clear the list.").slice(0, 100))
        .setRoleSelectMenuComponent(roleListPicker(context.guild, current, control.maxRoles ?? ROLE_LIST_MAX))
    );
    return modal;
  }

  const label = new LabelBuilder().setLabel(control.label.slice(0, 45));
  if (control.hint) {
    label.setDescription(control.hint.slice(0, 100));
  }
  modal.addLabelComponents(label.setTextInputComponent(textInput(control, current)));
  return modal;
}

function textInput<C>(control: DialogControl<C>, current: unknown): TextInputBuilder {
  const value =
    typeof current === "string" ? current : current === null || current === undefined ? "" : String(current);
  return new TextInputBuilder()
    .setCustomId(DIALOG_VALUE)
    .setStyle(control.input === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setValue(value)
    .setPlaceholder((control.hint ?? "").slice(0, 100))
    .setRequired(false)
    .setMaxLength(control.input === "paragraph" ? 2000 : 256);
}

/** Default values must be resolvable, so a deleted channel is not preselected. */
function channelPicker(guild: Guild, current: unknown): ChannelSelectMenuBuilder {
  const picker = new ChannelSelectMenuBuilder()
    .setCustomId(DIALOG_VALUE)
    .setPlaceholder("Choose a channel")
    .setMinValues(0)
    .setMaxValues(1)
    .setRequired(false);
  if (typeof current === "string" && guild.channels.cache.has(current)) {
    picker.setDefaultChannels(current);
  }
  return picker;
}

/** A single role picker: the current role preselected when it still exists. */
function rolePicker(guild: Guild, current: unknown): RoleSelectMenuBuilder {
  const picker = new RoleSelectMenuBuilder()
    .setCustomId(DIALOG_VALUE)
    .setPlaceholder("Choose a role")
    .setMinValues(0)
    .setMaxValues(1)
    .setRequired(false);
  if (typeof current === "string" && guild.roles.cache.has(current)) {
    picker.setDefaultRoles(current);
  }
  return picker;
}

/**
 * A multi-role picker: up to `max` roles, the current ones preselected
 * (deleted ones dropped, since the API rejects unresolvable defaults), and
 * an empty selection allowed to clear the list.
 */
function roleListPicker(guild: Guild, current: unknown, max: number): RoleSelectMenuBuilder {
  const picker = new RoleSelectMenuBuilder()
    .setCustomId(DIALOG_VALUE)
    .setPlaceholder(`Choose up to ${max} roles`)
    .setMinValues(0)
    .setMaxValues(Math.max(1, Math.min(max, ROLE_LIST_MAX)))
    .setRequired(false);
  const selected = (Array.isArray(current) ? current : []).filter(
    (id): id is string => typeof id === "string" && guild.roles.cache.has(id)
  );
  if (selected.length > 0) {
    picker.setDefaultRoles(...selected.slice(0, Math.max(1, Math.min(max, ROLE_LIST_MAX))));
  }
  return picker;
}

/**
 * Read a dialog's submitted value. The raw field map is used deliberately:
 * an optional picker that was cleared is absent from the payload entirely,
 * and the typed getters throw rather than report an empty selection. A
 * picker (channel/role/role-list) comes back as its array of selected ids;
 * a text input as its string.
 */
export function readDialogValue(interaction: ModalSubmitInteraction): string | string[] | null {
  const field = interaction.fields.fields.get(DIALOG_VALUE) as
    { value?: string; values?: readonly string[] } | undefined;
  if (!field) {
    return null;
  }
  if (field.values) {
    return [...field.values];
  }
  return field.value ?? null;
}
