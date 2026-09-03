import PairInteractionCommand from "../pair-interaction.command";

export default class PeckCommand extends PairInteractionCommand {
  constructor() {
    super("peck", "Peck someone on the cheek");
  }
  protected readonly interactionType = "peck";
  protected readonly gifCategory = "peck";
  protected readonly verb = "pecks";
}
