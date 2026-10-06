import { StickerFormatType, type Sticker } from "discord.js";
import { changeLine, enumLabel } from "./text";

/** User-facing names for Discord's sticker formats. */
const STICKER_FORMAT_NAMES: Record<number, string> = {
  [StickerFormatType.PNG]: "PNG",
  [StickerFormatType.APNG]: "APNG",
  [StickerFormatType.Lottie]: "Lottie",
  [StickerFormatType.GIF]: "GIF",
};

/** A sticker format as its user-facing name, falling back to "Unknown". */
export function stickerFormatLabel(format: number): string {
  return enumLabel(STICKER_FORMAT_NAMES, format, "Unknown");
}

/** The fields of a sticker update that changed, as ready-to-print lines. */
export function describeStickerChanges(oldSticker: Sticker, newSticker: Sticker): string[] {
  const lines: string[] = [];
  if (oldSticker.name !== newSticker.name) {
    lines.push(changeLine("Name", oldSticker.name, newSticker.name));
  }
  if (oldSticker.description !== newSticker.description) {
    lines.push(changeLine("Description", oldSticker.description ?? "None", newSticker.description ?? "None"));
  }
  if (oldSticker.tags !== newSticker.tags) {
    lines.push(changeLine("Tags", oldSticker.tags ?? "None", newSticker.tags ?? "None"));
  }
  return lines;
}
