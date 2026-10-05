import PairInteractionCommand from "../pair-interaction.command";

export default class FeedCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "feed", displayName: "Feed someone" });
  }
  protected readonly interactionType = "feed";
  protected readonly gifCategory = "feed";
  protected readonly verb = "feeds";
  protected readonly emoji = "🍜";
}
