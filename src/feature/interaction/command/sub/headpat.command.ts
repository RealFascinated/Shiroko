import PairInteractionCommand from "../pair-interaction.command";

export default class HeadpatCommand extends PairInteractionCommand {
  constructor() {
    super("headpat", "Give someone a headpat");
  }
  protected readonly interactionType = "headpat";
  protected readonly gifCategory = "pat";
  protected readonly verb = "headpats";
}
