import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class TeaseCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "tease", displayName: "Tease someone" });
  }
  protected readonly interactionType: InteractionType = "tease";
  protected readonly gifCategory: GifCategory = "kabedon";
  protected readonly verb: string = "teases";
  protected readonly emoji: string = "😏";
}
