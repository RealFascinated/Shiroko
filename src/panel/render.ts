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
  ThumbnailBuilder,
  type AttachmentPayload,
  type Guild,
  type ModalSubmitInteraction,
} from "discord.js";
import type Panel from "./panel";
import {
  panelCustomId,
  type ChoiceControl,
  type DialogControl,
  type MapControl,
  type PanelContext,
  type PanelControl,
  type PanelView,
  type ToggleControl,
} from "./panel";
import { getPath } from "./path";

/** The hard ceiling on roles in a role-list: Discord's 25 select options. */
const ROLE_LIST_MAX = 25;

/** The modal input's field id, read back on submit. */
export const DIALOG_VALUE = "value";

/** The key field's id in a map's add dialog; its role picker uses `DIALOG_VALUE`. */
const MAP_KEY = "key";

/** Discord's cap on options in a select menu. */
const SELECT_OPTIONS_MAX = 25;

/** Buttons per action row, Discord's cap. */
const BUTTONS_PER_ROW = 5;

/**
 * Switches per page of a toggle group. Each costs three components
 * (section, text, button), so eight keeps a page with a few other
 * controls under Discord's 40-component cap on a message.
 */
const TOGGLES_PER_PAGE = 8;

interface ToggleGroup<C> {
  label: string;
  toggles: ToggleControl<C>[];
}

function toggleGroups<C>(controls: readonly PanelControl<C>[]): ToggleGroup<C>[] {
  const groups = new Map<string, ToggleControl<C>[]>();
  for (const control of controls) {
    if (control.kind === "toggle" && control.group !== undefined) {
      groups.set(control.group, [...(groups.get(control.group) ?? []), control]);
    }
  }
  return [...groups].map(([label, toggles]) => ({ label, toggles }));
}

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
  // Previews render against a real user and can carry mention syntax; a
  // panel is for display, so it must never ping.
  allowedMentions: { parse: [] };
}

/** How every panel shows a value that is not set, so no panel invents its own. */
export const UNSET_VALUE = "*Not set*";

/**
 * A control's current value as display text. Unset values (null, empty
 * text, an empty list) read the same everywhere and never reach a
 * formatter. Text without a formatter is shown as code, so a template's
 * markdown and tokens read literally rather than rendering.
 */
export function displayValue<C>(
  control: Exclude<PanelControl<C>, MapControl<C>>,
  config: C,
  context: PanelContext
): string {
  const raw = getPath(config, control.key);
  if (control.kind === "toggle") {
    return control.state(raw === true, config, context);
  }
  if (raw === null || raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0)) {
    return UNSET_VALUE;
  }
  if (control.kind === "choice") {
    return control.options(config, context).find(candidate => candidate.value === raw)?.label ?? UNSET_VALUE;
  }
  if (control.format) {
    return control.format(raw, config, context);
  }
  if (typeof raw !== "string") {
    return String(raw);
  }
  return raw.includes("\n") ? "```\n" + raw + "\n```" : "`" + raw + "`";
}

function viewSelectRow<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  config: C,
  context: PanelContext
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  // One option per category, opening the category's first view.
  const categories = new Map<string, { label: string; segment: string }>();
  for (const candidate of panel.views(config)) {
    const { id, label } = categoryOf(candidate);
    if (!categories.has(id)) {
      categories.set(id, { label, segment: candidate.segment });
    }
  }
  if (categories.size < 2) {
    return null;
  }
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(panelCustomId(panel.segment, view.segment, "root"))
      .setPlaceholder(panel.viewPlaceholder ?? "View")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        [...categories].map(([id, category]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(category.label)
            .setValue(category.segment)
            .setDefault(id === categoryOf(view).id)
        )
      )
  );
}

function categoryOf<C>(view: PanelView<C>): { id: string; label: string } {
  return view.category ?? { id: view.id, label: view.label };
}

/**
 * The tab buttons for the current view's category, in rows of five, or none
 * when the category has a single view. The current tab is highlighted.
 */
function tabRows<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  config: C
): ActionRowBuilder<ButtonBuilder>[] {
  const tabs = panel.views(config).filter(candidate => categoryOf(candidate).id === categoryOf(view).id);
  if (tabs.length < 2) {
    return [];
  }
  const buttons = tabs.map(tab =>
    new ButtonBuilder()
      .setCustomId(panelCustomId(panel.segment, view.segment, "tab", tab.segment))
      .setLabel(tab.label.slice(0, 80))
      .setStyle(tab.segment === view.segment ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let index = 0; index < buttons.length; index += BUTTONS_PER_ROW) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(index, index + BUTTONS_PER_ROW))
    );
  }
  return rows;
}

/**
 * The controls that edit a view, added to the container in declaration
 * order. A dialog or a lone toggle is a section whose button sits beside
 * its label and value; a choice is its label over a select; grouped
 * toggles are one paged list, placed where the group's first toggle is
 * declared. Placeholder buttons open reference content rather than
 * editing anything, so they share a row at the end: one per distinct
 * token set, named after its field only when the view has several.
 */
function addControls<C extends object>(
  container: ContainerBuilder,
  panel: Panel<C>,
  view: PanelView<C>,
  config: C,
  context: PanelContext,
  focus: string | undefined
): void {
  const controls = view.controls(config, context);
  const groups = toggleGroups(controls);
  const catalogs = new Map<DialogControl<C>["placeholders"], DialogControl<C>>();

  for (const control of controls) {
    if (control.kind === "dialog" && control.placeholders && !catalogs.has(control.placeholders)) {
      catalogs.set(control.placeholders, control);
    }
    if (control.kind === "choice") {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(controlText(control.label, null, control.description))
      );
      container.addActionRowComponents(choiceRow(panel, view, control, config, context));
      continue;
    }
    if (control.kind === "map") {
      addMap(container, panel, view, control, config);
      continue;
    }
    if (control.kind === "toggle" && control.group !== undefined) {
      const group = groups.find(candidate => candidate.toggles[0] === control);
      if (group) {
        addToggleGroup(container, panel, view, group, config, context, focus);
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

  const placeholderButtons = [...catalogs.values()].map(control =>
    new ButtonBuilder()
      .setCustomId(panelCustomId(panel.segment, view.segment, "placeholders", control.key))
      .setLabel((catalogs.size === 1 ? "📖 Placeholders" : `📖 ${control.label} placeholders`).slice(0, 80))
      .setStyle(ButtonStyle.Secondary)
  );
  for (let index = 0; index < placeholderButtons.length; index += BUTTONS_PER_ROW) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        placeholderButtons.slice(index, index + BUTTONS_PER_ROW)
      )
    );
  }
}

/**
 * A map's entries as a list with an Add button, plus a select to remove one
 * when there are any. The select is capped at Discord's 25 options.
 */
function addMap<C extends object>(
  container: ContainerBuilder,
  panel: Panel<C>,
  view: PanelView<C>,
  control: MapControl<C>,
  config: C
): void {
  const entries = Object.entries((getPath(config, control.key) as Record<string, unknown> | undefined) ?? {});
  const lines =
    entries.length === 0
      ? UNSET_VALUE
      : entries
          .map(([key, value]) => `${control.keyLabel} **${key}**: ${control.describe(value)}`)
          .join("\n");
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(controlText(control.label, lines, control.description))
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(panelCustomId(panel.segment, view.segment, "map", control.key))
          .setLabel("Add")
          .setStyle(ButtonStyle.Secondary)
      )
  );
  if (entries.length === 0) {
    return;
  }
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(panelCustomId(panel.segment, view.segment, "map-remove", control.key))
        .setPlaceholder(`Remove a ${control.keyLabel.toLowerCase()}`)
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          entries
            .slice(0, SELECT_OPTIONS_MAX)
            .map(([key]) =>
              new StringSelectMenuOptionBuilder().setLabel(`${control.keyLabel} ${key}`).setValue(key)
            )
        )
    )
  );
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

/**
 * One page of a toggle group: its heading, a row per switch on the page,
 * and Previous/Next buttons when there is more than one page. The page
 * shown is the one holding `focus`, so a press on a switch or a page
 * button repaints the page it came from without the message storing any
 * state. Each page button names its target page by that page's first key.
 */
function addToggleGroup<C extends object>(
  container: ContainerBuilder,
  panel: Panel<C>,
  view: PanelView<C>,
  group: ToggleGroup<C>,
  config: C,
  context: PanelContext,
  focus: string | undefined
): void {
  const pages = Math.ceil(group.toggles.length / TOGGLES_PER_PAGE);
  const focused = group.toggles.findIndex(toggle => toggle.key === focus);
  const page = focused < 0 ? 0 : Math.floor(focused / TOGGLES_PER_PAGE);
  const on = group.toggles.filter(toggle => getPath(config, toggle.key) === true).length;
  const position = pages > 1 ? ` · Page ${page + 1} of ${pages}` : "";
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**${group.label}**\n-# ${on} of ${group.toggles.length} on${position}`
    )
  );
  for (const toggle of group.toggles.slice(page * TOGGLES_PER_PAGE, (page + 1) * TOGGLES_PER_PAGE)) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(controlText(toggle.label, null, toggle.description))
        )
        .setButtonAccessory(toggleButton(panel, view, toggle, config, context))
    );
  }
  if (pages < 2) {
    return;
  }
  const pageButton = (target: number, label: string): ButtonBuilder =>
    new ButtonBuilder()
      .setCustomId(
        panelCustomId(panel.segment, view.segment, "page", group.toggles[target * TOGGLES_PER_PAGE]!.key)
      )
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(target === page);
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      pageButton(Math.max(page - 1, 0), "◀ Previous"),
      pageButton(Math.min(page + 1, pages - 1), "Next ▶")
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

function headerLines<C extends object>(panel: Panel<C>, config: C, context: PanelContext): string[] {
  const lines: string[] = [];
  if (panel.subtitle) {
    lines.push(`-# ${panel.subtitle}`);
  }
  for (const line of panel.intro?.(config, context) ?? []) {
    lines.push(line);
  }
  return lines;
}

/**
 * Render a panel's view. `focus` is the key of a grouped toggle whose page
 * should be shown; every other group shows its first page.
 */
export async function renderPanel<C extends object>(
  panel: Panel<C>,
  context: PanelContext,
  viewSegment: string,
  focus?: string
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
      [`## ${panel.title}`, ...headerLines(panel, config, context)].join("\n")
    )
  );
  const switcher = viewSelectRow(panel, view, config, context);
  if (switcher) {
    container.addActionRowComponents(switcher);
  }
  container.addActionRowComponents(...tabRows(panel, view, config));
  // The view's own content sits below the switcher, so switching views
  // changes everything under it and nothing above.
  const summary = view.summary?.(config, context) ?? [];
  if (summary.length > 0 || view.controls(config, context).length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
  }
  if (summary.length > 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(summary.join("\n")));
  }
  addControls(container, panel, view, config, context, focus);
  const footer = panel.footer?.(config, context);
  if (footer) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
  }

  const sections: ContainerBuilder[] = [];
  const files: AttachmentPayload[] = [];
  for (const section of view.sections?.(config, context) ?? []) {
    const body = await section.render(config, context);
    let block: ContainerBuilder;
    if (body instanceof EmbedBuilder) {
      block = embedContainer(body);
    } else if (body instanceof Buffer) {
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
    if (accent !== undefined && block.data.accent_color === undefined) {
      block.setAccentColor(accent);
    }
    sections.push(block);
  }

  return {
    components: [container, ...sections],
    files,
    attachments: [],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

/**
 * An embed drawn as a V2 container, so an embed section shows inside the
 * panel message (whose V2 flag makes real `embeds` inert). The author icon
 * has no V2 equivalent and is dropped; the thumbnail becomes the section's
 * accessory.
 */
function embedContainer(embed: EmbedBuilder): ContainerBuilder {
  const { author, title, description, thumbnail, timestamp, color } = embed.data;
  const text = new TextDisplayBuilder().setContent(
    [author ? `**${author.name}**` : null, title ? `### ${title}` : null, description ?? null]
      .filter(line => line !== null)
      .join("\n")
  );
  const container = new ContainerBuilder();
  if (color !== undefined) {
    container.setAccentColor(color);
  }
  if (thumbnail) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail.url))
    );
  } else {
    container.addTextDisplayComponents(text);
  }
  if (timestamp) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.parse(timestamp) / 1000)}:f>`)
    );
  }
  return container;
}

/**
 * The reply a placeholders button opens: ephemeral, so the reference goes
 * to the presser rather than the channel.
 */
export function renderPlaceholders(catalog: string): {
  components: ContainerBuilder[];
  flags: number;
} {
  return {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "## Placeholders",
            "-# Type these into the field; each is replaced when the message is sent.",
            "",
            catalog,
          ].join("\n")
        )
      ),
    ],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  };
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

/** The dialog a map's Add button opens: a key to type and a role to pick. */
export function panelMapDialog<C extends object>(
  panel: Panel<C>,
  view: PanelView<C>,
  control: MapControl<C>
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(panelCustomId(panel.segment, view.segment, "map", control.key))
    .setTitle(`Add ${control.keyLabel.toLowerCase()}`.slice(0, 45))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(control.keyLabel.slice(0, 45))
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(MAP_KEY)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(32)
        ),
      new LabelBuilder()
        .setLabel("Role")
        .setRoleSelectMenuComponent(
          new RoleSelectMenuBuilder()
            .setCustomId(DIALOG_VALUE)
            .setPlaceholder("Choose a role")
            .setMinValues(1)
            .setMaxValues(1)
        )
    );
}

/** Read a map dialog's submitted key and role id. */
export function readMapDialog(interaction: ModalSubmitInteraction): { key: string; roleId: string | null } {
  const fields = interaction.fields.fields;
  const key = (fields.get(MAP_KEY) as { value?: string } | undefined)?.value ?? "";
  const roles = (fields.get(DIALOG_VALUE) as { values?: readonly string[] } | undefined)?.values;
  return { key: key.trim(), roleId: roles?.[0] ?? null };
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
