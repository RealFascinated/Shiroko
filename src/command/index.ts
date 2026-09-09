import type { Client } from "discord.js";
import { Events, MessageFlags, type SlashCommandBuilder } from "discord.js";
import FeatureCommand from "../feature/feature-command";
import GuildFeatures from "../feature/guild-features";
import ReactCommand from "../feature/social/command/react/react.command";
import StatsCommand from "../feature/stats/command/stats.command";
import GlobalUsersManager from "../user/global-users-manager";
import type Command from "./command";
import BotStatsCommand from "./commands/botstats.command";
import GuildInfoCommand from "./commands/guildinfo.command";
import PingCommand from "./commands/ping.command";
import UserCommand from "./commands/user.command";
import ParsedArguments from "./parsed-arguments";

export default class CommandManager {
  private static COMMANDS = new Map<string, Command>();

  constructor() {
    CommandManager.registerCommand(new PingCommand());
    CommandManager.registerCommand(new UserCommand());
    CommandManager.registerCommand(new GuildInfoCommand());
    CommandManager.registerCommand(new BotStatsCommand());
    CommandManager.registerCommand(new StatsCommand());
    CommandManager.registerCommand(new FeatureCommand());
  }

  /**
   * Build every local slash command for registration.
   */
  public build(): SlashCommandBuilder[] {
    return Array.from(CommandManager.COMMANDS.values()).map(command => command.build());
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
      const command = CommandManager.COMMANDS.get(commandName);
      if (!command) {
        console.log(`Unknown command: ${commandName}`);
        return;
      }

      const guild = interaction.guild;
      if (!guild && !command.userInstallable) {
        return;
      }

      if (guild && command.featureId) {
        const enabled = await GuildFeatures.isFeatureEnabled(guild, command.featureId);
        if (!enabled) {
          interaction.reply({
            content: `The \`${command.featureId}\` feature is disabled in this server.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
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

  public static registerCommand(command: Command) {
    CommandManager.COMMANDS.set(command.slashCommand.name, command);
    console.log(`Registered command: ${command.id} - ${command.displayName}`);
    for (const sub of command.subCommands.values()) {
      console.log(`  └─ ${sub.id} - ${sub.displayName}`);
    }
  }
}
