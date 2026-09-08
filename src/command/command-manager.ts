import type { Client } from "discord.js";
import { Events, type SlashCommandBuilder } from "discord.js";
import TestCommand from "../feature/interaction/command/interaction.command";
import ReactCommand from "../feature/reaction/command/react.command";
import StatsCommand from "../feature/stats/command/stats.command";
import GlobalUsersManager from "../user/global-users-manager";
import type Command from "./command";
import AvatarCommand from "./commands/avatar.command";
import BlehCommand from "./commands/bleh.command";
import BotStatsCommand from "./commands/botstats.command";
import GuildInfoCommand from "./commands/guildinfo.command";
import PingCommand from "./commands/ping.command";
import UserCommand from "./commands/user.command";
import ParsedArguments from "./parsed-arguments";

export default class CommandManager {
  private commands = new Map<string, Command>();

  constructor() {
    this.registerCommand(new TestCommand());
    this.registerCommand(new PingCommand());
    this.registerCommand(new AvatarCommand());
    this.registerCommand(new UserCommand());
    this.registerCommand(new GuildInfoCommand());
    this.registerCommand(new BotStatsCommand());
    this.registerCommand(new BlehCommand());
    this.registerCommand(new ReactCommand());
    this.registerCommand(new StatsCommand());
  }

  /**
   * Build every local slash command for registration.
   */
  public build(): SlashCommandBuilder[] {
    return Array.from(this.commands.values()).map(command => command.build());
  }

  /**
   * Register the interaction handler that dispatches chat-input slash commands
   * to their matching command's executeSlash.
   */
  public registerHandlers(client: Client): void {
    client.on(Events.InteractionCreate, async interaction => {
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
        await command.executeSlash({
          globalUser: user,
          guild: guild,
          ctx: interaction,
          args,
          commandName: command.id,
        });
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
