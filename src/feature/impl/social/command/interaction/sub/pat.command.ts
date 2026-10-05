import PairInteractionCommand from "../pair-interaction.command";

export default class PatCommand extends PairInteractionCommand {
  constructor() {
    super({ id: "pat", displayName: "Pat someone" });
  }
  protected readonly interactionType = "pat";
  protected readonly gifCategory = "pat";
  protected readonly verb = "pats";
  protected readonly emoji = "✋";
}
