export type ProfileScope = "user" | "global";

export default abstract class Profile<TRow> {
    
  private dirty: boolean = false;
  protected readonly key: string;

  constructor(userId: string) {
    this.key = this.resolveKey(userId);
  }

  protected resolveKey(userId: string): string {
    return this.scope === "global" ? "global" : userId;
  }

  /**
   * The scope this profile keys by.
   *
   * "user" profiles key by the user id; "global" profiles share one row.
   *
   * @returns The profile scope.
   */
  protected abstract get scope(): ProfileScope;

  /**
   * Populate this profile's fields from a raw row payload.
   *
   * @param raw - The raw row payload.
   */
  protected abstract deserialize(raw: TRow): void;
  /**
   * Map this profile's fields into a raw row payload.
   *
   * @returns The raw row payload.
   */
  protected abstract serialize(): TRow;
  /**
   * Read the raw payload from storage.
   *
   * @returns The raw payload, or undefined if no row exists.
   */
  protected abstract fetch(): Promise<TRow | undefined>;
  /**
   * Persist a raw payload under this.key.
   *
   * @param raw - The raw payload to persist.
   */
  protected abstract persist(raw: TRow): Promise<void>;

  /**
   * Load the profile's data from storage.
   */
  public async load(): Promise<void> {
    const raw = await this.fetch();
    this.deserialize(raw ?? ({} as TRow));
  }

  public get isDirty(): boolean {
    return this.dirty;
  }

  public markDirty(): void {
    this.dirty = true;
  }

  public async save(): Promise<void> {
    await this.persist(this.serialize());
    this.dirty = false;
  }
}
