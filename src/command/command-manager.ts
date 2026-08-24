import { Events, type SlashCommandBuilder } from "discord.js";
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
   * Build every local slash command for registration.
   */
  public build(): SlashCommandBuilder[] {
    return Array.from(this.commands.values()).map((command) => command.build());
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
