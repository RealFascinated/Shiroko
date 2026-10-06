import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class PatCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "pat", displayName: "Pat someone" });
  }
  protected readonly interactionType: InteractionType = "pat";
  protected readonly gifCategory: GifCategory = "pat";
  protected readonly verb: string = "pats";
  protected readonly emoji: string = "✋";
}
