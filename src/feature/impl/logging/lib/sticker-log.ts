import { StickerFormatType, type Sticker } from "discord.js";
import { changeLine, enumLabel } from "./text";

const STICKER_FORMAT_NAMES: Record<number, string> = {
  [StickerFormatType.PNG]: "PNG",
  [StickerFormatType.APNG]: "APNG",
  [StickerFormatType.Lottie]: "Lottie",
  [StickerFormatType.GIF]: "GIF",
};

export function stickerFormatLabel(format: number): string {
  return enumLabel(STICKER_FORMAT_NAMES, format, "Unknown");
}

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
