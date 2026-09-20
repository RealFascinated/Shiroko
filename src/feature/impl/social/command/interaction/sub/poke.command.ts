import PairInteractionCommand from "../pair-interaction.command";

export default class PokeCommand extends PairInteractionCommand {
  constructor() {
    super("poke", "Poke someone");
  }
  protected readonly interactionType = "poke";
  protected readonly gifCategory = "poke";
  protected readonly verb = "pokes";
  protected readonly emoji = "👉";
}
