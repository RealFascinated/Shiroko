import type { Sticker } from "discord.js";
import Event from "../event";

export default class StickerUpdatedEvent extends Event {
  public readonly stickerId: string;
  public readonly guildData: Sticker["guild"];
  public readonly oldSticker: Sticker;
  public readonly newSticker: Sticker;

  constructor(oldSticker: Sticker, newSticker: Sticker) {
    super({ guild: newSticker.guild });
    this.stickerId = newSticker.id;
    this.guildData = newSticker.guild;
    this.oldSticker = oldSticker;
    this.newSticker = newSticker;
  }
}
