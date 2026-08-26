import type { Client } from "discord.js";
import { Events, type SlashCommandBuilder } from "discord.js";
import BalanceCommand from "../feature/economy/command/balance.command";
import BankCommand from "../feature/economy/command/bank.command";
import BegCommand from "../feature/economy/command/beg.command";
import DailyCommand from "../feature/economy/command/daily.command";
import GambleCommand from "../feature/economy/command/gamble.command";
import PayCommand from "../feature/economy/command/pay.command";
import RichCommand from "../feature/economy/command/rich.command";
import WorkCommand from "../feature/economy/command/work.command";
import TestCommand from "../feature/interaction/command/interaction.command";
import QuestsCommand from "../feature/quest/command/quests.command";
import GlobalUsersManager from "../user/global-users-manager";
import type Command from "./command";
import AvatarCommand from "./commands/avatar.command";
import BlehCommand from "./commands/bleh.command";
import PingCommand from "./commands/ping.command";
import UserCommand from "./commands/user.command";
import ParsedArguments from "./parsed-arguments";

export default class CommandManager {
  private commands = new Map<string, Command>();

  constructor() {
    this.registerCommand(new TestCommand());
    this.registerCommand(new PingCommand());
    this.registerCommand(new AvatarCommand());
    this.registerCommand(new UserCommand());
    this.registerCommand(new DailyCommand());
    this.registerCommand(new BegCommand());
    this.registerCommand(new WorkCommand());
    this.registerCommand(new GambleCommand());
    this.registerCommand(new BankCommand());
    this.registerCommand(new BalanceCommand());
    this.registerCommand(new RichCommand());
    this.registerCommand(new QuestsCommand());
    this.registerCommand(new PayCommand());
    this.registerCommand(new BlehCommand());
    console.log(`Registered commands: ${this.commands.size}`);
  }

  /**
   * Build every local slash command for registration.
   */
  public build(): SlashCommandBuilder[] {
    return Array.from(this.commands.values()).map(command => command.build());
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
      const command = this.commands.get(commandName);
      if (!command) {
        console.log(`Unknown command: ${commandName}`);
        return;
      }

      const guild = interaction.guild;
      if (!guild && !command.userInstallable) {
        return;
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

  private registerCommand(command: Command) {
    this.commands.set(command.slashCommand.name, command);
    console.log(`Registered command: ${command.id} - ${command.displayName}`);
  }
}
