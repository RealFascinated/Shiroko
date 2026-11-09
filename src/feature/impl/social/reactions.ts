import type { GifCategory } from "@/lib/anime/index";

/**
 * Every self-reaction: one row per subcommand of `/react`. The id is the
 * command id and the GIF category is normally the same, so the phrase is the
 * only text that has to be stated per mood.
 */
export interface SelfReactionDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly gifCategory: GifCategory;
  readonly phrase: string;
}

export const SELF_REACTIONS = [
  { id: "angry", displayName: "Show off your anger", gifCategory: "angry", phrase: "is angry" },
  {
    id: "bleh",
    displayName: "Express your displeasure with a bleh anime gif",
    gifCategory: "bleh",
    phrase: "feels bleh",
  },
  { id: "blush", displayName: "Get all flustered", gifCategory: "blush", phrase: "blushes" },
  { id: "bored", displayName: "Express your boredom", gifCategory: "bored", phrase: "is bored" },
  {
    id: "confused",
    displayName: "Express your confusion",
    gifCategory: "confused",
    phrase: "is confused",
  },
  { id: "cry", displayName: "Have a little cry", gifCategory: "cry", phrase: "cries" },
  { id: "happy", displayName: "Show off your happiness", gifCategory: "happy", phrase: "is happy" },
  { id: "laugh", displayName: "Let out a good laugh", gifCategory: "laugh", phrase: "laughs" },
  { id: "pout", displayName: "Express a pouty mood", gifCategory: "pout", phrase: "pouts" },
  { id: "shocked", displayName: "Express your shock", gifCategory: "shocked", phrase: "is shocked" },
  { id: "sleep", displayName: "Doze off right there", gifCategory: "sleep", phrase: "falls asleep" },
  { id: "smug", displayName: "Strut around all smug", gifCategory: "smug", phrase: "feels smug" },
] as const satisfies readonly SelfReactionDefinition[];
