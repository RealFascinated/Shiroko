import { ApplicationCommandType, Events } from "discord.js";
import type { Client } from "discord.js";
import type AppCommand from "./app-command";
import type GlobalUser from "../user/global-user";
import GlobalUsersManager from "../user/global-users-manager";
import AvatarCommand from "../feature/interaction/command/app/avatar.command";

/**
 * Manages context menu application commands: syncs with Discord API
 * and dispatches user/message context interactions to their handlers.
 */
export default class AppCommandManager {
  private commands = new Map<string, AppCommand>();

  constructor() {
    this.registerCommand(new AvatarCommand());
    console.log(`App commands registered: ${this.commands.size}`);
  }

  /**
   * Sync local app commands with Discord: register/update every local command,
   * and delete any Discord command that no longer exists locally.
   */
  public async sync(client: Client): Promise<void> {
    const application = client.application;
    if (!application) {
      throw new Error("Application is not available; call sync after the client logs in");
    }
    const { commands } = application;
    const local = Array.from(this.commands.values()).map((command) => command.build());

    const remote = await commands.fetch();
    for (const remoteCommand of remote.values()) {
      // Only manage context menu commands, not slash commands
      if (
        remoteCommand.type !== ApplicationCommandType.User &&
        remoteCommand.type !== ApplicationCommandType.Message
      ) {
        continue;
      }
      if (!this.commands.has(remoteCommand.name)) {
        await remoteCommand.delete();
        console.log(`Deleted stale app command: ${remoteCommand.name}`);
      }
    }

    // Register/update all local commands without touching other managers' commands.
    for (const commandData of local) {
      const existing = remote.find(
        (command) => command.name === commandData.name && command.type === commandData.type
      );
      if (existing) {
        await existing.edit(commandData);
      } else {
        await commands.create(commandData);
      }
    }
    console.log(`Synced ${this.commands.size} app command(s)`);
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
    this.commands.set(command.registeredName, command);
    console.log(`Registered app command: ${command.id} - ${command.displayName}`);
  }
}
