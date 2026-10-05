import SelfReactionCommand from "../self-reaction.command";

export default class HappyCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "happy", displayName: "Show off your happiness" });
  }
  protected readonly gifCategory = "happy";
  protected readonly phrase = "is happy";
}
