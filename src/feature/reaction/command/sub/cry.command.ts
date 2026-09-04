import SelfReactionCommand from "../self-reaction.command";

export default class CryCommand extends SelfReactionCommand {
  constructor() {
    super("cry", "Have a little cry");
  }
  protected readonly gifCategory = "cry";
  protected readonly phrase = "cries";
}
