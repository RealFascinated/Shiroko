import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class TickleCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "tickle", displayName: "Tickle someone" });
  }
  protected readonly interactionType: InteractionType = "tickle";
  protected readonly gifCategory: GifCategory = "tickle";
  protected readonly verb: string = "tickles";
  protected readonly emoji: string = "😆";
}
