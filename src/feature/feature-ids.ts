/**
 * Identifiers for every toggleable feature. Lives in its own leaf module
 * (no imports) so any file can reference a feature id, including event
 * wrappers, without pulling in the `Feature` class and the command cycle.
 */
export enum FeatureIds {
  General = "general",
  Autoroles = "autoroles",
  Birthday = "birthday",
  Fun = "fun",
  Interaction = "interaction",
  Invites = "invites",
  Levels = "levels",
  Reminders = "reminders",
  Stats = "stats",
  Welcomer = "welcomer",
  Logging = "logs",
}

/**
 * The enum's string values as a plain literal union, so they can key a
 * record (`Record<FeatureId, boolean>`) and be indexed by a dotted path,
 * which a nominal enum type cannot.
 */
export type FeatureId = `${FeatureIds}`;
