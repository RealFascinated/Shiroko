import PairInteractionCommand from "../pair-interaction.command";

export default class BlushCommand extends PairInteractionCommand {
  constructor() {
    super("blush", "Blush in front of someone");
  }
  protected readonly interactionType = "blush";
  protected readonly gifCategory = "blush";
  protected readonly verb = "blushes in front of";
}
