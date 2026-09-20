import PairInteractionCommand from "../pair-interaction.command";

export default class TickleCommand extends PairInteractionCommand {
  constructor() {
    super("tickle", "Tickle someone");
  }
  protected readonly interactionType = "tickle";
  protected readonly gifCategory = "tickle";
  protected readonly verb = "tickles";
  protected readonly emoji = "😆";
}
