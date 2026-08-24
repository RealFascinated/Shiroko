import { ApplicationCommandType, Events } from "discord.js";
import type { Client } from "discord.js";
import type Command from "./command";
import ParsedArguments from "./parsed-arguments";
import TestCommand from "../feature/interaction/command/interaction.command";
import PingCommand from "./commands/ping.command";
import GlobalUsersManager from "../user/global-users-manager";

export default class CommandManager {
  private commands = new Map<string, Command>();

  constructor() {
    this.registerCommand(new TestCommand());
    this.registerCommand(new PingCommand());
    console.log(`Registered commands: ${this.commands.size}`);
  }

  /**
   * Sync local commands with Discord: register/update every local command,
   * and delete any Discord command that no longer exists locally.
   */
  public async sync(client: Client): Promise<void> {
    const application = client.application;
    if (!application) {
      throw new Error("Application is not available; call sync after the client logs in");
    }
    const { commands } = application;
    const local = Array.from(this.commands.values()).map((command) => command.build());

    // Delete Discord commands that no longer exist locally.
    const remote = await commands.fetch();
    for (const remoteCommand of remote.values()) {
      // Only manage chat-input slash commands, not context menu commands
      if (remoteCommand.type !== ApplicationCommandType.ChatInput) {
        continue;
      }
      if (!this.commands.has(remoteCommand.name)) {
        await remoteCommand.delete();
        console.log(`Deleted stale command: ${remoteCommand.name}`);
      }
    }

    // Register/update all local commands.
    await commands.set(local);
    console.log(`Synced ${this.commands.size} command(s)`);
  }

  /**
   * Register the interaction handler that dispatches chat-input slash commands
   * to their matching command's executeSlash.
   */
  public registerHandlers(client: Client): void {
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) {
        return;
      }
      const { commandName } = interaction;
      const command = this.commands.get(commandName);
      if (!command) {
        console.log(`Unknown command: ${commandName}`);
        return;
      }

      const guild = interaction.guild;
      if (!guild && !command.userInstallable) {
        return;
      }

      try {
        const user = await GlobalUsersManager.getUser(interaction.user);
        const args = new ParsedArguments(interaction.options);
        await command.executeSlash({ globalUser: user, guild: guild, ctx: interaction, args });
      } catch (error) {
        console.error(`Error executing command "${commandName}":`, error);
      }
    });
  }

  private registerCommand(command: Command) {
    this.commands.set(command.slashCommand.name, command);
    console.log(`Registered command: ${command.id} - ${command.displayName}`);
  }
}
