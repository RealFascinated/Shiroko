import { Cooldowns, type Cooldown } from "../cooldowns";

/**
 * In-memory cooldowns. Fast, zero I/O, and they reset on restart, which is
 * the correct trade-off for cooldowns like gambling or a global shop reset.
 * For cooldowns that must survive a restart or span multiple processes, use
 * `DbCooldowns` instead.
 */
export default class MemoryCooldowns extends Cooldowns {
  private _cooldowns = new Map<string, Cooldown>();

  protected override async _set(key: string, cooldown: Cooldown): Promise<void> {
    // Drop expired entries lazily so the map doesn't grow unbounded.
    for (const [storedKey, stored] of this._cooldowns) {
      if (stored.endsAt.getTime() <= Date.now()) {
        this._cooldowns.delete(storedKey);
      }
    }
    this._cooldowns.set(key, cooldown);
  }

  protected override async _get(key: string): Promise<Cooldown | null> {
    return this._cooldowns.get(key) ?? null;
  }

  protected override async _delete(key: string): Promise<void> {
    this._cooldowns.delete(key);
  }

  /** Drop every key that starts with `${userId}:` (keys built via `cooldownKey`). */
  protected override async _clear(userId: string): Promise<void> {
    for (const key of this._cooldowns.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this._cooldowns.delete(key);
      }
    }
  }
}
