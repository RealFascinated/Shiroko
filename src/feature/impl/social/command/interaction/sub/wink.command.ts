import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class WinkCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "wink", displayName: "Wink at someone" });
  }
  protected readonly interactionType: InteractionType = "wink";
  protected readonly gifCategory: GifCategory = "wink";
  protected readonly verb: string = "winks at";
  protected readonly emoji: string = "😉";
}
