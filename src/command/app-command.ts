import {
  ApplicationIntegrationType,
  ApplicationCommandType,
  InteractionContextType,
  type UserContextMenuCommandInteraction,
  type MessageContextMenuCommandInteraction,
  type Guild,
  type UserApplicationCommandData,
  type MessageApplicationCommandData,
} from "discord.js";
import type GlobalUser from "../user/global-user";

export interface AppExecuteContext {
  globalUser: GlobalUser;
  guild: Guild | null;
  ctx: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction;
}

/**
 * Abstract base for context menu application commands (user/message).
 *
 * Mirrors {@link Command} but targets context menu commands instead
 * of chat-input slash commands.
 */
export default abstract class AppCommand {
  public readonly id: string;
  public readonly displayName: string;

  private readonly subCommands = new Map<string, AppCommand>();

  constructor(id: string, displayName: string) {
    this.id = id;
    this.displayName = displayName;
  }

  /**
   * Whether this command is available to users outside of guilds (user install).
   */
  public get userInstallable(): boolean {
    return false;
  }

  /**
   * Register a sub-command that this command exposes in Discord.
   */
  public registerSubCommand(command: AppCommand): void {
    this.subCommands.set(command.id, command);
  }

  /**
   * The command type: User or Message context menu.
   */
  protected abstract get commandType():
    ApplicationCommandType.User | ApplicationCommandType.Message;

  /**
   * Build the final command data object with integration types and contexts applied.
   */
  public build(): UserApplicationCommandData | MessageApplicationCommandData {
    const base: UserApplicationCommandData | MessageApplicationCommandData = {
      name: this.id,
      type: this.commandType,
    };

    if (this.userInstallable) {
      base.integrationTypes = [
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall,
      ];
      base.contexts = [
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
        InteractionContextType.PrivateChannel,
      ];
    }

    return base;
  }

  /**
   * Execute this command when a context menu interaction is received.
   */
  public async execute(context: AppExecuteContext): Promise<void> {
    const { ctx } = context;
    const subCommandName = ctx.commandName;
    const subCommand = this.subCommands.get(subCommandName);
    if (subCommand) {
      return subCommand.execute(context);
    }
    return this.onExecute(context);
  }

  protected abstract onExecute(context: AppExecuteContext): Promise<void>;
}
