import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class DanceCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "dance", displayName: "Dance with someone" });
  }
  protected readonly interactionType: InteractionType = "dance";
  protected readonly gifCategory: GifCategory = "dance";
  protected readonly verb: string = "dances with";
  protected readonly emoji: string = "💃";
}
