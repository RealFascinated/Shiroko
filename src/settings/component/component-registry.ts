import type {
  ButtonInteraction,
  Interaction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import SettingsManager from "..";
import { fetchGuildMember } from "../../lib/guild";
import Permissions, { PermissionFlags } from "../../permission/permissions";
import {
  PANEL_ACTION,
  dialogFor,
  handleDialogSubmit,
  handleSelectApply,
  pageCountFor,
  renderPanel,
} from "../panel";
import type SettingsModule from "../settings-module";

const NAV_PREFIX = `settings:${PANEL_ACTION.page}`;

/**
 * Route an `edit` press (a button) to the descriptor's dialog.
 */
async function onEdit(
  interaction: ButtonInteraction,
  moduleId: string,
  guildId: string,
  page: number,
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
  const modal = await dialogFor(module, descriptor, guild, page);
  await interaction.showModal(modal);
}

/**
 * Route a `submit` press (a modal form) to parse/persist/re-render.
 */
async function onSubmit(
  interaction: ModalSubmitInteraction,
  moduleId: string,
  guildId: string,
  page: number,
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
  const ids = guild ? (await SettingsManager.enabledModules(guild)).map(m => m.id) : [];
  await handleDialogSubmit(interaction, module, descriptor, ids, page, commandName);
}

/**
 * Route an `apply` press (a boolean/choice select) to persist/re-render.
 */
async function onApply(
  interaction: StringSelectMenuInteraction,
  moduleId: string,
  guildId: string,
  page: number,
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
  const ids = guild ? (await SettingsManager.enabledModules(guild)).map(m => m.id) : [];
  await handleSelectApply(interaction, module, descriptor, ids, page, commandName);
}

/**
 * Route a page-navigation press (prev/next) to a different page of the
 * module's settings.
 */
async function onPage(
  interaction: ButtonInteraction,
  moduleId: string,
  guildId: string,
  page: number,
  direction: "prev" | "next",
  commandName: string | null
): Promise<void> {
  const module = SettingsManager.get(moduleId);
  const guild = interaction.guild;
  if (!module || !guild) {
    return;
  }
  const pageCount = pageCountFor(module);
  const target = direction === "next" ? Math.min(pageCount - 1, page + 1) : Math.max(0, page - 1);
  if (target === page) {
    return;
  }
  const ids = (await SettingsManager.enabledModules(guild)).map(m => m.id);
  const panel = await renderPanel(commandName, guild, ids, module, target);
  await interaction.update(panel);
}

/**
 * Route a category navigation press: switch the panel to a module's
 * help section and action rows (page resets to 0).
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
  const panel = await renderPanel(commandName, guild, categoryIds, module, 0);
  await interaction.update(panel);
}

/**
 * Stateless component registry for the settings panel. Custom ids are
 * self-describing for descriptor actions:
 * `<moduleId>:<guildId>:<page>:<key>:<action>`; pagination uses the
 * fixed `settings:page:...` prefix; the category dropdown is
 * `settings:categories`. Every press is authorized fresh against the
 * `/settings` permission gate.
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

      // Category dropdown: swap the whole panel to the chosen module.
      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === `settings:${PANEL_ACTION.categories}`
      ) {
        const moduleId = interaction.values[0];
        const module = moduleId ? SettingsManager.get(moduleId) : undefined;
        const ids = (await SettingsManager.enabledModules(guild)).map(m => m.id);
        if (moduleId && module) {
          await onNavigate(interaction, module, ids, commandName);
        }
        return;
      }

      // Pagination nav: switch to the adjacent page of the same module.
      if (interaction.isButton() && interaction.customId.startsWith(NAV_PREFIX)) {
        const parts = interaction.customId.split(":");
        const moduleId = parts[2];
        const guildId = parts[3];
        const page = Number(parts[4]);
        const direction = parts[5];
        if (
          moduleId !== undefined &&
          guildId === guild.id &&
          Number.isInteger(page) &&
          (direction === "prev" || direction === "next")
        ) {
          await onPage(interaction, moduleId, guildId, page, direction, commandName);
        }
        return;
      }

      const parts = interaction.customId.split(":");
      if (parts.length !== 5) {
        return;
      }
      const [moduleId, guildId, pageStr, key, action] = parts;
      const page = Number(pageStr);
      if (
        moduleId === undefined ||
        guildId === undefined ||
        key === undefined ||
        action === undefined ||
        !Number.isInteger(page)
      ) {
        return;
      }
      if (guildId !== guild.id) {
        return;
      }
      if (action === PANEL_ACTION.edit && interaction.isButton()) {
        await onEdit(interaction, moduleId, guildId, page, key, commandName);
        return;
      }
      if (action === PANEL_ACTION.submit && interaction.isModalSubmit()) {
        await onSubmit(interaction, moduleId, guildId, page, key, commandName);
        return;
      }
      if (action === PANEL_ACTION.apply && interaction.isStringSelectMenu()) {
        await onApply(interaction, moduleId, guildId, page, key, commandName);
        return;
      }
    } catch (error) {
      // Discord caps interaction tokens at 15 minutes; past that,
      // update/showModal throw, and the panel simply dies on its own.
      console.error("Settings component press failed:", error);
    }
  }
}
