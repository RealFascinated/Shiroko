import type { ExecuteContext } from "@/command/command";
import { stringOption, userOption, type CommandOptionBuilder } from "@/command/option";
import History from "@/history/history";
import { CONFIG_HISTORY_GROUPS, type HistoryGroup } from "@/history/kinds";
import HistoryListCommand, { type HistorySource } from "./history-list-command";

export default class ConfigCommand extends HistoryListCommand {
  protected readonly groups: readonly HistoryGroup[] = CONFIG_HISTORY_GROUPS;

  constructor() {
    super({ id: "config", displayName: "View recent configuration changes" });
  }

  protected override userOptions(): CommandOptionBuilder[] {
    return [
      stringOption(false, "key", "A setting key or module, like levels or levels.messageXp"),
      userOption(false, "user", "Only changes made by this user"),
    ];
  }

  protected override source({ ctx, args }: ExecuteContext): HistorySource {
    const subject = args.string("key") ?? undefined;
    const actorId = args.user("user")?.id;
    return {
      title: "Config history",
      fetchPage: (page, pageSize, kinds) =>
        History.guildPage(ctx.guild!.id, page, pageSize, {
          kinds: kinds ?? this.groups.flatMap(group => group.kindIds),
          subject,
          actorId,
        }),
    };
  }
}
