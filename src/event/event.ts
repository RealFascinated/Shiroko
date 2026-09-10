import type { Guild } from "discord.js";
import type { FeatureIds } from "../feature/feature-ids";
import type GlobalUser from "../user/global-user";

/**
 * Base class for every internal event. Subclasses wrap a discord.js
 * payload (or a derived state change) and may carry pre-resolved context
 * (guild, global user, feature) that the bus resolves before dispatch.
 */
export default abstract class Event {
  public readonly guild: Guild | null;
  public readonly userId: string | null;
  public readonly featureId: FeatureIds | null;

  private readonly _globalUser: GlobalUser | null;

  constructor(
    options: {
      guild?: Guild | null;
      userId?: string | null;
      globalUser?: GlobalUser | null;
      featureId?: FeatureIds | null;
    } = {}
  ) {
    this.guild = options.guild ?? null;
    this.userId = options.userId ?? null;
    this.featureId = options.featureId ?? null;
    this._globalUser = options.globalUser ?? null;
  }

  /**
   * The pre-resolved global user for this event, if the bridge resolved
   * one. `null` means "not resolved yet" — call {@link getGlobalUser} to
   * fetch lazily.
   */
  public get globalUser(): GlobalUser | null {
    return this._globalUser;
  }
}
