import Command from "@/command/command";
import { SELF_REACTIONS } from "@/feature/impl/social/reactions";
import { SelfReactionSubCommand } from "./self-reaction.command";

export default class ReactCommand extends Command {
  constructor() {
    super({ id: "react", displayName: "React with a mood" });

    for (const definition of SELF_REACTIONS) {
      this.registerSubCommand(new SelfReactionSubCommand(definition));
    }
  }

  public override get userInstallable(): boolean {
    return true;
  }
}
