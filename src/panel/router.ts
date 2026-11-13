import { replyFailure } from "@/lib/interaction-error";
import GlobalUsersManager from "@/user/global-users-manager";
import {
  MessageFlags,
  type ButtonInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import type Panel from "./panel";
import {
  parsePanelCustomId,
  type DialogControl,
  type MapControl,
  type PanelContext,
  type PanelCustomId,
  type PanelView,
} from "./panel";
import { getPath } from "./path";
import {
  panelDialog,
  panelMapDialog,
  readDialogValue,
  readMapDialog,
  renderPanel,
  renderPlaceholders,
} from "./render";

type PanelInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

/**
 * Route an interaction to its panel, returning `true` when the interaction
 * belonged to the panel system. Every press re-reads the config and
 * re-resolves the control before acting, so a message rendered before a
 * control changed can never write a value its panel no longer offers.
 *
 * The panel is erased to `Panel<any>` here on purpose: a registry cannot
 * know a panel's config type, and every value crossing this boundary comes
 * from that panel's own controls. The `any` is contained to this boundary
 * and never reaches a panel implementation.
 */
export async function handlePanelInteraction(
  interaction: Interaction,
  resolve: (segment: string) => Panel<any> | undefined
): Promise<boolean> {
  if (!interaction.inGuild() || !interaction.guild) {
    return false;
  }
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) {
    return false;
  }
  const decoded = parsePanelCustomId(interaction.customId);
  if (!decoded) {
    return false;
  }
  const panel = resolve(decoded.segment);
  if (!panel) {
    return false;
  }
  try {
    const context: PanelContext = {
      guild: interaction.guild,
      user: await GlobalUsersManager.getUser(interaction.user),
    };
    await dispatch(panel, context, decoded, interaction);
  } catch (error) {
    console.error(`Error handling panel interaction "${interaction.customId}":`, error);
    await replyFailure(interaction);
  }
  return true;
}

async function dispatch(
  panel: Panel<any>,
  context: PanelContext,
  decoded: PanelCustomId,
  interaction: PanelInteraction
): Promise<void> {
  const config = await panel.getConfig(context.guild);
  if (panel.access && !(await panel.access.authorized(context, config))) {
    await deny(interaction, panel.access.denied());
    return;
  }

  // A root component is the view switcher: it carries no value and only
  // changes which view is rendered.
  if (decoded.kind === "root" || decoded.path === null) {
    const segment = interaction.isStringSelectMenu()
      ? (interaction.values[0] ?? decoded.viewSegment)
      : decoded.viewSegment;
    await repaint(panel, context, segment, interaction);
    return;
  }

  const view = panel.viewFor(config, decoded.viewSegment);

  if (decoded.kind === "page") {
    await repaint(panel, context, view.segment, interaction, decoded.path);
    return;
  }
  if (decoded.kind === "placeholders") {
    const field = view
      .controls(config, context)
      .find(
        (candidate): candidate is DialogControl<any> =>
          candidate.kind === "dialog" && candidate.key === decoded.path
      );
    if (field?.placeholders) {
      await interaction.reply(renderPlaceholders(field.placeholders.catalog()));
    }
    return;
  }
  if (decoded.kind === "map" || decoded.kind === "map-remove") {
    const map = view
      .controls(config, context)
      .find(
        (candidate): candidate is MapControl<any> =>
          candidate.kind === "map" && candidate.key === decoded.path
      );
    if (map) {
      await dispatchMap(panel, context, view, map, interaction, config);
    }
    return;
  }
  const control = view
    .controls(config, context)
    .find(candidate => candidate.kind === decoded.kind && candidate.key === decoded.path);
  if (!control || control.kind === "map") {
    return;
  }

  if (interaction.isModalSubmit()) {
    await submitDialog(panel, context, view, control as DialogControl<any>, interaction, config);
    return;
  }
  if (interaction.isStringSelectMenu()) {
    const selected = interaction.values[0];
    if (selected === undefined) {
      return;
    }
    const problem = control.validateValue?.(selected, config, context);
    if (problem) {
      await deny(interaction, problem);
      return;
    }
    await panel.updateConfig(context.guild, view, control.key, selected, context.user.id);
    await repaint(panel, context, view.segment, interaction);
    return;
  }
  if (control.kind === "dialog") {
    await interaction.showModal(await panelDialog(panel, context, view.segment, control));
    return;
  }
  const next = getPath(config, control.key) !== true;
  const problem = control.validateValue?.(next, config, context);
  if (problem) {
    await deny(interaction, problem);
    return;
  }
  await panel.updateConfig(context.guild, view, control.key, next, context.user.id);
  await repaint(panel, context, view.segment, interaction, control.key);
}

/**
 * A map control's three interactions: the Add button opens its dialog, the
 * dialog's submit writes `<map>.<key>` with the chosen role, and the remove
 * select writes `null` to the picked entry.
 */
async function dispatchMap(
  panel: Panel<any>,
  context: PanelContext,
  view: PanelView<any>,
  control: MapControl<any>,
  interaction: PanelInteraction,
  config: unknown
): Promise<void> {
  let entryKey: string | undefined;
  let roleId: string | null = null;
  if (interaction.isButton()) {
    await interaction.showModal(panelMapDialog(panel, view, control));
    return;
  }
  if (interaction.isStringSelectMenu()) {
    entryKey = interaction.values[0];
  } else if (interaction.isModalSubmit()) {
    const submitted = readMapDialog(interaction);
    entryKey = submitted.key;
    roleId = submitted.roleId;
    const problem =
      control.validateKey?.(entryKey, config, context) ??
      (roleId === null ? "Choose a role." : control.validateRole?.(roleId, config, context));
    if (problem) {
      await deny(interaction, problem);
      return;
    }
  }
  if (entryKey === undefined) {
    return;
  }
  await panel.updateConfig(context.guild, view, `${control.key}.${entryKey}`, roleId, context.user.id);
  if (interaction.isModalSubmit()) {
    if (interaction.message) {
      await interaction.deferUpdate();
      await interaction.message.edit(await renderPanel(panel, context, view.segment));
    }
    return;
  }
  await repaint(panel, context, view.segment, interaction);
}

async function submitDialog(
  panel: Panel<any>,
  context: PanelContext,
  view: PanelView<any>,
  control: DialogControl<any>,
  interaction: ModalSubmitInteraction,
  config: unknown
): Promise<void> {
  const input = readDialogValue(interaction);

  let value: unknown;
  if (control.input === "text" || control.input === "paragraph") {
    const raw = (input as string | null) ?? "";
    const problem = control.validate?.(raw, config, context);
    if (problem) {
      await deny(interaction, problem);
      return;
    }
    // A transform is authoritative when present: it may legitimately return
    // `null` to mean "unset", so `??` must not fall back to the raw input.
    value = control.transform ? control.transform(raw, config, context) : raw;
  } else {
    // A picker submits resolved ids: an empty (cleared) selection is absent
    // from the payload entirely. A single picker stores one id or null when
    // cleared; the role-list picker stores the whole array.
    const ids = input === null ? [] : (input as string[]);
    value = control.input === "role-list" ? ids : (ids[0] ?? null);
  }
  const problem = control.validateValue?.(value, config, context);
  if (problem) {
    await deny(interaction, problem);
    return;
  }
  await panel.updateConfig(context.guild, view, control.key, value, context.user.id);
  if (!interaction.message) {
    return;
  }
  await interaction.deferUpdate();
  await interaction.message.edit(await renderPanel(panel, context, view.segment));
}

async function repaint(
  panel: Panel<any>,
  context: PanelContext,
  viewSegment: string,
  interaction: PanelInteraction,
  focus?: string
): Promise<void> {
  if (interaction.isModalSubmit()) {
    return;
  }
  await interaction.update(await renderPanel(panel, context, viewSegment, focus));
}

async function deny(interaction: PanelInteraction, message: string): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
}
