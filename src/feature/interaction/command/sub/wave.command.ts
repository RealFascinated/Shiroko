import PairInteractionCommand from "../pair-interaction.command";

export default class WaveCommand extends PairInteractionCommand {
  constructor() {
    super("wave", "Wave at someone");
  }
  protected readonly interactionType = "wave";
  protected readonly gifCategory = "wave";
  protected readonly verb = "waves at";
}
