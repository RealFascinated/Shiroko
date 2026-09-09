import Command, { type ExecuteContext } from "../../../command/command";
import { roleOption, type CommandOptionBuilder } from "../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../lib/embed";
import Permissions, { flagLabels } from "../../permissions";

/**
 * Show configured permissions for a role or the whole guild.
 */
export default class PermissionsViewCommand extends Command {
  constructor() {
    super("view", "View role permissions");
  }

  public override get options(): CommandOptionBuilder[] {
    return [roleOption(false, "role", "Role to inspect (defaults to all configured roles)")];
  }

  protected override async onExecuteSlash({ guild, ctx, args, commandName }: ExecuteContext) {
    if (!guild) {
      return ctx.reply(
        ephemeralErrorReply(
          commandName,
          errorEmbed(commandName).setDescription("Permissions are only available in servers.")
        )
      );
    }
    const role = args.role("role");
    const configs = await Permissions.allConfigs(guild.id);
    if (role) {
      const config = configs.get(role.id);
      const effective = Permissions.resolveEffective(configs, role.id);
      const title = role.name === "@everyone" ? "@everyone" : role.name;
      if (!config) {
        return ctx.reply({
          embeds: [
            baseEmbed(commandName)
              .setTitle(`🔒 ${title}`)
              .setDescription("No permissions configured — defaults to no flags."),
          ],
        });
      }
      const parentName = config.parent ? this.roleName(guild, config.parent) : "—";
      const lines = [
        `**Role:** ${role}`,
        `**Own flags:** ${flagLabels(config.own).join(", ") || "None"}`,
        `**Parent:** ${parentName}`,
        `**Effective flags:** ${flagLabels(effective).join(", ") || "None"}`,
      ];
      return ctx.reply({
        embeds: [baseEmbed(commandName).setTitle(`🔒 ${title}`).setDescription(lines.join("\n"))],
      });
    }
    if (configs.size === 0) {
      return ctx.reply({
        embeds: [baseEmbed(commandName).setDescription("No permissions configured — defaults to no flags.")],
      });
    }
    const lines = Array.from(configs.entries()).map(([roleId, config]) => {
      const effective = Permissions.resolveEffective(configs, roleId);
      const role = guild.roles.cache.get(roleId);
      const parentName = config.parent ? this.roleName(guild, config.parent) : "—";
      const roleName = role?.name === "@everyone" ? "@everyone" : (role?.name ?? `<@&${roleId}>`);
      return `**${roleName}** — ${flagLabels(effective).join(", ") || "no flags"}${
        config.parent ? ` (parent: ${parentName})` : ""
      }`;
    });
    return ctx.reply({
      embeds: [baseEmbed(commandName).setTitle("🔒 Role Permissions").setDescription(lines.join("\n"))],
    });
  }

  private roleName(guild: NonNullable<ExecuteContext["guild"]>, roleId: string): string {
    const role = guild.roles.cache.get(roleId);
    return role?.name === "@everyone" ? "@everyone" : (role?.name ?? `<@&${roleId}>`);
  }
}
