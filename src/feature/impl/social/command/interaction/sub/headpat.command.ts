import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class HeadpatCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "headpat", displayName: "Give someone a headpat" });
  }
  protected readonly interactionType: InteractionType = "headpat";
  protected readonly gifCategory: GifCategory = "pat";
  protected readonly verb: string = "headpats";
  protected readonly emoji: string = "🐾";
}
