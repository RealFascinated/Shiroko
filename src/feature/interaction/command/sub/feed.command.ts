import PairInteractionCommand from "../pair-interaction.command";

export default class FeedCommand extends PairInteractionCommand {
  constructor() {
    super("feed", "Feed someone");
  }
  protected readonly interactionType = "feed";
  protected readonly gifCategory = "feed";
  protected readonly verb = "feeds";
}