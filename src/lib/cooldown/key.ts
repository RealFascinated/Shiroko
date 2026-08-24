/**
 * Canonical cooldown key for a user+kind pair, e.g. `"123456:gamble"`.
 *
 * The user id is the prefix (`"<userId>:<kind>"`) so that `clear(userId)`
 * can revoke a user's cooldowns regardless of backend (DB `LIKE`, memory
 * code). Always build keys through this helper.
 */
export function cooldownKey(userId: string, kind: string): string {
  return `${userId}:${kind}`;
}
