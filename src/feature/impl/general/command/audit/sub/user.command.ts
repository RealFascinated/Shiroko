import type { ExecuteContext } from "@/command/command";
import { userOption, type CommandOptionBuilder } from "@/command/option";
import Audit from "@/audit/audit";
import { USER_AUDIT_GROUPS, type AuditGroup } from "@/audit/kinds";
import AuditListCommand, { type AuditSource } from "./audit-list-command";

export default class UserCommand extends AuditListCommand {
  protected readonly groups: readonly AuditGroup[] = USER_AUDIT_GROUPS;

  constructor() {
    super({ id: "user", displayName: "Show a user's account and server audit" });
  }

  protected override userOptions(): CommandOptionBuilder[] {
    return [userOption(false, "user", "Whose audit to show")];
  }

  protected override source({ user, ctx, args }: ExecuteContext): AuditSource {
    const target = args.user("user") ?? user.discordUser;
    return {
      title: `Audit: ${target.displayName}`,
      fetchPage: (page, pageSize, kinds) => Audit.userPage(target.id, ctx.guild!.id, page, pageSize, kinds),
    };
  }
}
