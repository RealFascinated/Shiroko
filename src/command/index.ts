import type { SlashCommandBuilder } from "discord.js";
import { MessageFlags, type ApplicationCommand, type Collection } from "discord.js";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import SlashCommandReceivedEvent from "../event/events/slash-command-received.event";
import GuildFeatures from "../feature/guild-features";
import { fetchGuildMember } from "../lib/guild";
import { replyFailure } from "../lib/interaction-error";
import CommandCallService from "../metrics/command-calls.service";
import type { CommandDurationMetric, CommandErrorsMetric } from "../metrics/impl/commands";
import Permissions, { hasFlags } from "../permission/permissions";
import GlobalUsersManager from "../user/global-users-manager";
import type Command from "./command";
import ParsedArguments from "./parsed-arguments";
import CommandRegistry from "./registry";

/**
 * Builds and dispatches the slash commands that features registered in
 * `CommandRegistry`.
 */
export default class CommandManager {
  public static getCommand(commandName: string): Command | undefined {
    return CommandRegistry.get(commandName);
  }

  /**
   * Stamp each registered command with the application command snowflake
   * Discord assigned during the ready-time sync, so commands can render
   * clickable `</name:id>` mentions. Commands absent from the collection keep
   * the id they already have: syncing the private guild commands must not
   * clear the global ids.
   */
  public static applyApplicationCommandIds(commands: Collection<string, ApplicationCommand>): void {
    for (const command of CommandRegistry.all()) {
      const appId = commands.find(candidate => candidate.name === command.id)?.id;
      if (appId === undefined) {
        continue;
      }
      command.applicationCommandId = appId;
      for (const sub of command.subCommands.values()) {
        sub.applicationCommandId = appId;
      }
    }
  }

  public static buildGlobal(): SlashCommandBuilder[] {
    return CommandRegistry.all()
      .filter(command => !command.private)
      .map(command => command.build());
  }

  public static buildPrivate(): SlashCommandBuilder[] {
    return CommandRegistry.all()
      .filter(command => command.private)
      .map(command => command.build());
  }
}

export class SlashCommandListener extends EventListener {
  constructor(
    private readonly duration: CommandDurationMetric,
    private readonly errors: CommandErrorsMetric
  ) {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(SlashCommandReceivedEvent)
  public async onSlashCommandReceived(event: SlashCommandReceivedEvent): Promise<void> {
    const interaction = event.interaction;
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

    const started = performance.now();
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
      this.errors.increment(command.id);
      console.error(`Error executing command "${commandName}":`, error);
      await replyFailure(interaction);
    } finally {
      this.duration.observe(command.id, performance.now() - started);
    }
  }
}
