import { EventHandler } from "@/event/event-handler";
import LevelUpEvent from "@/event/events/level-up.event";
import MessageRecordedEvent from "@/event/events/message-recorded.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import { fetchGuildMember } from "@/lib/guild";
import SettingsManager from "@/settings/index";
import GlobalUsersManager from "@/user/global-users-manager";
import LevelsCommand from "./command/levels/levels.command";
import { renderLevelUpCard } from "./level-up-card";
import { levelUpPlaceholders } from "./level-up-placeholders";
import { levelsSettings } from "./levels-settings";
import { levelsService } from "./levels.service";

/**
 * The levelling feature: `/levels` command plus XP listeners. Consumes the
 * stats feature's derived `MessageRecorded` event as its only activity
 * source.
 */
export default class LevelsFeature extends Feature {
  constructor() {
    super(FeatureIds.Levels, { name: "Levelling", emoji: "📈" });

    SettingsManager.register(levelsSettings);
    this.registerCommand(new LevelsCommand());
  }

  @EventHandler(MessageRecordedEvent, { featureId: FeatureIds.Levels })
  public async onMessageRecorded(event: MessageRecordedEvent): Promise<void> {
    if (!event.message.inGuild()) {
      return;
    }
    await levelsService.grantMessageXp(event.message);
  }

  @EventHandler(LevelUpEvent, { featureId: FeatureIds.Levels })
  public async onLevelUp(event: LevelUpEvent): Promise<void> {
    await grantLevelRewards(event);
    await announceLevelUp(event);
  }
}

/**
 * Grant every reward role unlocked between the old and new level. Worst
 * case is a missing role or missing permissions → log and continue; the
 * level-up itself is never rolled back.
 */
async function grantLevelRewards(event: LevelUpEvent): Promise<void> {
  const guild = event.guildData;
  const member = await fetchGuildMember(guild, event.userId);
  if (!member) {
    return;
  }
  // Level 1 is the starting level and is never crossed, so it is granted with the first level-up.
  const fromLevel = event.prevLevel === 1 ? 1 : event.prevLevel + 1;
  const rewards = await levelsService.rewardsBetween(guild.id, fromLevel, event.newLevel);
  const roleIds = rewards.filter(r => r.type === "Role" && r.roleId).map(r => r.roleId as string);
  if (roleIds.length === 0) {
    return;
  }
  try {
    await member.roles.add(roleIds);
  } catch (error) {
    console.error(`Failed to grant level reward roles to ${event.userId}:`, error);
  }
}

/**
 * Post a level-up result card to the guild's configured announce channel,
 * if any, with the message rendered from the guild's stored template. A
 * missing/deleted channel, missing send permission, or unresolvable user
 * logs and continues. Announcing is best-effort, never fatal.
 */
async function announceLevelUp(event: LevelUpEvent): Promise<void> {
  const guild = event.guildData;
  const announceChannelId = await levelsSettings.get(guild.id, "announceChannelId");
  if (!announceChannelId) {
    return;
  }
  const channel = guild.channels.cache.get(announceChannelId);
  if (!channel || !channel.isSendable()) {
    console.error(`Level-up announce channel ${announceChannelId} not sendable in ${guild.id}`);
    return;
  }
  const user = await guild.client.users.fetch(event.userId).catch(() => null);
  if (!user) {
    console.error(`Could not resolve user ${event.userId} for the level-up announcement`);
    return;
  }
  const [globalUser, template] = await Promise.all([
    GlobalUsersManager.getUser(user),
    levelsSettings.get(guild.id, "levelUpMessage"),
  ]);
  const description = await levelUpPlaceholders.replace(
    { globalUser, guild, level: event.newLevel, xp: event.xp },
    template
  );
  const card = await renderLevelUpCard({
    name: user.displayName,
    avatarUrl: user.displayAvatarURL({ size: 256, extension: "png" }),
    prevLevel: event.prevLevel,
    newLevel: event.newLevel,
  });
  try {
    await channel.send({
      content: description,
      files: [{ attachment: card, name: "level-up.png" }],
    });
  } catch (error) {
    console.error(`Failed to announce level-up for ${event.userId}:`, error);
  }
}
