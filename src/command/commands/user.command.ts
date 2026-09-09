import Command from "../command";
import AvatarCommand from "./avatar.command";
import BannerCommand from "./banner.command";
import UserInfoCommand from "./user/sub/user-info.command";

/**
 * Show a user's info, avatar, or banner via subcommands.
 */
export default class UserCommand extends Command {
  constructor() {
    super("user", "Show a user's info: avatar, banner and more");
    this.registerSubCommand(new UserInfoCommand());
    this.registerSubCommand(new AvatarCommand());
    this.registerSubCommand(new BannerCommand());
  }

  public override get userInstallable(): boolean {
    return true;
  }
}
