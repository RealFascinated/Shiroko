/**
 * Identifiers for every toggleable feature. Lives in its own leaf module
 * (no imports) so any file can reference a feature id, including event
 * wrappers, without pulling in the `Feature` class and the command cycle.
 */
export enum FeatureIds {
  Interaction = "interaction",
  Invites = "invites",
  Levels = "levels",
  Stats = "stats",
}
