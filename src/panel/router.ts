import GlobalUsersManager from "@/user/global-users-manager";
import {
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  type ButtonInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import type Panel from "./panel";
import {
  parsePanelCustomId,
  type DialogControl,
  type PanelContext,
  type PanelCustomId,
  type PanelView,
} from "./panel";
import { getPath } from "./path";
import {
  panelDialog,
  readDialogValue,
  renderPanel,
  renderPanelEmbeds,
  renderPanelViewSection,
} from "./render";

/** A component press the engine can act on. */
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
  const control = view
    .controls(config, context)
    .find(candidate => candidate.kind === decoded.kind && candidate.key === decoded.path);
  if (!control) {
    return;
  }

  // A view button carries no setting; it opens its section as its own
  // message so long reference content does not sit under the controls.
  if (control.kind === "view") {
    const body = await renderPanelViewSection(panel, context, view.segment, control.key);
    // A V2 container needs the flag; ephemeral keeps the reference content
    // to the presser rather than spamming the channel.
    await interaction.reply({
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(body ?? "Nothing to show here.")
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
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
    await panel.updateConfig(context.guild, view, control.key, selected);
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
  await panel.updateConfig(context.guild, view, control.key, next);
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
  await panel.updateConfig(context.guild, view, control.key, value);
  if (!interaction.message) {
    return;
  }
  await interaction.deferUpdate();
  await interaction.message.edit(await renderPanel(panel, context, view.segment));
  await syncEmbeds(panel, context, view.segment, interaction.channelId);
}

async function repaint(
  panel: Panel<any>,
  context: PanelContext,
  viewSegment: string,
  interaction: PanelInteraction
): Promise<void> {
  if (interaction.isModalSubmit()) {
    return;
  }
  await interaction.update(await renderPanel(panel, context, viewSegment));
  await syncEmbeds(panel, context, viewSegment, interaction.channelId);
}

/**
 * Keep a panel's embed previews current. They cannot live on the panel
 * message (the V2 flag makes `embeds` inert), so they are a companion
 * message below it: created on first render, edited thereafter, and
 * deleted when a view no longer wants any.
 */
async function syncEmbeds(
  panel: Panel<any>,
  context: PanelContext,
  viewSegment: string,
  channelId: string | null
): Promise<void> {
  const embeds = await renderPanelEmbeds(panel, context, viewSegment);
  const channel = channelId ? context.guild.channels.cache.get(channelId) : null;
  if (!channel?.isSendable() || !channel.isTextBased()) {
    return;
  }
  const existingId = panel.embedMessageId(context.guild);
  const existing = existingId ? await channel.messages.fetch(existingId).catch(() => null) : null;
  // Previews render against a real user and can carry mention syntax; the
  // preview is for display, so it must never ping.
  const payload = { embeds, allowedMentions: { parse: [] as [] } };
  if (embeds.length === 0) {
    await existing?.delete().catch(() => undefined);
    panel.rememberEmbedMessage(context.guild, null);
    return;
  }
  if (existing) {
    await existing.edit(payload).catch(() => undefined);
    return;
  }
  const sent = await channel.send(payload).catch(() => null);
  panel.rememberEmbedMessage(context.guild, sent?.id ?? null);
}

async function deny(interaction: PanelInteraction, message: string): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
}
