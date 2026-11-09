import type { GifCategory } from "@/lib/anime/index";

/**
 * Every pair interaction: one row per subcommand. The id is both the command
 * id and the stored interaction type, so this table is the set of things
 * `/interact` can do.
 */
export interface PairInteractionDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly gifCategory: GifCategory;
  readonly verb: string;
  /** The base form used in "You can't ... yourself", where `verb` would be wrong. */
  readonly selfVerb: string;
  readonly emoji: string;
}

export const PAIR_INTERACTIONS = [
  {
    id: "hug",
    displayName: "Give someone a big hug",
    gifCategory: "hug",
    verb: "hugs",
    selfVerb: "hug",
    emoji: "🤗",
  },
  {
    id: "kiss",
    displayName: "Kiss someone",
    gifCategory: "kiss",
    verb: "kisses",
    selfVerb: "kiss",
    emoji: "😘",
  },
  {
    id: "slap",
    displayName: "Slap someone",
    gifCategory: "slap",
    verb: "slaps",
    selfVerb: "slap",
    emoji: "💥",
  },
  {
    id: "pat",
    displayName: "Pat someone",
    gifCategory: "pat",
    verb: "pats",
    selfVerb: "pat",
    emoji: "✋",
  },
  {
    id: "cuddle",
    displayName: "Cuddle someone",
    gifCategory: "cuddle",
    verb: "cuddles",
    selfVerb: "cuddle",
    emoji: "🫂",
  },
  {
    id: "dance",
    displayName: "Dance with someone",
    gifCategory: "dance",
    verb: "dances with",
    selfVerb: "dance with",
    emoji: "💃",
  },
  {
    id: "feed",
    displayName: "Feed someone",
    gifCategory: "feed",
    verb: "feeds",
    selfVerb: "feed",
    emoji: "🍜",
  },
  {
    id: "headpat",
    displayName: "Give someone a headpat",
    gifCategory: "pat",
    verb: "headpats",
    selfVerb: "headpat",
    emoji: "🐾",
  },
  {
    id: "holdhands",
    displayName: "Hold someone's hand",
    gifCategory: "handhold",
    verb: "holds hands with",
    selfVerb: "hold hands with",
    emoji: "👫",
  },
  {
    id: "poke",
    displayName: "Poke someone",
    gifCategory: "poke",
    verb: "pokes",
    selfVerb: "poke",
    emoji: "👉",
  },
  {
    id: "wink",
    displayName: "Wink at someone",
    gifCategory: "wink",
    verb: "winks at",
    selfVerb: "wink at",
    emoji: "😉",
  },
  {
    id: "tease",
    displayName: "Tease someone",
    gifCategory: "kabedon",
    verb: "teases",
    selfVerb: "tease",
    emoji: "😏",
  },
  {
    id: "tickle",
    displayName: "Tickle someone",
    gifCategory: "tickle",
    verb: "tickles",
    selfVerb: "tickle",
    emoji: "😆",
  },
  {
    id: "bonk",
    displayName: "Bonk someone on the head",
    gifCategory: "bonk",
    verb: "bonks",
    selfVerb: "bonk",
    emoji: "🥴",
  },
  {
    id: "blowkiss",
    displayName: "Blow a kiss at someone",
    gifCategory: "blowkiss",
    verb: "blows a kiss at",
    selfVerb: "blow a kiss at",
    emoji: "💋",
  },
  {
    id: "bite",
    displayName: "Bite someone",
    gifCategory: "bite",
    verb: "bites",
    selfVerb: "bite",
    emoji: "🦷",
  },
] as const satisfies readonly PairInteractionDefinition[];

export type InteractionType = (typeof PAIR_INTERACTIONS)[number]["id"];
