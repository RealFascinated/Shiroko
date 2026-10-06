import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class HoldhandsCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "holdhands", displayName: "Hold someone's hand" });
  }
  protected readonly interactionType: InteractionType = "holdhands";
  protected readonly gifCategory: GifCategory = "handhold";
  protected readonly verb: string = "holds hands with";
  protected readonly emoji: string = "👫";
}
