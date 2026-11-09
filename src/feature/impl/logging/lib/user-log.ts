import type { EmbedAuthorOptions, GuildMember, PartialGuildMember, PartialUser, User } from "discord.js";
import { LogTone, idFooter, type LogCard } from "./log-card";
import { code, detailLine } from "./text";

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

/**
 * The card for a user changing or removing an avatar or banner. `noun` is
 * the asset's name in lower case; the caller attaches the new image.
 */
export function assetChangeCard(
  user: User | PartialUser,
  noun: "avatar" | "banner",
  hadAsset: boolean,
  removed: boolean,
  beforeUrl: string | null,
  afterUrl: string | null
): LogCard {
  return {
    tone: removed ? LogTone.Negative : LogTone.Change,
    headline: `${user} ${removed ? "removed" : "changed"} their ${noun}.`,
    details: [
      detailLine("Before", hadAsset ? assetLink(beforeUrl, "before") : "None"),
      detailLine("After", removed ? "None" : assetLink(afterUrl, "after")),
    ],
    subject: user,
    footer: idFooter("User", user.id),
  };
}
