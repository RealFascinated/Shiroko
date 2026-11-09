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

export default abstract class ContextMenuCommand {
  public readonly id: string;
  public readonly displayName: string;

  constructor(id: string, displayName: string) {
    this.id = id;
    this.displayName = displayName;
  }

  public get userInstallable(): boolean {
    return false;
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

  public abstract execute(context: ContextMenuExecuteContext): Promise<void>;
}
