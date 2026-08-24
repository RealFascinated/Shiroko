export { remainingMs } from "../time";

/**
 * An active cooldown: `endsAt` is when it lifts, `metadata` is an optional
 * payload stored alongside the timer (amounts, streak counts, flavor).
 */
export interface Cooldown {
  endsAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Result of requesting a cooldown.
 *
 * If `ok` is `true`, the cooldown is now active (a fresh one); if `false`,
 * it is still running.
 */
export interface TryStartResult {
  ok: boolean;
  cooldown: Cooldown;
}

/**
 * Base implementation for a cooldown store.
 *
 * Subclasses only implement the backend write primitives `_set`, `_get`,
 * `_delete`, and `_clear`. Everything else — `tryStart`, `get`,
 * `isOnCooldown`, `delete`, `clear` — is shared, including stale-entry
 * expiry.
 */
export abstract class Cooldowns {
  /**
   * Start a cooldown for `key`, unless one is already running.
   *
   * Returns `ok: true` and the new `Cooldown` if the key was free, or
   * `ok: false` and the *existing* cooldown (with its original `metadata`)
   * if one is still active. Callers typically respond to `ok: false` with
   * "try again in X".
   */
  public async tryStart(
    key: string,
    ttlMs: number,
    metadata?: Record<string, unknown>
  ): Promise<TryStartResult> {
    const existing = await this.get(key);
    if (existing) {
      return { ok: false, cooldown: existing };
    }
    const cooldown = { endsAt: new Date(Date.now() + ttlMs), metadata };
    await this._set(key, cooldown);
    return { ok: true, cooldown };
  }

  /**
   * Fetch a cooldown by key, or `null` if it is absent or already expired
   * (an expired entry is dropped — invoking `get` is what clears it).
   */
  public async get(key: string): Promise<Cooldown | null> {
    const row = await this._get(key);
    if (!row) {
      return null;
    }
    if (row.endsAt.getTime() <= Date.now()) {
      await this._delete(key);
      return null;
    }
    return row;
  }

  /**
   * Whether `key` is currently cooling down. Equivalent to `get(key) !== null`.
   */
  public async isOnCooldown(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  /**
   * Remove a cooldown immediately, regardless of its timer.
   */
  public async delete(key: string): Promise<void> {
    await this._delete(key);
  }

  /**
   * Remove every cooldown belonging to `userId`. Keys built with
   * `cooldownKey` embed the user id first (e.g. "123:gamble"), which the
   * backend matches on.
   */
  public async clear(userId: string): Promise<void> {
    await this._clear(userId);
  }

  /** Backend write: store `cooldown` for `key`. */
  protected abstract _set(key: string, cooldown: Cooldown): Promise<void>;

  /** Backend read: the stored cooldown for `key`, or `null`. */
  protected abstract _get(key: string): Promise<Cooldown | null>;

  /** Backend write: remove `key`. */
  protected abstract _delete(key: string): Promise<void>;

  /** Backend write: drop every key that starts with `${userId}:`. */
  protected abstract _clear(userId: string): Promise<void>;
}
