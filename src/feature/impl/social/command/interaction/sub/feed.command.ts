import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class FeedCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "feed", displayName: "Feed someone" });
  }
  protected readonly interactionType: InteractionType = "feed";
  protected readonly gifCategory: GifCategory = "feed";
  protected readonly verb: string = "feeds";
  protected readonly emoji: string = "🍜";
}
