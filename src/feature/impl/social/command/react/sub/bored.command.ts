import SelfReactionCommand from "../self-reaction.command";

export default class BoredCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "bored", displayName: "Express your boredom" });
  }
  protected readonly gifCategory = "bored";
  protected readonly phrase = "is bored";
}
