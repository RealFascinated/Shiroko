import PairInteractionCommand from "../pair-interaction.command";

export default class TickleCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "tickle", displayName: "Tickle someone" });
  }
  protected readonly interactionType = "tickle";
  protected readonly gifCategory = "tickle";
  protected readonly verb = "tickles";
  protected readonly emoji = "😆";
}
