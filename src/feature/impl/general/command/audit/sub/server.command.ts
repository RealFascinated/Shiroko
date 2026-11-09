import type { ExecuteContext } from "@/command/command";
import Audit from "@/audit/audit";
import { GUILD_AUDIT_GROUPS, type AuditGroup } from "@/audit/kinds";
import AuditListCommand, { type AuditSource } from "./audit-list-command";

export default class ServerCommand extends AuditListCommand {
  protected readonly groups: readonly AuditGroup[] = GUILD_AUDIT_GROUPS;

  constructor() {
    super({ id: "server", displayName: "Show recent changes to the server" });
  }

  protected override source({ ctx }: ExecuteContext): AuditSource {
    return {
      title: "Server audit",
      fetchPage: (page, pageSize, kinds) => Audit.guildPage(ctx.guild!.id, page, pageSize, { kinds }),
    };
  }
}
