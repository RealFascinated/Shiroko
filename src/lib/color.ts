/**
 * Parse an embed colour as a `#rrggbb` / `rrggbb` hex string into the
 * integer discord.js expects. Returns `null` for anything malformed, so a
 * caller can keep its previous value instead of storing garbage.
 */
export function parseColor(input: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(input.trim());
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1]!, 16);
}

/**
 * Render a colour integer as `#rrggbb`, the form {@link parseColor}
 * accepts back.
 */
export function formatColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
