import { componentCustomId } from "@/component/component";
import Components from "@/component/components";
import { FeatureIds } from "@/feature/feature-ids";
import GuildFeatures from "@/feature/guild-features";
import { todayUtc } from "@/lib/date";
import { fetchGuildMember } from "@/lib/guild";
import { TimeUnit } from "@/lib/time";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type Guild,
  type GuildMember,
  type Message,
  type SendableChannels,
} from "discord.js";
import { birthdaySettings } from "./birthday-settings";
import { birthdayService, type Celebrant } from "./birthday.service";
import {
  BIRTHDAY_WISH_COMPONENT_ID,
  birthdayEmbed,
  type BirthdayWishPayload,
} from "./birthday-wish.component";

const WISH_WINDOW_MS = TimeUnit.toMillis(TimeUnit.Day, 7);

/** A stored celebrant resolved against the guild's current membership. */
interface ResolvedCelebrant {
  member: GuildMember;
  age: number;
}

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
 * each one that has not been announced yet this year.
 *
 * Safe to run any number of times a day: announcements are claimed in
 * `birthday_announcements`, so a sweep that runs late, twice, or after a
 * restart posts each celebrant once.
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
        await sweepGuild(guild, byGuild.get(guild.id) ?? [], now);
      } catch (error) {
        console.error(`Birthday sweep failed for guild ${guild.id}:`, error);
      }
    }
    await birthdayService.pruneAnnouncements(now.getUTCFullYear());
  } catch (error) {
    console.error("Birthday sweep failed:", error);
  }
}

async function sweepGuild(guild: Guild, celebrants: Celebrant[], now: Date): Promise<void> {
  if (!(await GuildFeatures.isFeatureEnabled(guild, FeatureIds.Birthday))) {
    return;
  }
  // Stored rows outlive guild membership and the member cache only holds
  // members the gateway has sent, so resolve each celebrant against the API
  // rather than dropping whoever the cache is missing.
  const resolved = await Promise.all(
    celebrants.map(async celebrant => {
      const member = await fetchGuildMember(guild, celebrant.userId);
      return member ? { member, age: celebrant.age } : null;
    })
  );
  const members = resolved.filter((entry): entry is ResolvedCelebrant => entry !== null);
  if (members.length < celebrants.length) {
    console.error(
      `Birthday sweep could not resolve ${celebrants.length - members.length} member(s) in ${guild.id}`
    );
  }
  // Runs with no celebrants too: that is the day the previous holder loses the role.
  const roleId = await birthdaySettings.get(guild.id, "roleId");
  if (roleId) {
    await swapRoles(guild, roleId, members);
  }
  const channelId = await birthdaySettings.get(guild.id, "announceChannelId");
  if (channelId && members.length > 0) {
    await announce(guild, channelId, members, now.getUTCFullYear());
  }
}

/**
 * Remove the birthday role from everyone still holding it, then grant it to
 * today's celebrants. Removal targets holders rather than "yesterday's
 * celebrants", which clears stale grants without needing a `granted_at`
 * column, and runs first so a sweep never strips a role it just handed out.
 */
async function swapRoles(guild: Guild, roleId: string, celebrants: ResolvedCelebrant[]): Promise<void> {
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

  const celebrantIds = new Set(celebrants.map(({ member }) => member.id));
  // The cache only holds members the gateway has sent, so a holder who is
  // not cached would keep the role forever.
  for (const member of (await guild.members.fetch()).values()) {
    if (!member.roles.cache.has(roleId) || celebrantIds.has(member.id)) {
      continue;
    }
    try {
      await member.roles.remove(roleId, "Birthday over");
    } catch (error) {
      console.error(`Failed to remove birthday role from ${member.id}:`, error);
    }
  }

  for (const { member } of celebrants) {
    if (member.roles.cache.has(roleId)) {
      continue;
    }
    try {
      await member.roles.add(roleId, "Happy birthday!");
    } catch (error) {
      console.error(`Failed to grant birthday role to ${member.id}:`, error);
    }
  }
}

/**
 * Post each unannounced celebrant to the guild's announce channel, one
 * message apiece so each carries its own wish count. A channel that is
 * missing or not sendable logs and skips; a failed send releases the claim
 * so the next sweep retries.
 */
async function announce(
  guild: Guild,
  channelId: string,
  celebrants: ResolvedCelebrant[],
  year: number
): Promise<void> {
  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isSendable()) {
    console.error(`Birthday announce channel ${channelId} not sendable in ${guild.id}`);
    return;
  }
  for (const { member, age } of celebrants) {
    if (!(await birthdayService.claimAnnouncement(guild.id, member.id, year))) {
      continue;
    }
    const payload: BirthdayWishPayload = { celebrantId: member.id, age };
    let message: Message;
    try {
      message = await channel.send({ embeds: [birthdayEmbed(payload, 0)] });
    } catch (error) {
      console.error(`Failed to announce birthday of ${member.id} in ${guild.id}:`, error);
      await birthdayService.releaseAnnouncement(guild.id, member.id, year);
      continue;
    }
    try {
      await attachWishButton(message, guild.id, channel, payload);
    } catch (error) {
      console.error(`Failed to attach wish button for ${member.id} in ${guild.id}:`, error);
    }
  }
}

/**
 * The button needs the message id, so it is added after the send. Its row
 * expires after a week, which is also when the wishes cascade away.
 */
async function attachWishButton(
  message: Message,
  guildId: string,
  channel: SendableChannels,
  payload: BirthdayWishPayload
): Promise<void> {
  const row = await Components.create({
    guildId,
    channelId: channel.id,
    messageId: message.id,
    userId: null,
    type: "button",
    extraData: payload,
    expiresAt: new Date(Date.now() + WISH_WINDOW_MS),
  });
  const button = new ButtonBuilder()
    .setCustomId(componentCustomId(BIRTHDAY_WISH_COMPONENT_ID, row.id))
    .setLabel("Wish them")
    .setEmoji("🎂")
    .setStyle(ButtonStyle.Primary);
  await message.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)] });
}
