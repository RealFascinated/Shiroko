import type { ExecuteContext } from "@/command/command";
import History from "@/history/history";
import { GUILD_HISTORY_GROUPS, type HistoryGroup } from "@/history/kinds";
import HistoryListCommand, { type HistorySource } from "./history-list-command";

export default class ServerCommand extends HistoryListCommand {
  protected readonly groups: readonly HistoryGroup[] = GUILD_HISTORY_GROUPS;

  constructor() {
    super({ id: "server", displayName: "Show recent changes to the server" });
  }

  protected override source({ ctx }: ExecuteContext): HistorySource {
    return {
      title: "Server history",
      fetchPage: (page, pageSize, kinds) => History.guildPage(ctx.guild!.id, page, pageSize, { kinds }),
    };
  }
}
