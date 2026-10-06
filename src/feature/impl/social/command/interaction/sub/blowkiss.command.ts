import PairInteractionCommand from "../pair-interaction.command";
import type { GifCategory } from "@/lib/anime/index";
import type { InteractionType } from "@/feature/impl/social/social.service";

export default class BlowkissCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "blowkiss", displayName: "Blow a kiss at someone" });
  }
  protected readonly interactionType: InteractionType = "blowkiss";
  protected readonly gifCategory: GifCategory = "blowkiss";
  protected readonly verb: string = "blows a kiss at";
  protected readonly emoji: string = "💋";
}
