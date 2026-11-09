import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ContainerBuilder,
  EmbedBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AttachmentPayload,
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
  type ToggleChecklist,
  type ToggleControl,
  type ViewControl,
  toggleChecklists,
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
 * inert under the V2 flag, so everything is a component. `files` carries
 * the images that image sections reference; the empty `attachments` makes
 * an edit replace the message's previous files instead of keeping them.
 */
export interface RenderedPanel {
  components: ContainerBuilder[];
  files: AttachmentPayload[];
  attachments: [];
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
      .setPlaceholder(panel.viewPlaceholder ?? "View")
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
 * The controls that edit a view, added to the container in declaration
 * order. A dialog or a lone toggle is a section whose button sits beside
 * its label and value; a choice is its label over a select; grouped
 * toggles are one checklist, placed where the group's first toggle is
 * declared. View buttons open reference content rather than editing
 * anything, so they share a row at the end.
 */
function addControls<C extends object>(
  container: ContainerBuilder,
  panel: Panel<C>,
  view: PanelView<C>,
  config: C,
  context: PanelContext
): void {
  const controls = view.controls(config, context);
  const checklists = toggleChecklists(controls);
  const viewButtons: ButtonBuilder[] = [];

  for (const control of controls) {
    if (control.kind === "view") {
      viewButtons.push(viewButton(panel, view, control));
      continue;
    }
    if (control.kind === "choice") {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(controlText(control.label, null, control.description))
      );
      container.addActionRowComponents(choiceRow(panel, view, control, config, context));
      continue;
    }
    if (control.kind === "toggle" && control.group !== undefined) {
      for (const checklist of checklists.filter(candidate => candidate.toggles[0] === control)) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(checklistText(checklist, config))
        );
        container.addActionRowComponents(checklistRow(panel, view, checklist, config));
      }
      continue;
    }
    const value = control.kind === "dialog" ? displayValue(control, config, context) : null;
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(controlText(control.label, value, control.description))
        )
        .setButtonAccessory(
          control.kind === "toggle"
            ? toggleButton(panel, view, control, config, context)
            : dialogButton(panel, view, control, config, context)
        )
    );
  }

  for (let index = 0; index < viewButtons.length; index += BUTTONS_PER_ROW) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(viewButtons.slice(index, index + BUTTONS_PER_ROW))
    );
  }
}

function controlText(label: string, value: string | null, description: string | undefined): string {
  const lines = [`**${label}**`];
  if (value !== null) {
    lines.push(value);
  }
  if (description) {
    lines.push(`-# ${description}`);
  }
  return lines.join("\n");
}

function checklistText<C>(checklist: ToggleChecklist<C>, config: C): string {
  return [
    `**${checklist.label}**`,
    ...checklist.toggles.map(
      toggle => `${getPath(config, toggle.key) === true ? "✅" : "⬛"} ${toggle.label}`
    ),
  ].join("\n");
}

function checklistRow<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  checklist: ToggleChecklist<C>,
  config: C
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(panelCustomId(panel.segment, view.segment, "toggles", checklist.id))
      .setPlaceholder("None enabled")
      .setMinValues(0)
      .setMaxValues(checklist.toggles.length)
      .addOptions(
        checklist.toggles.map(toggle => {
          const option = new StringSelectMenuOptionBuilder()
            .setLabel(toggle.label.slice(0, 100))
            .setValue(toggle.key)
            .setDefault(getPath(config, toggle.key) === true);
          if (toggle.description !== undefined) {
            option.setDescription(toggle.description.slice(0, 100));
          }
          return option;
        })
      )
  );
}

function dialogButton<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  control: DialogControl<C>,
  config: C,
  context: PanelContext
): ButtonBuilder {
  const value = getPath(config, control.key);
  const caption = control.button?.(value, config, context) ?? "Edit";
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
    .setLabel(control.state(on, config, context).slice(0, 80))
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

function headerLines<C extends object>(
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
  return lines;
}

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
      [`## ${panel.title}`, ...headerLines(panel, view, config, context)].join("\n")
    )
  );
  const switcher = viewSelectRow(panel, view, config, context);
  if (switcher) {
    container.addActionRowComponents(switcher);
  }
  if (view.controls(config, context).length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    addControls(container, panel, view, config, context);
  }
  const footer = panel.footer?.(config, context);
  if (footer) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
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
  const files: AttachmentPayload[] = [];
  for (const section of view.sections?.(config, context) ?? []) {
    if (hiddenSections.has(section.id)) {
      continue;
    }
    if (section.kind === "embed") {
      continue;
    }
    const body = await section.render(config, context);
    let block: ContainerBuilder;
    if (body instanceof Buffer) {
      const name = `${section.id}.png`;
      files.push({ attachment: body, name });
      block = new ContainerBuilder().addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(item => item.setURL(`attachment://${name}`))
      );
    } else if (typeof body === "string" && body.length > 0) {
      block = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    } else {
      continue;
    }
    if (accent !== undefined) {
      block.setAccentColor(accent);
    }
    sections.push(block);
  }

  return {
    components: [container, ...sections],
    files,
    attachments: [],
    flags: MessageFlags.IsComponentsV2,
  };
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
    if (body instanceof EmbedBuilder) {
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
