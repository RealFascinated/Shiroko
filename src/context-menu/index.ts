import type { MessageApplicationCommandData, UserApplicationCommandData } from "discord.js";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import ContextMenuReceivedEvent from "../event/events/context-menu-received.event";
import { replyFailure } from "../lib/interaction-error";
import type { CommandDurationMetric, CommandErrorsMetric } from "../metrics/impl/commands";
import GlobalUsersManager from "../user/global-users-manager";
import type ContextMenuCommand from "./context-menu-command";
import AvatarCommand from "./impl/avatar.command";
import BannerCommand from "./impl/banner.command";

export default class ContextMenuCommandManager {
  private static readonly COMMANDS: Map<string, ContextMenuCommand> = new Map<string, ContextMenuCommand>();

  constructor() {
    ContextMenuCommandManager.registerCommand(new AvatarCommand());
    ContextMenuCommandManager.registerCommand(new BannerCommand());
  }

  /**
   * Commands are keyed by the name Discord sent with the interaction, which
   * for user/message commands is the display name (see `build`).
   */
  public static getCommand(commandName: string): ContextMenuCommand | undefined {
    return ContextMenuCommandManager.COMMANDS.get(commandName);
  }

  public static build(): Array<UserApplicationCommandData | MessageApplicationCommandData> {
    return Array.from(ContextMenuCommandManager.COMMANDS.values(), command => command.build());
  }

  private static registerCommand(command: ContextMenuCommand): void {
    if (ContextMenuCommandManager.COMMANDS.has(command.displayName)) {
      throw new Error(`Context menu command "${command.displayName}" is already registered`);
    }
    ContextMenuCommandManager.COMMANDS.set(command.displayName, command);
    console.log(`Registered context menu command: ${command.id} - ${command.displayName}`);
  }
}

export class ContextMenuCommandListener extends EventListener {
  constructor(
    private readonly duration: CommandDurationMetric,
    private readonly errors: CommandErrorsMetric
  ) {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(ContextMenuReceivedEvent)
  public async onContextMenuReceived(event: ContextMenuReceivedEvent): Promise<void> {
    const interaction = event.interaction;
    const commandName = interaction.commandName;
    const command = ContextMenuCommandManager.getCommand(commandName);
    if (!command) {
      console.log(`Unknown context menu command: ${commandName}`);
      return;
    }

    const started = performance.now();
    try {
      const globalUser = await GlobalUsersManager.getUser(interaction.user);
      await command.execute({ user: globalUser, guild: interaction.guild, ctx: interaction });
    } catch (error) {
      this.errors.increment(command.displayName);
      console.error(`Error executing context menu command "${commandName}":`, error);
      await replyFailure(interaction);
    } finally {
      this.duration.observe(command.displayName, performance.now() - started);
    }
  }
}
