import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  type Guild,
  type MessageApplicationCommandData,
  type MessageContextMenuCommandInteraction,
  type UserApplicationCommandData,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import type GlobalUser from "../user/global-user";

export interface ContextMenuExecuteContext {
  user: GlobalUser;
  guild: Guild | null;
  ctx: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction;
}

/**
 * Abstract base for context menu application commands (user/message).
 *
 * Mirrors {@link Command} but targets context menu commands instead
 * of chat-input slash commands.
 */
export default abstract class ContextMenuCommand {
  public readonly id: string;
  public readonly displayName: string;

  private readonly subCommands: Map<string, ContextMenuCommand> = new Map<string, ContextMenuCommand>();

  constructor(id: string, displayName: string) {
    this.id = id;
    this.displayName = displayName;
  }

  public get userInstallable(): boolean {
    return false;
  }

  public registerSubCommand(command: ContextMenuCommand): void {
    this.subCommands.set(command.id, command);
  }

  protected abstract get commandType(): ApplicationCommandType.User | ApplicationCommandType.Message;

  /**
   * Discord has no separate description for user/message commands: `name` is
   * the label rendered in the context menu, so `displayName` is sent as-is
   * (`id` stays the internal identifier, e.g. for logging).
   */
  public build(): UserApplicationCommandData | MessageApplicationCommandData {
    const base: UserApplicationCommandData | MessageApplicationCommandData = {
      name: this.displayName,
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

  public async execute(context: ContextMenuExecuteContext): Promise<void> {
    const { ctx } = context;
    const subCommandName = ctx.commandName;
    const subCommand = this.subCommands.get(subCommandName);
    if (subCommand) {
      return subCommand.execute(context);
    }
    return this.onExecute(context);
  }

  protected abstract onExecute(context: ContextMenuExecuteContext): Promise<void>;
}
