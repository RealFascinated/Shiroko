import Command from "@/command/command";
import AvatarCommand from "./sub/avatar.command";
import BannerCommand from "./sub/banner.command";
import UserInfoCommand from "./sub/user-info.command";

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
