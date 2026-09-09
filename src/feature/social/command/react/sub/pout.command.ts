import SelfReactionCommand from "../self-reaction.command";

export default class PoutCommand extends SelfReactionCommand {
  constructor() {
    super("pout", "Express a pouty mood");
  }
  protected readonly gifCategory = "pout";
  protected readonly phrase = "pouts";
}
