import type { ExecuteContext } from "@/command/command";
import { userOption, type CommandOptionBuilder } from "@/command/option";
import History from "@/history/history";
import { USER_HISTORY_GROUPS, type HistoryGroup } from "@/history/kinds";
import HistoryCommand, { type HistorySource } from "./history-command";

export default class UserCommand extends HistoryCommand {
  protected readonly groups: readonly HistoryGroup[] = USER_HISTORY_GROUPS;

  constructor() {
    super({ id: "user", displayName: "Show a user's account and server history" });
  }

  protected override userOptions(): CommandOptionBuilder[] {
    return [userOption(false, "user", "Whose history to show")];
  }

  protected override source({ user, ctx, args }: ExecuteContext): HistorySource {
    const target = args.user("user") ?? user.discordUser;
    return {
      title: `History: ${target.displayName}`,
      fetchPage: (page, pageSize, kinds) => History.userPage(target.id, ctx.guild!.id, page, pageSize, kinds),
    };
  }
}
