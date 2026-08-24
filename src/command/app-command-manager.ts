import {
  Events,
  type MessageApplicationCommandData,
  type UserApplicationCommandData,
} from "discord.js";
import type { Client } from "discord.js";
import type AppCommand from "./app-command";
import type GlobalUser from "../user/global-user";
import GlobalUsersManager from "../user/global-users-manager";
import AvatarCommand from "../feature/interaction/command/app/avatar.command";

/**
 * Manages context menu application commands: builds them for registration
 * and dispatches user/message context interactions to their handlers.
 */
export default class AppCommandManager {
  private commands = new Map<string, AppCommand>();

  constructor() {
    this.registerCommand(new AvatarCommand());
    console.log(`App commands registered: ${this.commands.size}`);
  }

  /**
   * Build every local app command for registration.
   */
  public build(): Array<UserApplicationCommandData | MessageApplicationCommandData> {
    return Array.from(this.commands.values()).map((command) => command.build());
  }

  /**
   * Register the interaction handler that dispatches context menu commands
   * to their matching command's execute.
   */
  public registerHandlers(client: Client): void {
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isUserContextMenuCommand() && !interaction.isMessageContextMenuCommand()) {
        return;
      }

      const commandName = interaction.commandName;
      const command = this.commands.get(commandName);
      if (!command) {
        console.log(`Unknown app command: ${commandName}`);
        return;
      }

      try {
        const globalUser = await GlobalUsersManager.getUser(interaction.user);
        await command.execute({ globalUser, guild: interaction.guild, ctx: interaction });
      } catch (error) {
        console.error(`Error executing app command "${commandName}":`, error);
      }
    });
  }

  private registerCommand(command: AppCommand) {
    this.commands.set(command.id, command);
    console.log(`Registered app command: ${command.id} - ${command.displayName}`);
  }
}
