import type { Client } from "discord.js";
import { Events, type MessageApplicationCommandData, type UserApplicationCommandData } from "discord.js";
import GlobalUsersManager from "../user/global-users-manager";
import type ContextMenuCommand from "./context-menu-command";
import AvatarCommand from "./impl/avatar.command";
import BannerCommand from "./impl/banner.command";

/**
 * Manages context menu application commands: builds them for registration
 * and dispatches user/message context interactions to their handlers.
 */
export default class ContextMenuCommandManager {
  private commands = new Map<string, ContextMenuCommand>();

  constructor() {
    this.registerCommand(new AvatarCommand());
    this.registerCommand(new BannerCommand());
    console.log(`Context menu commands registered: ${this.commands.size}`);
  }

  /**
   * Build every local context menu command for registration.
   */
  public build(): Array<UserApplicationCommandData | MessageApplicationCommandData> {
    return Array.from(this.commands.values()).map(command => command.build());
  }

  /**
   * Register the interaction handler that dispatches context menu commands
   * to their matching command's execute.
   */
  public registerHandlers(client: Client): void {
    client.on(Events.InteractionCreate, async interaction => {
      if (!interaction.isUserContextMenuCommand() && !interaction.isMessageContextMenuCommand()) {
        return;
      }

      const commandName = interaction.commandName;
      const command = this.commands.get(commandName);
      if (!command) {
        console.log(`Unknown context menu command: ${commandName}`);
        return;
      }

      try {
        const globalUser = await GlobalUsersManager.getUser(interaction.user);
        await command.execute({ globalUser, guild: interaction.guild, ctx: interaction });
      } catch (error) {
        console.error(`Error executing context menu command "${commandName}":`, error);
      }
    });
  }

  private registerCommand(command: ContextMenuCommand) {
    this.commands.set(command.id, command);
    console.log(`Registered context menu command: ${command.id} - ${command.displayName}`);
  }
}
