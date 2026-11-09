import { describe, expect, test } from "bun:test";
import { AuditLogEvent, type Guild, type User } from "discord.js";
import { LogTone, buildLogCard } from "./log-card";

const guild = { name: "Shiroko", iconURL: () => null } as unknown as Guild;

function user(id: string): User {
  return {
    id,
    username: `user-${id}`,
    displayAvatarURL: () => `https://cdn.example/${id}.webp`,
    toString: () => `<@${id}>`,
  } as unknown as User;
}

describe("buildLogCard", () => {
  test("puts the details, then the moderator and reason, under the headline", () => {
    const embed = buildLogCard(guild, {
      tone: LogTone.Negative,
      headline: "<@1> was kicked.",
      details: ["**Roles:** None"],
      actor: { action: AuditLogEvent.MemberKick, executor: user("2"), reason: "Spam" },
      subject: user("1"),
      footer: "User ID: 1",
    }).toJSON();
    expect(embed.description).toContain("<@1> was kicked.");
    expect(embed.description).toContain("<@2>");
    expect(embed.description).toContain("Spam");
    expect(embed.color).toBe(LogTone.Negative);
    expect(embed.author?.name).toBe("user-1");
    expect(embed.footer?.text).toContain("1");
  });

  test("names a subject acting on themselves as Self", () => {
    const embed = buildLogCard(guild, {
      tone: LogTone.Change,
      headline: "<@1>'s roles were updated.",
      actor: { action: AuditLogEvent.MemberRoleUpdate, executor: user("1"), reason: null },
      subject: user("1"),
    }).toJSON();
    expect(embed.description).toContain("<@1>'s roles were updated.");
    expect(embed.description).toContain("Self");
  });

  test("falls back to the actor, then the server, for the author row", () => {
    const actor = { action: AuditLogEvent.ChannelCreate, executor: user("2"), reason: null };
    expect(buildLogCard(guild, { tone: LogTone.Positive, headline: "x", actor }).toJSON().author?.name).toBe(
      "user-2"
    );
    expect(buildLogCard(guild, { tone: LogTone.Positive, headline: "x" }).toJSON().author?.name).toBe(
      "Shiroko"
    );
  });

  test("leaves a bare headline when there is nothing else to say", () => {
    expect(buildLogCard(guild, { tone: LogTone.Neutral, headline: "x" }).toJSON().description).toBe("x");
  });
});
