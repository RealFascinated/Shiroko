import type { EmbedAuthorOptions, GuildMember, PartialGuildMember, PartialUser, User } from "discord.js";
import { code } from "./text";

export function userLabel(user: User | PartialUser | null): string {
  return user ? `${user} (${code(user.id)})` : "Unknown";
}

/** The author row for a log about `subject`: their username and avatar. */
export function subjectAuthor(
  subject: GuildMember | PartialGuildMember | User | PartialUser
): EmbedAuthorOptions {
  const user = "user" in subject ? subject.user : subject;
  return {
    name: user.username ?? user.id,
    iconURL: subject.displayAvatarURL({ size: 4096, extension: "webp" }),
  };
}

export function assetLink(url: string | null, type: "before" | "after"): string {
  return url ? `[[${type}]](${url})` : "Unknown";
}
