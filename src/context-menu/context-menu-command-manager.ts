import type { MessageApplicationCommandData, UserApplicationCommandData } from "discord.js";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import ContextMenuReceivedEvent from "../event/events/context-menu-received.event";
import GlobalUsersManager from "../user/global-users-manager";
import type ContextMenuCommand from "./context-menu-command";
import AvatarCommand from "./impl/avatar.command";
import BannerCommand from "./impl/banner.command";

/**
 * Manages context menu application commands: builds them for registration
 * and exposes them to the interaction listener for dispatch.
 */
export default class ContextMenuCommandManager {
  private static commands = new Map<string, ContextMenuCommand>();

  constructor() {
    this.registerCommand(new AvatarCommand());
    this.registerCommand(new BannerCommand());
    console.log(`Context menu commands registered: ${ContextMenuCommandManager.commands.size}`);
  }

  /**
   * Look up a context menu command by its id.
   */
  public static getCommand(commandName: string): ContextMenuCommand | undefined {
    return ContextMenuCommandManager.commands.get(commandName);
  }

  /**
   * Build every local context menu command for registration.
   */
  public build(): Array<UserApplicationCommandData | MessageApplicationCommandData> {
    return Array.from(ContextMenuCommandManager.commands.values()).map(command => command.build());
  }

  private registerCommand(command: ContextMenuCommand): void {
    ContextMenuCommandManager.commands.set(command.id, command);
    console.log(`Registered context menu command: ${command.id} - ${command.displayName}`);
  }
}

/**
 * Dispatches user/message context-menu interactions to their handlers.
 */
export class ContextMenuCommandListener extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(ContextMenuReceivedEvent)
  public async onContextMenuReceived(event: ContextMenuReceivedEvent): Promise<void> {
    const interaction = event.interaction;
    if (!interaction.isUserContextMenuCommand() && !interaction.isMessageContextMenuCommand()) {
      return;
    }

    const commandName = interaction.commandName;
    const command = ContextMenuCommandManager.getCommand(commandName);
    if (!command) {
      console.log(`Unknown context menu command: ${commandName}`);
      return;
    }

    try {
      const globalUser = await GlobalUsersManager.getCached(interaction.user);
      await command.execute({ globalUser, guild: interaction.guild, ctx: interaction });
    } catch (error) {
      console.error(`Error executing context menu command "${commandName}":`, error);
    }
  }
}
