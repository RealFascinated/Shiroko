import { FLAG_DISPLAY_NAMES } from "../../permissions";

/**
 * Resolve the raw flag choice strings (`set`) into a bitfield. Unknown
 * choices are rejected.
 */
export function parseFlags(choices: string[]): bigint {
  let flags = 0n;
  for (const choice of choices) {
    if (choice === "none") {
      continue;
    }
    const match = FLAG_DISPLAY_NAMES.find(({ label }) => label === choice);
    if (!match) {
      throw new Error(`Unknown permission flag: "${choice}".`);
    }
    flags |= match.flag;
  }
  return flags;
}
