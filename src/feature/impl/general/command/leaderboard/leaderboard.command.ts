import Command from "@/command/command";
import { LEADERBOARDS } from "./definitions";
import LeaderboardSubCommand from "./leaderboard-subcommand";

export default class LeaderboardCommand extends Command {
  constructor() {
    super({ id: "leaderboard", displayName: "Show the server's leaderboards" });

    for (const definition of LEADERBOARDS) {
      this.registerSubCommand(new LeaderboardSubCommand(definition));
    }
  }
}
