import type { NonThreadGuildBasedChannel } from "discord.js";
import type { Fields } from "../drafts";

export function channelFields(channel: NonThreadGuildBasedChannel): Fields {
  return {
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId,
    topic: "topic" in channel ? (channel.topic ?? null) : null,
    nsfw: "nsfw" in channel ? channel.nsfw : null,
    slowmode: "rateLimitPerUser" in channel ? (channel.rateLimitPerUser ?? null) : null,
  };
}
