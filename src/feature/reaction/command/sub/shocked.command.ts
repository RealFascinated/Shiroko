import SelfReactionCommand from "../self-reaction.command";

export default class ShockedCommand extends SelfReactionCommand {
  constructor() {
    super("shocked", "Express your shock");
  }
  protected readonly gifCategory = "shocked";
  protected readonly phrase = "is shocked";
}
