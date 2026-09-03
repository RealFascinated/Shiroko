import PairInteractionCommand from "../pair-interaction.command";

export default class BlowkissCommand extends PairInteractionCommand {
  constructor() {
    super("blowkiss", "Blow a kiss at someone");
  }
  protected readonly interactionType = "blowkiss";
  protected readonly gifCategory = "blowkiss";
  protected readonly verb = "blows a kiss at";
}
