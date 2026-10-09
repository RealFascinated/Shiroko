import guildPlaceholders from "@/placeholder/impl/guild-placeholders";
import globalUserPlaceholders from "@/placeholder/impl/global-user-placeholders";
import {
  definePlaceholder,
  type GlobalUserPlaceholderContext,
  type GuildPlaceholderContext,
  type Placeholder,
} from "@/placeholder/placeholder";
import PlaceholderExecutor from "@/placeholder/placeholder-executor";

/** Everything the level-up message's tokens read: the member, the guild, and the level-up itself. */
export type LevelUpPlaceholderContext = GlobalUserPlaceholderContext &
  GuildPlaceholderContext & {
    readonly level: number;
    readonly xp: number;
  };

const levelPlaceholders: ReadonlyArray<Placeholder<LevelUpPlaceholderContext>> = [
  definePlaceholder({
    key: "level",
    description: "The level the member just reached.",
    resolve: context => context.level,
  }),
  definePlaceholder({
    key: "current_xp",
    description: "The member's total XP after the level-up.",
    resolve: context => context.xp,
  }),
];

/**
 * Renders a guild's level-up message: every guild-context token, plus the
 * level and XP total that only a level-up knows. Level tokens live here
 * rather than in `@/placeholder` because only this context carries them.
 */
export const levelUpPlaceholders = new PlaceholderExecutor<LevelUpPlaceholderContext>([
  ...globalUserPlaceholders,
  ...guildPlaceholders,
  ...levelPlaceholders,
]);
