/** Period a quest belongs to. Quests reset daily or weekly. */
export type QuestPeriod = "daily" | "weekly";

/**
 * A challenge a user can be assigned. `kind` is the metric it tracks;
 * `target` the amount needed; `reward` the runes for completing it; `emoji`
 * a label glyph and `text` the human-readable goal. `slug` is a stable,
 * unique id derived from `kind` + `target`.
 */
export interface QuestDefinition {
  kind: QuestKind;
  target: number;
  reward: number;
  emoji: string;
  text: string;
  slug: string;
}

/** Metric a quest tracks. */
export type QuestKind =
  | "earn"
  | "spend"
  | "deposit"
  | "withdraw"
  | "gamble"
  | "work"
  | "claimDaily"
  | "interact"
  | "giveGift"
  | "paySomeone";

const TITLES: Record<QuestKind, string> = {
  earn: "Earn runes",
  spend: "Spend runes",
  deposit: "Bank deposits",
  withdraw: "Bank withdrawals",
  gamble: "Gamble runes",
  work: "Work shifts",
  claimDaily: "Daily claims",
  interact: "Interactions",
  giveGift: "Give gifts",
  paySomeone: "Pay someone",
};

/** A family of quests over one metric: a human title, flavor lines for the
 * daily and weekly variants, and the `(daily, weekly)` targets + rewards to
 * pick from. Used so a player's lists draw from every family, not just a
 * handful of metrics.
 */
export interface QuestFamily {
  kind: QuestKind;
  title: string;
  lines: Record<QuestPeriod, string[]>;
  variants: number[];
  rewards: Record<QuestPeriod, number[]>;
}

/** `key` of the quest definition, used to look up the family a quest came from. */
export const questKey = (kind: QuestKind, target: number): string => `${kind}:${target}`;

/** Random element from `items`; the array must not be empty. */
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** True with probability `chance`. */
function chance(chance: number): boolean {
  return Math.random() < chance;
}

/**
 * The complete quest catalog. Each family contributes one daily and one
 * weekly entry per drawn list. Exploit risk is low because rewards are
 * small and most have cooldowns already; the `FAMILIES` embedding means
 * quests always reference a known definition.
 */
const FAMILIES: QuestFamily[] = [
  {
    kind: "earn",
    title: "Earn runes",
    lines: {
      daily: [
        "Earn {amount} runes from any source.",
        "Collect {amount} runes across the day.",
        "Scrounge up {amount} runes by working and collecting.",
      ],
      weekly: [
        "Earn {amount} runes over the week.",
        "Put together {amount} runes by the end of the week.",
        "Accumulate {amount} runes across the week.",
      ],
    },
    variants: [500, 1_000, 1_500],
    rewards: { daily: [60, 120, 180], weekly: [240, 480, 720] },
  },
  {
    kind: "spend",
    title: "Spend runes",
    lines: {
      daily: [
        "Spend {amount} runes on wagers, banks, or games.",
        "Splash out {amount} runes today.",
        "Let {amount} runes slip through your fingers.",
      ],
      weekly: [
        "Spend {amount} runes over the week.",
        "Empty {amount} runes into the economy this week.",
        "Splash {amount} runes across the week.",
      ],
    },
    variants: [250, 500, 1_000],
    rewards: { daily: [50, 100, 200], weekly: [200, 400, 800] },
  },
  {
    kind: "deposit",
    title: "Bank deposits",
    lines: {
      daily: [
        "Deposit {amount} runes into your bank.",
        "Park {amount} runes in the bank today.",
        "Stash {amount} runes in your bank.",
      ],
      weekly: [
        "Deposit {amount} runes into your bank over the week.",
        "Park {amount} runes in the bank this week.",
        "Stash {amount} runes in your bank across the week.",
      ],
    },
    variants: [500, 1_000, 2_000],
    rewards: { daily: [60, 120, 240], weekly: [240, 480, 960] },
  },
  {
    kind: "withdraw",
    title: "Bank withdrawals",
    lines: {
      daily: [
        "Withdraw {amount} runes from your bank.",
        "Take {amount} runes out of the bank today.",
        "Pull {amount} runes from your bank.",
      ],
      weekly: [
        "Withdraw {amount} runes from your bank over the week.",
        "Take {amount} runes out of the bank this week.",
        "Pull {amount} runes from your bank across the week.",
      ],
    },
    variants: [500, 1_000, 2_000],
    rewards: { daily: [60, 120, 240], weekly: [240, 480, 960] },
  },
  {
    kind: "gamble",
    title: "Gamble runes",
    lines: {
      daily: [
        "Wager {amount} runes on any game.",
        "Bet {amount} runes across the arcade today.",
        "Risk {amount} runes at the games.",
      ],
      weekly: [
        "Wager {amount} runes over the week.",
        "Bet {amount} runes at the arcade this week.",
        "Risk {amount} runes across the week.",
      ],
    },
    variants: [250, 500, 1_000],
    rewards: { daily: [50, 100, 200], weekly: [200, 400, 800] },
  },
  {
    kind: "work",
    title: "Work shifts",
    lines: {
      daily: [
        "Clock in for {amount} shift(s) at the Summit.",
        "Work {amount} shift(s) today.",
        "Do {amount} shift(s) at work.",
      ],
      weekly: [
        "Work {amount} shift(s) over the week.",
        "Clock in {amount} time(s) this week.",
        "Pull {amount} shift(s) at the Summit across the week.",
      ],
    },
    variants: [1, 2, 3],
    rewards: { daily: [50, 100, 150], weekly: [200, 400, 600] },
  },
  {
    kind: "claimDaily",
    title: "Daily claims",
    lines: {
      daily: ["Claim your daily runes.", "Collect today's daily runes."],
      weekly: [
        "Claim daily runes {amount} day(s) this week.",
        "Collect your daily runes on {amount} different day(s).",
      ],
    },
    variants: [1, 1, 1],
    rewards: { daily: [40, 40, 40], weekly: [150, 150, 150] },
  },
  {
    kind: "interact",
    title: "Interactions",
    lines: {
      daily: [
        "Hug, pat, or poke someone {amount} time(s).",
        "Interact with others {amount} time(s) today.",
        "Send {amount} interaction(s) to other students.",
      ],
      weekly: [
        "Interact with others {amount} time(s) this week.",
        "Hug, pat, or poke people {amount} time(s) over the week.",
      ],
    },
    variants: [3, 5, 10],
    rewards: { daily: [40, 80, 160], weekly: [160, 320, 640] },
  },
  {
    kind: "giveGift",
    title: "Give gifts",
    lines: {
      daily: [
        "Send someone {amount} gift(s).",
        "Give away {amount} gift(s) today.",
        "Share {amount} gift(s) with a friend.",
      ],
      weekly: ["Give {amount} gift(s) over the week.", "Send {amount} gift(s) to others this week."],
    },
    variants: [1, 2, 3],
    rewards: { daily: [40, 80, 120], weekly: [160, 320, 480] },
  },
  {
    kind: "paySomeone",
    title: "Pay someone",
    lines: {
      daily: [
        "Pay someone {amount} runes.",
        "Send {amount} runes to another student.",
        "Transfer {amount} runes to a friend.",
      ],
      weekly: [
        "Pay someone {amount} runes over the week.",
        "Send {amount} runes to other students this week.",
      ],
    },
    variants: [100, 250, 500],
    rewards: { daily: [30, 50, 80], weekly: [120, 200, 320] },
  },
];

/** Number of daily quests drawn per player per period. */
export const DAILY_QUESTS_PER_PERIOD = 3;
/** Number of weekly quests drawn per player per period. */
export const WEEKLY_QUESTS_PER_PERIOD = 3;

/**
 * Build a player's list of `count` quests for `period`, random per user:
 * one from each of `count` random families, with a random variant and a
 * matching reward. Weekly draws pull stronger rewards than daily ones.
 */
export function drawQuests(period: QuestPeriod, count: number): QuestDefinition[] {
  const families = pickFamilies(count);
  return families.map(family => {
    const variant = pick(family.variants);
    const rewardIdx = family.variants.indexOf(variant);
    const reward = family.rewards[period][rewardIdx]!;
    return {
      kind: family.kind,
      target: variant,
      reward,
      emoji: FAMILY_EMOJI[family.kind],
      text: family.lines[period].map(line => line.replace("{amount}", String(variant)))[
        Math.floor(Math.random() * family.lines[period].length)
      ]!,
      slug: questKey(family.kind, variant),
    };
  });
}

/** Emoji shown for each quest family in the quests panel. */
const FAMILY_EMOJI: Record<QuestKind, string> = {
  earn: "💰",
  spend: "💸",
  deposit: "🏦",
  withdraw: "🏧",
  gamble: "🎰",
  work: "🧹",
  claimDaily: "🍩",
  interact: "🤝",
  giveGift: "🎁",
  paySomeone: "💌",
};

/** Resolve a stored `slug` back into a concrete quest definition. `null` for
 * unknown slugs (e.g. a catalog family that was removed). */
export function findQuestBySlug(slug: string): QuestDefinition | null {
  const [kind, target] = slug.split(":");
  const family = FAMILIES.find(
    candidate => candidate.kind === kind && candidate.variants.includes(Number(target))
  );
  if (!family) {
    return null;
  }
  return buildDefinition(family, Number(target));
}

/** Build the concrete definition for `family` at `target` (variants must
 * contain `target`). */
export function buildDefinition(family: QuestFamily, target: number): QuestDefinition {
  const rewardIdx = family.variants.indexOf(target);
  const reward = family.rewards.daily[rewardIdx] ?? 0;
  return {
    kind: family.kind,
    target,
    reward,
    emoji: FAMILY_EMOJI[family.kind],
    text: `${family.title} - ${target}`,
    slug: questKey(family.kind, target),
  };
}

/** Pick `count` distinct random families from the catalog. */
export function pickFamilies(count: number): QuestFamily[] {
  const shuffled = [...FAMILIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export { TITLES };
