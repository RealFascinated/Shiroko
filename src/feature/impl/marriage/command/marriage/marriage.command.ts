import Command from "@/command/command";
import DivorceCommand from "./sub/divorce.command";
import ProposeCommand from "./sub/propose.command";

export default class MarriageCommand extends Command {
  constructor() {
    super({ id: "marriage", displayName: "Marry another member of this server" });

    this.registerSubCommand(new ProposeCommand());
    this.registerSubCommand(new DivorceCommand());
  }
}
