import type { Client } from "discord.js";
import { Events, MessageFlags, type SlashCommandBuilder } from "discord.js";
import FeatureCommand from "../feature/feature-command";
import GuildFeatures from "../feature/guild-features";
import StatsCommand from "../feature/stats/command/stats/stats.command";
import { fetchGuildMember } from "../lib/guild";
import PermissionsCommand from "../permission/command/permissions.command";
import Permissions, { hasFlags } from "../permission/permissions";
import GlobalUsersManager from "../user/global-users-manager";
import type Command from "./command";
import BotStatsCommand from "./commands/botstats.command";
import GuildInfoCommand from "./commands/guildinfo.command";
import PingCommand from "./commands/ping.command";
import UserCommand from "./commands/user/user.command";
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
    CommandManager.registerCommand(new PermissionsCommand());
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

      if (guild && command.requiredFlags !== 0n) {
        const member = await fetchGuildMember(guild, interaction.user.id);
        const flags = member ? await Permissions.memberFlags(guild, member) : 0n;
        if (!hasFlags(flags, command.requiredFlags)) {
          interaction.reply({
            content: "You don't have permission to use this command.",
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
