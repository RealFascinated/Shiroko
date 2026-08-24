import Profile from "./profile";

export type ProfileCtor = new (userId: string) => Profile<unknown>;

/**
 * Owns the profile instances for a single GlobalUser.
 *
 * Profiles are created lazily and cached by class; each `getProfile` on first
 * access constructs the profile and loads its data, then returns the cached
 * instance on subsequent calls.
 */
export default class ProfileHolder {
  private readonly profiles = new Map<ProfileCtor, Profile<unknown>>();

  constructor(private readonly userId: string) {}

  /**
   * Get the cached profile for `ctor`, constructing and loading it on first access.
   *
   * @param ctor - The profile class to get.
   * @returns The loaded profile instance.
   */
  public async getProfile<T extends Profile<unknown>>(ctor: new (userId: string) => T): Promise<T> {
    const cached = this.profiles.get(ctor) as T | undefined;
    if (cached) {
      return cached;
    }

    const profile = new ctor(this.userId);
    await profile.load();
    this.profiles.set(ctor, profile);
    return profile;
  }

  /**
   * Persist every registered dirty profile.
   */
  public async saveProfiles(): Promise<number> {
    let savedCount = 0;
    for (const profile of this.profiles.values()) {
      if (profile.isDirty) {
        await profile.save();
        savedCount++;
      }
    }

    return savedCount;
  }
}
