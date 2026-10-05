import SelfReactionCommand from "../self-reaction.command";

export default class SmugCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "smug", displayName: "Strut around all smug" });
  }
  protected readonly gifCategory = "smug";
  protected readonly phrase = "feels smug";
}
