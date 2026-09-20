import SelfReactionCommand from "../self-reaction.command";

export default class BlushCommand extends SelfReactionCommand {
  constructor() {
    super("blush", "Get all flustered");
  }
  protected readonly gifCategory = "blush";
  protected readonly phrase = "blushes";
}
