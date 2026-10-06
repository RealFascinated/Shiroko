import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class HugCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "hug", displayName: "Give someone a big hug" });
  }
  protected readonly interactionType: InteractionType = "hug";
  protected readonly gifCategory: GifCategory = "hug";
  protected readonly verb: string = "hugs";
  protected readonly emoji: string = "🤗";
}
