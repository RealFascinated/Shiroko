import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class PokeCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "poke", displayName: "Poke someone" });
  }
  protected readonly interactionType: InteractionType = "poke";
  protected readonly gifCategory: GifCategory = "poke";
  protected readonly verb: string = "pokes";
  protected readonly emoji: string = "👉";
}
