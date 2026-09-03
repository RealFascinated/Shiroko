import PairInteractionCommand from "../pair-interaction.command";

export default class CarryCommand extends PairInteractionCommand {
  constructor() {
    super("carry", "Carry someone");
  }
  protected readonly interactionType = "carry";
  protected readonly gifCategory = "carry";
  protected readonly verb = "carries";
}
