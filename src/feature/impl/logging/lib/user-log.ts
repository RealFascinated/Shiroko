import type { EmbedAuthorOptions, GuildMember, PartialGuildMember, PartialUser, User } from "discord.js";
import { code } from "./text";

/** A user mention with their id, or "Unknown" when Discord resolved no user. */
export function userLabel(user: User | PartialUser | null): string {
  return user ? `${user} (${code(user.id)})` : "Unknown";
}

/** The author row for a log about `subject`: their name and avatar. */
export function subjectAuthor(
  subject: GuildMember | PartialGuildMember | User | PartialUser
): EmbedAuthorOptions {
  return {
    name: subject.displayName,
    iconURL: subject.displayAvatarURL({ size: 4096, extension: "webp" }),
  };
}

/** Render a stored asset URL as a markdown link, or "Unknown" when it was not stored. */
export function assetLink(url: string | null, type: "before" | "after"): string {
  return url ? `[[${type}]](${url})` : "Unknown";
}
