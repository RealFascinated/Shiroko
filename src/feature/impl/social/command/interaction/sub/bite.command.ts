import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class BiteCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "bite", displayName: "Bite someone" });
  }
  protected readonly interactionType: InteractionType = "bite";
  protected readonly gifCategory: GifCategory = "bite";
  protected readonly verb: string = "bites";
  protected readonly emoji: string = "🦷";
}
