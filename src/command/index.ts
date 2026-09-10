import type { SlashCommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import SlashCommandReceivedEvent from "../event/events/slash-command-received.event";
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
   * Look up a registered command by its top-level name.
   */
  public static getCommand(commandName: string): Command | undefined {
    return CommandManager.COMMANDS.get(commandName);
  }

  /**
   * Build every local slash command for registration.
   */
  public build(): SlashCommandBuilder[] {
    return Array.from(CommandManager.COMMANDS.values()).map(command => command.build());
  }

  public static registerCommand(command: Command): void {
    CommandManager.COMMANDS.set(command.slashCommand.name, command);
    console.log(`Registered command: ${command.id} - ${command.displayName}`);
    for (const sub of command.subCommands.values()) {
      console.log(`  └─ ${sub.id} - ${sub.displayName}`);
    }
  }
}

/**
 * Dispatches chat-input (slash) command interactions to their handlers,
 * applying the feature gate and permission checks.
 */
export class SlashCommandListener extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(SlashCommandReceivedEvent)
  public async onSlashCommandReceived(event: SlashCommandReceivedEvent): Promise<void> {
    const interaction = event.interaction;
    if (!interaction.isChatInputCommand()) {
      return;
    }
    const { commandName } = interaction;
    const command = CommandManager.getCommand(commandName);
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
        await interaction.reply({
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
        await interaction.reply({
          content: "You don't have permission to use this command.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    try {
      const user = await GlobalUsersManager.getCached(interaction.user);
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
  }
}
