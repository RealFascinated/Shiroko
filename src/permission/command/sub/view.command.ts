import Command, { type ExecuteContext } from "@/command/command";
import { roleOption, type CommandOptionBuilder } from "@/command/option";
import { baseEmbed, ephemeralErrorReply, errorEmbed } from "@/lib/embed";
import { attachPager, loadPage, type Page } from "@/lib/pagination";
import Permissions, {
  FLAG_DISPLAY_NAMES,
  flagLabels,
  type PaginatedRoleConfig,
} from "@/permission/permissions";
import { type ChatInputCommandInteraction, type InteractionResponse } from "discord.js";

/** How many permissions to list per page. */
const PERMISSIONS_PER_PAGE = 10;

/**
 * Show configured permissions for a role or the whole guild, paginated.
 *
 * With `role`: lists every permission flag and whether the role effectively
 * holds it (✅ / ❌), plus own permissions and parent. Without `role`: lists
 * every configured role and its effective permissions, a page at a time
 * selected by the database.
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
    if (role) {
      return this.showRole(
        ctx,
        commandName,
        role.name === "@everyone" ? "@everyone" : role.name,
        role.id,
        guild
      );
    }
    const firstPage = await Permissions.pageConfigs(guild.id, 1, PERMISSIONS_PER_PAGE);
    if (firstPage.rows.length === 0) {
      return ctx.reply({
        embeds: [
          baseEmbed(commandName).setDescription("No permissions configured; defaults to no permissions."),
        ],
      });
    }
    return this.showGuild(ctx, commandName, guild, firstPage);
  }

  /**
   * View a single role: every flag and its effective state, paginated.
   *
   * The flag list is a compile-time constant, so there is no table to page;
   * it still goes through the shared page contract so every pager behaves
   * the same.
   */
  private async showRole(
    ctx: ChatInputCommandInteraction,
    commandName: string,
    title: string,
    roleId: string,
    guild: NonNullable<ExecuteContext["guild"]>
  ): Promise<InteractionResponse<boolean> | void> {
    const configs = await Permissions.allConfigs(guild.id);
    const config = configs.get(roleId);
    const effective = Permissions.resolveEffective(configs, roleId);
    const parentName = config?.parent ? this.roleName(guild, config.parent) : "None";
    const entries = FLAG_DISPLAY_NAMES.map(({ flag, label }) => ({
      label,
      state: (effective & flag) === flag,
    }));
    const fetchPage = (page: number) =>
      loadPage({
        page,
        pageSize: PERMISSIONS_PER_PAGE,
        count: async () => entries.length,
        rows: async (limit, offset) => entries.slice(offset, offset + limit),
      });
    const render = (page: Page<(typeof entries)[number]>) => {
      const lines = page.rows.map(({ label, state }) => `${state ? "✅" : "❌"} **${label}**`);
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
    const firstPage = await fetchPage(1);
    const response = await ctx.reply(render(firstPage));
    await attachPager(response, {
      namespace: "perm-view",
      userId: ctx.user.id,
      page: firstPage,
      fetchPage,
      render,
    });
    return response;
  }

  /**
   * View the whole guild: every configured role and its effective flags, one
   * database-selected page at a time.
   */
  private async showGuild(
    ctx: ChatInputCommandInteraction,
    commandName: string,
    guild: NonNullable<ExecuteContext["guild"]>,
    firstPage: Page<PaginatedRoleConfig>
  ): Promise<InteractionResponse<boolean> | void> {
    const render = (page: Page<PaginatedRoleConfig>) => {
      const lines = page.rows.map(({ roleId, parent, effective }) => {
        const flags = flagLabels(effective).join(", ") || "no permissions";
        const inherited = parent ? ` (inherits from ${this.roleName(guild, parent)})` : "";
        return `**${this.roleName(guild, roleId)}**: ${flags}${inherited}`;
      });
      return {
        embeds: [baseEmbed(commandName).setTitle("🔒 Role Permissions").setDescription(lines.join("\n"))],
      };
    };
    const response = await ctx.reply(render(firstPage));
    await attachPager(response, {
      namespace: "perm-view",
      userId: ctx.user.id,
      page: firstPage,
      fetchPage: page => Permissions.pageConfigs(guild.id, page, PERMISSIONS_PER_PAGE),
      render,
    });
    return response;
  }

  private roleName(guild: NonNullable<ExecuteContext["guild"]>, roleId: string): string {
    const role = guild.roles.cache.get(roleId);
    return role?.name === "@everyone" ? "@everyone" : (role?.name ?? `<@&${roleId}>`);
  }
}
