import Command from "@/command/command";
import Feature from "@/feature/feature";
import GuildFeatures from "@/feature/guild-features";
import { env } from "@/lib/env";
import Panel, { type PanelControl, type PanelView } from "@/panel/panel";
import type { Guild } from "discord.js";

/** One command's listing: its clickable mention, description, and its sub-commands. */
interface HelpCommandInfo {
  mention: string;
  description: string;
  subcommands: readonly { mention: string; description: string }[];
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
        commands: feature.commands
          .filter(command => !command.private || guild.id === env.PRIVATE_COMMANDS_GUILD_ID)
          .map(toCommandInfo),
      });
    }
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

function toCommandInfo(command: Command): HelpCommandInfo {
  return {
    mention: command.mention(),
    description: command.displayName,
    subcommands: [...command.subCommands.values()].map(sub => ({
      mention: sub.mention(),
      description: sub.displayName,
    })),
  };
}

function categoryLines(category: HelpCategory): string[] {
  const lines = [`### ${category.emoji} ${category.label}`, countLine(category), "", "**Commands**"];
  for (const command of category.commands) {
    // A command with subcommands has no invocable root, so list only the
    // subcommands; their mentions already name the parent.
    if (command.subcommands.length > 0) {
      for (const sub of command.subcommands) {
        lines.push(`${sub.mention} - ${sub.description}`);
      }
      continue;
    }
    lines.push(`${command.mention} - ${command.description}`);
  }
  return lines;
}

function countLine(category: HelpCategory): string {
  const subcommands = category.commands.reduce((total, command) => total + command.subcommands.length, 0);
  const commands = category.commands.filter(command => command.subcommands.length === 0).length;
  const subWord = subcommands === 1 ? "sub-command" : "sub-commands";
  if (commands === 0) {
    return `${subcommands} ${subWord}`;
  }
  const commandWord = commands === 1 ? "command" : "commands";
  if (subcommands === 0) {
    return `${commands} ${commandWord}`;
  }
  return `${commands} ${commandWord} (with ${subcommands} ${subWord})`;
}
