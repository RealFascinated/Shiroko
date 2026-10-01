import type { Sticker } from "discord.js";
import Event from "../event";

export default class StickerCreatedEvent extends Event {
  public readonly stickerId: string;
  public readonly sticker: Sticker;
  public readonly guildData: Sticker["guild"];

  constructor(sticker: Sticker) {
    super({ guild: sticker.guild });
    this.stickerId = sticker.id;
    this.sticker = sticker;
    this.guildData = sticker.guild;
  }
}
