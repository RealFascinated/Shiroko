import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import PanelManager from "@/panel/index";
import BotStatsCommand from "./command/botstats.command";
import FeatureCommand from "./command/feature/feature.command";
import GuildInfoCommand from "./command/guildinfo.command";
import { helpPanel } from "./command/help/help-panel";
import HelpCommand from "./command/help/help.command";
import LeaderboardCommand from "./command/leaderboard/leaderboard.command";
import PermissionsCommand from "./command/permissions/permissions.command";
import PingCommand from "./command/ping.command";
import SettingsCommand from "./command/settings/settings.command";
import UserCommand from "./command/user/user.command";

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
    this.registerCommand(new FeatureCommand());
    this.registerCommand(new PermissionsCommand());
    this.registerCommand(new SettingsCommand());
  }
}
