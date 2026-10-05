import SelfReactionCommand from "../self-reaction.command";

export default class AngryCommand extends SelfReactionCommand {
  constructor() {
    super({ id: "angry", displayName: "Show off your anger" });
  }
  protected readonly gifCategory = "angry";
  protected readonly phrase = "is angry";
}
