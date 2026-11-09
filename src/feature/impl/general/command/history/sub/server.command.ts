import type { ExecuteContext } from "@/command/command";
import History from "@/history/history";
import { GUILD_HISTORY_GROUPS, type HistoryGroup } from "@/history/kinds";
import HistoryCommand, { type HistorySource } from "./history-command";

export default class GuildCommand extends HistoryCommand {
  protected readonly groups: readonly HistoryGroup[] = GUILD_HISTORY_GROUPS;

  constructor() {
    super({ id: "guild", displayName: "Show recent changes to the server" });
  }

  protected override source({ ctx }: ExecuteContext): HistorySource {
    return {
      title: "Server history",
      fetchPage: (page, pageSize, kinds) => History.guildPage(ctx.guild!.id, page, pageSize, kinds),
    };
  }
}
