import type { ExecuteContext } from "@/command/command";
import { stringOption, userOption, type CommandOptionBuilder } from "@/command/option";
import Audit from "@/audit/audit";
import { CONFIG_AUDIT_GROUPS, type AuditGroup } from "@/audit/kinds";
import AuditListCommand, { type AuditSource } from "./audit-list-command";

export default class ConfigCommand extends AuditListCommand {
  protected readonly groups: readonly AuditGroup[] = CONFIG_AUDIT_GROUPS;

  constructor() {
    super({ id: "config", displayName: "View recent configuration changes" });
  }

  protected override userOptions(): CommandOptionBuilder[] {
    return [
      stringOption(false, "key", "A setting key or module, like levels or levels.messageXpMin"),
      userOption(false, "user", "Only changes made by this user"),
    ];
  }

  protected override source({ ctx, args }: ExecuteContext): AuditSource {
    const subject = args.string("key") ?? undefined;
    const actorId = args.user("user")?.id;
    return {
      title: "Config audit",
      fetchPage: (page, pageSize, kinds) =>
        Audit.guildPage(ctx.guild!.id, page, pageSize, {
          kinds: kinds ?? this.groups.flatMap(group => group.kindIds),
          subject,
          actorId,
        }),
    };
  }
}
