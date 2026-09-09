import Command from "../../../../command/command";
import KindCommand from "./sub/kind.command";
import ServerCommand from "./sub/server.command";

/**
 * Show user activity stats as a card: message counts, voice hours, or both.
 * Guild-only; tracking is per-guild.
 */
export default class StatsCommand extends Command {
  constructor() {
    super("stats", "Show activity stats as a card");
    this.registerSubCommand(new KindCommand("messages", "messages", "Show message stats as a card"));
    this.registerSubCommand(new KindCommand("voice", "voice", "Show voice stats as a card"));
    this.registerSubCommand(new KindCommand("overall", "overall", "Show combined activity stats as a card"));
    this.registerSubCommand(new ServerCommand());
  }
}
