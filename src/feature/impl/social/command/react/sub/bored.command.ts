import SelfReactionCommand from "../self-reaction.command";

export default class BoredCommand extends SelfReactionCommand {
  constructor() {
    super("bored", "Express your boredom");
  }
  protected readonly gifCategory = "bored";
  protected readonly phrase = "is bored";
}
