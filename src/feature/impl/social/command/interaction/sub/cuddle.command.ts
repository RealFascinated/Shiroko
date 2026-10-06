import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class CuddleCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "cuddle", displayName: "Cuddle someone" });
  }
  protected readonly interactionType: InteractionType = "cuddle";
  protected readonly gifCategory: GifCategory = "cuddle";
  protected readonly verb: string = "cuddles";
  protected readonly emoji: string = "🫂";
}
