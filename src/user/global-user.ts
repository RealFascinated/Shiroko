import type { User } from "discord.js";
import type Profile from "../lib/profile/profile";
import ProfileHolder from "../lib/profile/profile-holder";
import { InteractionProfile } from "../feature/interaction/interaction-profile";

export default class GlobalUser {
  public readonly id: string;
  public readonly discordUser: User;

  private readonly profiles: ProfileHolder;

  constructor(id: string, discordUser: User) {
    this.id = id;
    this.discordUser = discordUser;
    this.profiles = new ProfileHolder(id);
  }

  /**
   * Get the cached profile for `ctor`, constructing and loading it on first access.
   *
   * @param ctor - The profile class to get.
   * @returns The loaded profile instance.
   */
  private getProfile<T extends Profile<unknown>>(ctor: new (userId: string) => T): Promise<T> {
    return this.profiles.getProfile(ctor);
  }

  public getInteractionsProfile(): Promise<InteractionProfile> {
    return this.getProfile(InteractionProfile);
  }

  /**
   * Persist every registered dirty profile for this user.
   *
   * @returns A promise that resolves once all dirty profiles are saved, resolves to the number of profiles saved.
   */
  public saveProfiles(): Promise<number> {
    return this.profiles.saveProfiles();
  }
}
