import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class KissCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "kiss", displayName: "Kiss someone" });
  }
  protected readonly interactionType: InteractionType = "kiss";
  protected readonly gifCategory: GifCategory = "kiss";
  protected readonly verb: string = "kisses";
  protected readonly emoji: string = "😘";
}
