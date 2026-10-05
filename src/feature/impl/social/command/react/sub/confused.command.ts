import SelfReactionCommand from "../self-reaction.command";

export default class ConfusedCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "confused", displayName: "Express your confusion" });
  }
  protected readonly gifCategory = "confused";
  protected readonly phrase = "is confused";
}
