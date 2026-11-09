import Command from "@/command/command";
import { PAIR_INTERACTIONS } from "@/feature/impl/social/interactions";
import { PairInteractionSubCommand } from "./pair-interaction.command";

export default class InteractionCommand extends Command {
  constructor() {
    super({ id: "interact", displayName: "Interact with others" });

    for (const definition of PAIR_INTERACTIONS) {
      this.registerSubCommand(new PairInteractionSubCommand(definition));
    }
  }

  public override get userInstallable(): boolean {
    return true;
  }
}
