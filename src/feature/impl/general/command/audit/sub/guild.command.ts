import type { ExecuteContext } from "@/command/command";
import History from "@/history/history";
import { GUILD_OBJECT_HISTORY_KINDS } from "@/history/kinds";
import HistoryCommand, { type HistorySource } from "./history-command";

export default class GuildCommand extends HistoryCommand {
  protected readonly kinds: readonly { id: string; label: string }[] = GUILD_OBJECT_HISTORY_KINDS;

  constructor() {
    super({ id: "guild", displayName: "Show recent changes to the server" });
  }

  protected override source({ ctx }: ExecuteContext): HistorySource {
    return {
      title: "Server history",
      fetchPage: (page, pageSize, kind) => History.guildPage(ctx.guild!.id, page, pageSize, kind),
    };
  }
}
