import PairInteractionCommand from "../pair-interaction.command";

export default class HugCommand extends PairInteractionCommand {
  constructor() {
    super("hug", "Give someone a big hug");
  }
  protected readonly interactionType = "hug";
  protected readonly gifCategory = "hug";
  protected readonly verb = "hugs";
}
