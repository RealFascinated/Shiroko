import Command from "@/command/command";
import AddCommand from "./sub/add.command";
import MessageCommand from "./sub/message.command";
import RemoveCommand from "./sub/remove.command";
import ShowCommand from "./sub/show.command";

export default class YoutubeCommand extends Command {
  constructor() {
    super("youtube", "Track YouTube channels and announce new uploads");

    this.registerSubCommand(new AddCommand());
    this.registerSubCommand(new RemoveCommand());
    this.registerSubCommand(new MessageCommand());
    this.registerSubCommand(new ShowCommand());
  }
}
