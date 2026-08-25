import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type Guild,
  type InteractionResponse,
  type SlashCommandAttachmentOption,
  type SlashCommandBooleanOption,
  type SlashCommandChannelOption,
  type SlashCommandIntegerOption,
  type SlashCommandMentionableOption,
  type SlashCommandNumberOption,
  type SlashCommandRoleOption,
  type SlashCommandStringOption,
  type SlashCommandUserOption,
} from "discord.js";
import type GlobalUser from "../user/global-user";
import type { CommandOptionBuilder } from "./option";
import type ParsedArguments from "./parsed-arguments";

export interface ExecuteContext {
  globalUser: GlobalUser;
  guild: Guild | null;
  ctx: ChatInputCommandInteraction;
  args: ParsedArguments;
  /** Top-level command id, e.g. `"bank"` for `/bank deposit`. Used for the embed footer. */
  commandName: string;
}

type OptionSubBuilder =
  | SlashCommandStringOption
  | SlashCommandIntegerOption
  | SlashCommandBooleanOption
  | SlashCommandUserOption
  | SlashCommandChannelOption
  | SlashCommandRoleOption
  | SlashCommandNumberOption
  | SlashCommandMentionableOption
  | SlashCommandAttachmentOption;

interface OptionHolder {
  addStringOption(
    input: SlashCommandStringOption | ((builder: SlashCommandStringOption) => SlashCommandStringOption)
  ): unknown;
  addIntegerOption(
    input: SlashCommandIntegerOption | ((builder: SlashCommandIntegerOption) => SlashCommandIntegerOption)
  ): unknown;
  addBooleanOption(
    input: SlashCommandBooleanOption | ((builder: SlashCommandBooleanOption) => SlashCommandBooleanOption)
  ): unknown;
  addUserOption(
    input: SlashCommandUserOption | ((builder: SlashCommandUserOption) => SlashCommandUserOption)
  ): unknown;
  addChannelOption(
    input: SlashCommandChannelOption | ((builder: SlashCommandChannelOption) => SlashCommandChannelOption)
  ): unknown;
  addRoleOption(
    input: SlashCommandRoleOption | ((builder: SlashCommandRoleOption) => SlashCommandRoleOption)
  ): unknown;
  addNumberOption(
    input: SlashCommandNumberOption | ((builder: SlashCommandNumberOption) => SlashCommandNumberOption)
  ): unknown;
  addMentionableOption(
    input:
      | SlashCommandMentionableOption
      | ((builder: SlashCommandMentionableOption) => SlashCommandMentionableOption)
  ): unknown;
  addAttachmentOption(
    input:
      SlashCommandAttachmentOption | ((builder: SlashCommandAttachmentOption) => SlashCommandAttachmentOption)
  ): unknown;
}

type FollowUp =
  | { type: "string"; value: string }
  | { type: "embed"; value: EmbedBuilder }
  | { type: "error"; value: EmbedBuilder };
type FollowUpReturn = InteractionResponse<boolean> | FollowUp;

export default abstract class Command {
  public readonly id: string;
  public readonly displayName: string;
  public readonly slashCommand: SlashCommandBuilder;

  private readonly subCommands: Map<string, Command> = new Map();

  constructor(id: string, displayName: string) {
    this.id = id;
    this.displayName = displayName;
    this.slashCommand = new SlashCommandBuilder().setName(id).setDescription(displayName);
  }

  public get options(): CommandOptionBuilder[] {
    return [];
  }

  /**
   * Whether this command is available to users outside of guilds (user install).
   *
   * When `true`, the command is registered for both guild and user installs
   * and usable in servers, DMs with the bot, and private channels.
   */
  public get userInstallable(): boolean {
    return false;
  }

  /**
   * Register a subcommand that this command exposes in Discord.
   *
   * Discord forbids mixing top-level options and subcommands on one command,
   * so a command with subcommands should not declare its own `options`.
   */
  public registerSubCommand(command: Command): void {
    this.subCommands.set(command.id, command);
  }

  public build(): SlashCommandBuilder {
    if (this.userInstallable) {
      this.slashCommand.setIntegrationTypes(
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall
      );
      this.slashCommand.setContexts(
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
        InteractionContextType.PrivateChannel
      );
    }
    for (const option of this.options) {
      this.addOption(this.slashCommand, option);
    }
    for (const subCommand of this.subCommands.values()) {
      const subBuilder = new SlashCommandSubcommandBuilder()
        .setName(subCommand.id)
        .setDescription(subCommand.displayName);
      for (const option of subCommand.options) {
        this.addOption(subBuilder, option);
      }
      this.slashCommand.addSubcommand(subBuilder);
    }
    return this.slashCommand;
  }

  public async executeSlash(context: ExecuteContext): Promise<FollowUpReturn> {
    const { ctx } = context;
    const subCommandName = ctx.options.getSubcommand(false);
    if (subCommandName) {
      const subCommand = this.subCommands.get(subCommandName);
      if (subCommand) {
        return subCommand.executeSlash(context);
      }
    }
    const reply = await this.onExecuteSlash(context);
    if (isFollowUp(reply)) {
      return finishFollowUp(context, reply);
    }
    return reply;
  }

  protected abstract onExecuteSlash(context: ExecuteContext): Promise<FollowUpReturn>;

  private addOption(builder: OptionHolder, option: CommandOptionBuilder): void {
    switch (option.type) {
      case ApplicationCommandOptionType.String:
        builder.addStringOption(o => this.applyOption(o, option));
        break;
      case ApplicationCommandOptionType.Integer:
        builder.addIntegerOption(o => this.applyOption(o, option));
        break;
      case ApplicationCommandOptionType.Boolean:
        builder.addBooleanOption(o => this.applyOption(o, option));
        break;
      case ApplicationCommandOptionType.User:
        builder.addUserOption(o => this.applyOption(o, option));
        break;
      case ApplicationCommandOptionType.Channel:
        builder.addChannelOption(o => this.applyOption(o, option));
        break;
      case ApplicationCommandOptionType.Role:
        builder.addRoleOption(o => this.applyOption(o, option));
        break;
      case ApplicationCommandOptionType.Number:
        builder.addNumberOption(o => this.applyOption(o, option));
        break;
      case ApplicationCommandOptionType.Mentionable:
        builder.addMentionableOption(o => this.applyOption(o, option));
        break;
      case ApplicationCommandOptionType.Attachment:
        builder.addAttachmentOption(o => this.applyOption(o, option));
        break;
    }
  }

  private applyOption<T extends OptionSubBuilder>(builder: T, option: CommandOptionBuilder): T {
    builder.setName(option.name).setDescription(option.description).setRequired(option.required);
    if (option.choices) {
      const addChoices = (
        builder as {
          addChoices(...choices: Array<{ name: string; value: string | number | boolean }>): unknown;
        }
      ).addChoices;
      const entries = Object.entries(option.choices).filter(
        (entry): entry is [string, string | number | boolean] => entry[1] !== undefined
      );
      if (entries.length > 0) {
        // `choices` maps value -> label, so Discord must receive { name: label, value: key }.
        addChoices.call(builder, ...entries.map(([key, label]) => ({ name: String(label), value: key })));
      }
    }
    return builder;
  }
}

/**
 * Return a plain `ctx.reply(...)` result untouched, or hand `{ value, type }`
 * follow-ups off to `finishFollowUp` so the command's reply is still sent.
 */
function isFollowUp(reply: FollowUpReturn): reply is FollowUp {
  return typeof reply === "object" && "type" in reply;
}

/**
 * Send a follow-up: a plain string, a styled embed, or an error embed.
 * Error follow-ups are always ephemeral — see DESIGN.md.
 */
async function finishFollowUp(
  context: ExecuteContext,
  reply: FollowUp
): Promise<InteractionResponse<boolean>> {
  if (reply.type === "string") {
    return context.ctx.reply(reply.value);
  }
  if (reply.type === "embed") {
    return context.ctx.reply({ embeds: [reply.value] });
  }
  return context.ctx.reply({ embeds: [reply.value], flags: MessageFlags.Ephemeral });
}
