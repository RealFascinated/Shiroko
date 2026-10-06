import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class SlapCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "slap", displayName: "Slap someone" });
  }
  protected readonly interactionType: InteractionType = "slap";
  protected readonly gifCategory: GifCategory = "slap";
  protected readonly verb: string = "slaps";
  protected readonly emoji: string = "💥";
}
