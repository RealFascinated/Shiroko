import type { SlashCommandBuilder } from "discord.js";
import { MessageFlags, type ApplicationCommand, type Collection } from "discord.js";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import SlashCommandReceivedEvent from "../event/events/slash-command-received.event";
import GuildFeatures from "../feature/guild-features";
import StatsCommand from "../feature/impl/stats/command/stats/stats.command";
import { fetchGuildMember } from "../lib/guild";
import CommandCallService from "../metrics/command-calls.service";
import Permissions, { hasFlags } from "../permission/permissions";
import GlobalUsersManager from "../user/global-users-manager";
import type Command from "./command";
import ParsedArguments from "./parsed-arguments";

export default class CommandManager {
  private static COMMANDS: Map<string, Command> = new Map<string, Command>();

  constructor() {
    CommandManager.registerCommand(new StatsCommand());
  }

  public static getCommand(commandName: string): Command | undefined {
    return CommandManager.COMMANDS.get(commandName);
  }

  /**
   * Stamp each registered command with the application command snowflake
   * Discord assigned during the ready-time sync, so commands can render
   * clickable `</name:id>` mentions. Subcommands share their parent's id.
   */
  public static applyApplicationCommandIds(commands: Collection<string, ApplicationCommand>): void {
    for (const command of CommandManager.COMMANDS.values()) {
      const appId = commands.find(candidate => candidate.name === command.id)?.id ?? null;
      command.applicationCommandId = appId;
      for (const sub of command.subCommands.values()) {
        sub.applicationCommandId = appId;
      }
    }
  }

  /**
   * Global commands: visible in every guild the bot is installed in.
   */
  public buildGlobal(): SlashCommandBuilder[] {
    return CommandManager.all()
      .filter(command => !command.private)
      .map(command => command.build());
  }

  /**
   * Private commands: guild commands scoped to `PRIVATE_COMMANDS_GUILD_ID` only.
   */
  public buildPrivate(): SlashCommandBuilder[] {
    return CommandManager.all()
      .filter(command => command.private)
      .map(command => command.build());
  }

  private static all(): Command[] {
    return Array.from(CommandManager.COMMANDS.values());
  }

  public static registerCommand(command: Command): void {
    CommandManager.COMMANDS.set(command.slashCommand.name, command);
    console.log(`Registered command: ${command.id} - ${command.displayName}`);
    for (const sub of command.subCommands.values()) {
      console.log(`  └─ ${sub.id} - ${sub.displayName}`);
    }
  }
}

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
    const subCommandName = interaction.options.getSubcommand(false);
    const resolved = subCommandName ? command.subCommands.get(subCommandName) : undefined;

    const guild = interaction.guild;
    if (!guild && !(resolved ?? command).userInstallable) {
      return;
    }

    // A subcommand's own `featureId` wins; otherwise it inherits the
    // parent's, so a feature command gates its whole family.
    const featureId = resolved?.featureId ?? command.featureId;
    if (guild && featureId) {
      const enabled = await GuildFeatures.isFeatureEnabled(guild, featureId);
      if (!enabled) {
        await interaction.reply({
          content: `The \`${featureId}\` feature is disabled in this server.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // A subcommand that declares its own gate wins; otherwise the whole
    // command inherits the parent's gate, so a gate usually lives on the
    // parent (e.g. `/permissions`, `/settings`).
    const gate = resolved && resolved.requiredFlags !== 0n ? resolved : command;
    if (guild && gate.requiredFlags !== 0n) {
      const member = await fetchGuildMember(guild, interaction.user.id);
      const flags = member ? await Permissions.memberFlags(guild, member) : 0n;
      if (!hasFlags(flags, gate.requiredFlags)) {
        await interaction.reply({
          content: "You don't have permission to use this command.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    try {
      const user = await GlobalUsersManager.getUser(interaction.user);
      const args = new ParsedArguments(interaction.options);
      void CommandCallService.record(command.id);
      await command.executeSlash({
        user,
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
