import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class BonkCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "bonk", displayName: "Bonk someone on the head" });
  }
  protected readonly interactionType: InteractionType = "bonk";
  protected readonly gifCategory: GifCategory = "bonk";
  protected readonly verb: string = "bonks";
  protected readonly emoji: string = "🥴";
}
