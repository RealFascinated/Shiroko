import PairInteractionCommand from "../pair-interaction.command";

export default class CuddleCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "cuddle", displayName: "Cuddle someone" });
  }
  protected readonly interactionType = "cuddle";
  protected readonly gifCategory = "cuddle";
  protected readonly verb = "cuddles";
  protected readonly emoji = "🫂";
}
