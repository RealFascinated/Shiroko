import Command from "../../../../../command/command";
import UserCommand from "./sub/user.command";

/**
 * Show invite stats: who you (or another user) invited. Guild-only, since
 * invite tracking is per-guild.
 */
export default class InvitesCommand extends Command {
  constructor() {
    super("invites", "Show invite stats");
    this.registerSubCommand(new UserCommand());
  }
}
