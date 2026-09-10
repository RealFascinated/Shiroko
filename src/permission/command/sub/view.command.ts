import { InteractionResponse, type ChatInputCommandInteraction } from "discord.js";
import Command, { type ExecuteContext } from "../../../command/command";
import { roleOption, type CommandOptionBuilder } from "../../../command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "../../../lib/embed";
import { attachPager } from "../../../lib/pagination";
import Permissions, { FLAG_DISPLAY_NAMES, flagLabels } from "../../permissions";

/** How many permissions to list per page. */
const PERMISSIONS_PER_PAGE = 10;

/**
 * Show configured permissions for a role or the whole guild, paginated.
 *
 * With `role`: lists every permission flag and whether the role effectively
 * holds it (✅ / ❌), plus own permissions and parent. Without `role`: lists
 * every configured role and its effective permissions, grouped into pages.
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
      return this.showRole(
        ctx,
        commandName,
        role.name === "@everyone" ? "@everyone" : role.name,
        role.id,
        configs,
        guild
      );
    }
    if (configs.size === 0) {
      return ctx.reply({
        embeds: [
          baseEmbed(commandName).setDescription("No permissions configured; defaults to no permissions."),
        ],
      });
    }
    return this.showGuild(ctx, commandName, configs, guild);
  }

  /**
   * View a single role: every flag and its effective state, paginated.
   */
  private async showRole(
    ctx: ChatInputCommandInteraction,
    commandName: string,
    title: string,
    roleId: string,
    configs: Map<string, { own: bigint; parent: string | null }>,
    guild: NonNullable<ExecuteContext["guild"]>
  ): Promise<InteractionResponse<boolean> | void> {
    const config = configs.get(roleId);
    const effective = Permissions.resolveEffective(configs, roleId);
    const parentName = config?.parent ? this.roleName(guild, config.parent) : "None";
    const entries = FLAG_DISPLAY_NAMES.map(({ flag, label }) => ({
      label,
      state: (effective & flag) === flag,
    }));
    const pageCount = Math.ceil(entries.length / PERMISSIONS_PER_PAGE);
    const render = (page: number) => {
      const slice = entries.slice((page - 1) * PERMISSIONS_PER_PAGE, page * PERMISSIONS_PER_PAGE);
      const lines = slice.map(({ label, state }) => `${state ? "✅" : "❌"} **${label}**`);
      return {
        embeds: [
          baseEmbed(commandName)
            .setTitle(`🔒 ${title}`)
            .setDescription(
              `**Effective permissions:** ${flagLabels(effective).join(", ") || "None"}\n**Own permissions:** ${
                flagLabels(config?.own ?? 0n).join(", ") || "None"
              }\n**Parent:** ${parentName}`
            )
            .addFields({
              name: "Permissions",
              value: lines.join("\n") || "None",
            }),
        ],
      };
    };
    const firstPage = render(1);
    const response = await ctx.reply({ embeds: firstPage.embeds });
    if (response instanceof InteractionResponse && pageCount > 1) {
      await attachPager(response, { namespace: "perm-view", userId: ctx.user.id, pageCount, render });
    }
    return response;
  }

  /**
   * View the whole guild: every configured role and its effective
   * flags, paginated by role.
   */
  private async showGuild(
    ctx: ChatInputCommandInteraction,
    commandName: string,
    configs: Map<string, { own: bigint; parent: string | null }>,
    guild: NonNullable<ExecuteContext["guild"]>
  ): Promise<InteractionResponse<boolean> | void> {
    const roles = Array.from(configs.entries());
    const pageCount = Math.ceil(roles.length / PERMISSIONS_PER_PAGE);
    const render = (page: number) => {
      const slice = roles.slice((page - 1) * PERMISSIONS_PER_PAGE, page * PERMISSIONS_PER_PAGE);
      const lines = slice.map(([roleId, config]) => {
        const effective = Permissions.resolveEffective(configs, roleId);
        const role = guild.roles.cache.get(roleId);
        const roleName = role?.name === "@everyone" ? "@everyone" : (role?.name ?? `<@&${roleId}>`);
        const flags = flagLabels(effective).join(", ") || "no permissions";
        return `**${roleName}**: ${flags}${config.parent ? ` (inherits from ${this.roleName(guild, config.parent)})` : ""}`;
      });
      return {
        embeds: [baseEmbed(commandName).setTitle("🔒 Role Permissions").setDescription(lines.join("\n"))],
      };
    };
    const firstPage = render(1);
    const response = await ctx.reply({ embeds: firstPage.embeds });
    if (response instanceof InteractionResponse && pageCount > 1) {
      await attachPager(response, { namespace: "perm-view", userId: ctx.user.id, pageCount, render });
    }
    return response;
  }

  private roleName(guild: NonNullable<ExecuteContext["guild"]>, roleId: string): string {
    const role = guild.roles.cache.get(roleId);
    return role?.name === "@everyone" ? "@everyone" : (role?.name ?? `<@&${roleId}>`);
  }
}
