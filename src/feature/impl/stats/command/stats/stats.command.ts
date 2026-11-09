import Command from "@/command/command";
import KindCommand from "./sub/kind.command";
import ServerCommand from "./sub/server.command";

export default class StatsCommand extends Command {
  constructor() {
    super({ id: "stats", displayName: "Show activity stats as a card" });
    this.registerSubCommand(new KindCommand("messages", "Show message stats as a card"));
    this.registerSubCommand(new KindCommand("voice", "Show voice stats as a card"));
    this.registerSubCommand(new KindCommand("overall", "Show combined activity stats as a card"));
    this.registerSubCommand(new ServerCommand());
  }
}
