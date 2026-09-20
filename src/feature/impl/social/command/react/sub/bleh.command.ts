import SelfReactionCommand from "../self-reaction.command";

export default class BlehCommand extends SelfReactionCommand {
  constructor() {
    super("bleh", "Express your displeasure with a bleh anime gif");
  }
  protected readonly gifCategory = "bleh";
  protected readonly phrase = "feels bleh";
}
