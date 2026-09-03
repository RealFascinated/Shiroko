import PairInteractionCommand from "../pair-interaction.command";

export default class ThumbsupCommand extends PairInteractionCommand {
  constructor() {
    super("thumbsup", "Give someone a thumbs up");
  }
  protected readonly interactionType = "thumbsup";
  protected readonly gifCategory = "thumbsup";
  protected readonly verb = "gives a thumbs up to";
}
