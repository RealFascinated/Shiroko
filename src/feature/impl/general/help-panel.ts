import type Command from "@/command/command";
import Feature from "@/feature/feature";
import GuildFeatures from "@/feature/guild-features";
import { env } from "@/lib/env";
import Panel, { type PanelControl, type PanelView } from "@/panel/panel";
import type { Guild } from "discord.js";

/** One command's listing: its id, description, and its sub-commands. */
interface HelpCommandInfo {
  id: string;
  description: string;
  subcommands: readonly { id: string; description: string }[];
}

/** One category of commands: a feature, or the bot's own framework commands. */
interface HelpCategory {
  id: string;
  label: string;
  emoji: string;
  commands: readonly HelpCommandInfo[];
}

/** What the help panel renders over: the categories available in the guild. */
interface HelpConfig {
  categories: readonly HelpCategory[];
}

/**
 * The framework commands that belong to no feature and are therefore not
 * discoverable from the feature registry. They always show.
 */
const BOT_CATEGORY: HelpCategory = {
  id: "bot",
  label: "Bot",
  emoji: "🤖",
  commands: [
    { id: "feature", description: "Enable or disable server features", subcommands: [] },
    {
      id: "permissions",
      description: "Manage role permissions",
      subcommands: [
        { id: "view", description: "View role permissions" },
        { id: "set", description: "Set a role's permissions" },
        { id: "inherit", description: "Set or clear a role's parent for inheritance" },
        { id: "clear", description: "Remove a role's permission configuration" },
      ],
    },
    { id: "settings", description: "Configure server settings", subcommands: [] },
  ],
};

/**
 * The `/help` panel: one read-only view per available feature, listing its
 * commands and sub-commands. The engine's automatic view switcher is the
 * feature dropdown, so the panel declares no editable controls and writes
 * nothing.
 *
 * Categories are derived from the live feature/command registry and filtered
 * by the guild's feature toggles, so the listing stays in step with the bot
 * without a hand-maintained catalog.
 */
export default class HelpPanel extends Panel<HelpConfig> {
  public readonly segment = "help";
  public readonly title = "Help";
  public override readonly subtitle = "Browse every command by feature.";
  public override readonly viewPlaceholder = "Select a feature";

  public async getConfig(guild: Guild): Promise<HelpConfig> {
    const categories: HelpCategory[] = [];
    for (const feature of Feature.all()) {
      if (feature.commands.length === 0 || !(await GuildFeatures.isFeatureEnabled(guild, feature.id))) {
        continue;
      }
      categories.push({
        id: feature.id,
        label: feature.name,
        emoji: feature.emoji,
        commands: feature.commands.map(toCommandInfo),
      });
    }
    categories.push(BOT_CATEGORY);
    return { categories };
  }

  public override async updateConfig(): Promise<void> {
    // Every help view is read-only; there is nothing to persist.
  }

  public views(config: HelpConfig): readonly PanelView<HelpConfig>[] {
    return config.categories.map(category => ({
      id: category.id,
      label: `${category.emoji} ${category.label}`,
      segment: category.id,
      controls: (): readonly PanelControl<HelpConfig>[] => [],
      summary: () => categoryLines(category),
    }));
  }

  public override footer(): string {
    return [
      "Questions? shiroko@fascinated.cc",
      `[Privacy Policy](${env.PRIVACY_POLICY_URL})`,
      `[Terms of Service](${env.TERMS_OF_SERVICE_URL})`,
    ].join(" · ");
  }
}

/**
 * The one panel instance shared by the router and `/help`.
 */
export const helpPanel = new HelpPanel();

/** Read one registered command into its listing shape. */
function toCommandInfo(command: Command): HelpCommandInfo {
  return {
    id: command.id,
    description: command.displayName,
    subcommands: [...command.subCommands.values()].map(sub => ({
      id: sub.id,
      description: sub.displayName,
    })),
  };
}

/**
 * A category's body: its heading, the command/sub-command count, and one
 * line per command and sub-command.
 */
function categoryLines(category: HelpCategory): string[] {
  const lines = [`### ${category.emoji} ${category.label}`, countLine(category), "", "**Commands**"];
  for (const command of category.commands) {
    lines.push(`\`/${command.id}\` - ${command.description}`);
    for (const sub of command.subcommands) {
      lines.push(`\`/${command.id} ${sub.id}\` - ${sub.description}`);
    }
  }
  return lines;
}

/** The `N commands (with M sub-commands)` summary line. */
function countLine(category: HelpCategory): string {
  const subcommands = category.commands.reduce((total, command) => total + command.subcommands.length, 0);
  const commands = category.commands.length;
  const commandWord = commands === 1 ? "command" : "commands";
  if (subcommands === 0) {
    return `${commands} ${commandWord}`;
  }
  const subWord = subcommands === 1 ? "sub-command" : "sub-commands";
  return `${commands} ${commandWord} (with ${subcommands} ${subWord})`;
}
