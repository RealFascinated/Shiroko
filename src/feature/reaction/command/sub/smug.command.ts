import SelfReactionCommand from "../self-reaction.command";

export default class SmugCommand extends SelfReactionCommand {
  constructor() {
    super("smug", "Strut around all smug");
  }
  protected readonly gifCategory = "smug";
  protected readonly phrase = "feels smug";
}
