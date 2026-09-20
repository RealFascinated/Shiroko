import type {
  ButtonInteraction,
  Interaction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import SettingsManager from "..";
import { fetchGuildMember } from "../../lib/guild";
import Permissions, { PermissionFlags } from "../../permission/permissions";
import { PANEL_ACTION, dialogFor, handleDialogSubmit, handleSelectApply, renderPanel } from "../panel";
import type SettingsModule from "../settings-module";

/**
 * Route an `edit` press (a button) to the descriptor's dialog.
 */
async function onEdit(
  interaction: ButtonInteraction,
  moduleId: string,
  guildId: string,
  key: string,
  commandName: string | null
): Promise<void> {
  const guild = interaction.guild;
  const module = SettingsManager.get(moduleId);
  if (!guild || !module) {
    return;
  }
  const descriptor = module.descriptor(key);
  if (!descriptor) {
    return;
  }
  const modal = await dialogFor(module, descriptor, guild);
  await interaction.showModal(modal);
}

/**
 * Route a `submit` press (a modal form) to parse/persist/re-render.
 */
async function onSubmit(
  interaction: ModalSubmitInteraction,
  moduleId: string,
  guildId: string,
  key: string,
  commandName: string | null
): Promise<void> {
  const module = SettingsManager.get(moduleId);
  if (!module) {
    return;
  }
  const descriptor = module.descriptor(key);
  if (!descriptor) {
    return;
  }
  const guild = interaction.guild;
  const categoryIds = guild ? (await SettingsManager.enabledModules(guild)).map(m => m.id) : [];
  await handleDialogSubmit(interaction, module, descriptor, categoryIds, commandName);
}

/**
 * Route an `apply` press (a boolean/choice select) to persist/re-render.
 */
async function onApply(
  interaction: StringSelectMenuInteraction,
  moduleId: string,
  guildId: string,
  key: string,
  commandName: string | null
): Promise<void> {
  const module = SettingsManager.get(moduleId);
  if (!module) {
    return;
  }
  const descriptor = module.descriptor(key);
  if (!descriptor) {
    return;
  }
  const guild = interaction.guild;
  const categoryIds = guild ? (await SettingsManager.enabledModules(guild)).map(m => m.id) : [];
  await handleSelectApply(interaction, module, descriptor, categoryIds, commandName);
}

/**
 * Route a category navigation press: switch the panel to a module's
 * help section and action rows.
 */
async function onNavigate(
  interaction: StringSelectMenuInteraction,
  module: SettingsModule<any>,
  categoryIds: string[],
  commandName: string | null
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  const panel = await renderPanel(commandName, guild, categoryIds, module);
  await interaction.update(panel);
}

/**
 * Stateless component registry for the settings panel. Custom ids are
 * self-describing: `<moduleId>:<guildId>:<key>:<action>` (or the fixed
 * `settings:modules` navigation id). Every press is authorized fresh
 * against the `/settings` permission gate.
 */
export default class ComponentRegistry {
  /**
   * Route a component/modal interaction to its panel handler, after
   * authorizing that the presser holds the settings gate.
   */
  public static async handle(
    interaction: Interaction,
    commandName: string | null = "settings"
  ): Promise<void> {
    if (!interaction.inGuild() || !interaction.guild) {
      return;
    }
    const guild = interaction.guild;
    const member = await fetchGuildMember(guild, interaction.user.id);
    const flags = member ? await Permissions.memberFlags(guild, member) : 0n;
    if ((flags & PermissionFlags.SETTINGS_COMMAND) !== PermissionFlags.SETTINGS_COMMAND) {
      return; // unauthorized presses are ignored entirely
    }

    try {
      // Only message-component and modal-submit interactions carry
      // custom ids; anything else is not a settings panel press.
      if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) {
        return;
      }

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === `settings:${PANEL_ACTION.categories}`
      ) {
        const moduleId = interaction.values[0];
        const module = moduleId ? SettingsManager.get(moduleId) : undefined;
        const categoryIds = (await SettingsManager.enabledModules(guild)).map(m => m.id);
        if (moduleId && module) {
          await onNavigate(interaction, module, categoryIds, commandName);
        }
        return;
      }

      const parts = interaction.customId.split(":");
      if (parts.length !== 4) {
        return;
      }
      const [moduleId, guildId, key, action] = parts;
      if (moduleId === undefined || guildId === undefined || key === undefined || action === undefined) {
        return;
      }
      if (guildId !== guild.id) {
        return;
      }
      if (action === PANEL_ACTION.edit && interaction.isButton()) {
        await onEdit(interaction, moduleId, guildId, key, commandName);
        return;
      }
      if (action === PANEL_ACTION.submit && interaction.isModalSubmit()) {
        await onSubmit(interaction, moduleId, guildId, key, commandName);
        return;
      }
      if (action === PANEL_ACTION.apply && interaction.isStringSelectMenu()) {
        await onApply(interaction, moduleId, guildId, key, commandName);
        return;
      }
    } catch (error) {
      // Discord caps interaction tokens at 15 minutes; past that,
      // update/showModal throw, and the panel simply dies on its own.
      console.error("Settings component press failed:", error);
    }
  }
}
