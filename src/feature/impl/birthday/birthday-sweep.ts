import type { Client, Guild } from "discord.js";
import { baseEmbed } from "../../../lib/embed";
import { FeatureIds } from "../../feature-ids";
import GuildFeatures from "../../guild-features";
import { birthdaySettings } from "./birthday-settings";
import { birthdayService, type Celebrant } from "./birthday.service";
import { todayUtc } from "./date";

/**
 * The nightly birthday sweep, kept out of `birthday.service.ts` because it
 * builds embeds: `lib/embed.ts` imports `discordClient` from `src/index.ts`,
 * and a module on `src/index.ts`'s static import chain pulling in `embed`
 * re-enters that graph mid-initialization. `LevelsFeature` splits its
 * announcing out for the same reason.
 */

/**
 * For every guild with the feature on: strip the birthday role from
 * whoever still holds it, grant it to today's celebrants, then announce
 * them.
 *
 * Never rejects. `Bun.cron` turns a rejected promise into an
 * `unhandledRejection`, which exits the process without a handler, so each
 * guild is isolated and the whole body is guarded.
 */
export async function runBirthdaySweep(client: Client, now: Date = new Date()): Promise<void> {
  try {
    const { month, day } = todayUtc(now);
    const byGuild = await birthdayService.birthdaysOn(month, day, now);

    for (const guild of client.guilds.cache.values()) {
      try {
        await sweepGuild(guild, byGuild.get(guild.id) ?? []);
      } catch (error) {
        console.error(`Birthday sweep failed for guild ${guild.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Birthday sweep failed:", error);
  }
}

async function sweepGuild(guild: Guild, celebrants: Celebrant[]): Promise<void> {
  if (!(await GuildFeatures.isFeatureEnabled(guild, FeatureIds.Birthday))) {
    return;
  }
  // Stored rows outlive guild membership, so narrow to current members
  // before acting on them.
  const members = celebrants.filter(celebrant => guild.members.cache.has(celebrant.userId));
  if (members.length === 0) {
    return;
  }
  const roleId = await birthdaySettings.get(guild.id, "roleId");
  if (roleId) {
    await swapRoles(guild, roleId, members);
  }
  const channelId = await birthdaySettings.get(guild.id, "announceChannelId");
  if (channelId) {
    await announce(guild, channelId, members);
  }
}

/**
 * Remove the birthday role from everyone still holding it, then grant it to
 * today's celebrants. Removal targets holders rather than "yesterday's
 * celebrants", which clears stale grants without needing a `granted_at`
 * column, and runs first so a sweep never strips a role it just handed out.
 */
async function swapRoles(guild: Guild, roleId: string, celebrants: Celebrant[]): Promise<void> {
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    console.error(`Birthday role ${roleId} not found in ${guild.id}`);
    return;
  }
  const me = guild.members.me;
  if (me && role.position >= me.roles.highest.position) {
    console.error(`Birthday role ${roleId} is above the bot's highest role in ${guild.id}`);
    return;
  }

  const celebrantIds = new Set(celebrants.map(celebrant => celebrant.userId));
  for (const member of guild.members.cache.values()) {
    if (!member.roles.cache.has(roleId) || celebrantIds.has(member.id)) {
      continue;
    }
    try {
      await member.roles.remove(roleId, "Birthday over");
    } catch (error) {
      console.error(`Failed to remove birthday role from ${member.id}:`, error);
    }
  }

  for (const { userId } of celebrants) {
    const member = guild.members.cache.get(userId);
    if (!member || member.roles.cache.has(roleId)) {
      continue;
    }
    try {
      await member.roles.add(roleId, "Happy birthday!");
    } catch (error) {
      console.error(`Failed to grant birthday role to ${userId}:`, error);
    }
  }
}

/**
 * Post today's birthdays to the guild's announce channel. A channel that is
 * missing or not sendable logs and skips; announcing is best-effort and
 * never fatal.
 */
async function announce(guild: Guild, channelId: string, celebrants: Celebrant[]): Promise<void> {
  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isSendable()) {
    console.error(`Birthday announce channel ${channelId} not sendable in ${guild.id}`);
    return;
  }
  const lines = celebrants.map(({ userId, age }) => `<@${userId}> turns **${age}** today!`);
  const embed = baseEmbed("birthday")
    .setTitle("🎂 Happy Birthday!")
    .setDescription(`Happy birthday!\n\n${lines.join("\n")}`);
  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`Failed to announce birthdays in ${guild.id}:`, error);
  }
}
