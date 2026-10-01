import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import PanelManager from "@/panel/index";
import BotStatsCommand from "./command/botstats.command";
import GuildInfoCommand from "./command/guildinfo.command";
import HelpCommand from "./command/help.command";
import LeaderboardCommand from "./command/leaderboard/leaderboard.command";
import PingCommand from "./command/ping.command";
import UserCommand from "./command/user/user.command";
import { helpPanel } from "./help-panel";

/**
 * The general feature: the core commands (ping, help, user info,
 * leaderboards, bot and guild info). Always on and not toggleable.
 */
export default class GeneralFeature extends Feature {
  constructor() {
    super(FeatureIds.General, { toggleable: false, name: "General", emoji: "🧰" });

    PanelManager.register(helpPanel);
    this.registerCommand(new PingCommand());
    this.registerCommand(new UserCommand());
    this.registerCommand(new GuildInfoCommand());
    this.registerCommand(new BotStatsCommand());
    this.registerCommand(new HelpCommand());
    this.registerCommand(new LeaderboardCommand());
  }
}
