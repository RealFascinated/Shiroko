import { EventHandler } from "@/event/event-handler";
import LevelUpEvent from "@/event/events/level-up.event";
import MessageRecordedEvent from "@/event/events/message-recorded.event";
import VoiceSessionEndedEvent from "@/event/events/voice-session-ended.event";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import { baseEmbed } from "@/lib/embed";
import SettingsManager from "@/settings/index";
import GlobalUsersManager from "@/user/global-users-manager";
import LevelsCommand from "./command/levels/levels.command";
import { levelUpPlaceholders } from "./level-up-placeholders";
import { levelsSettings } from "./levels-settings";
import { levelsService } from "./levels.service";

/**
 * The levelling feature: `/levels` command plus XP listeners. Consumes the
 * stats feature's derived events (`MessageRecorded`, `VoiceSessionEnded`)
 * as its only activity sources.
 */
export default class LevelsFeature extends Feature {
  constructor() {
    super(FeatureIds.Levels, { name: "Levelling", emoji: "📈" });

    SettingsManager.register(levelsSettings);
    this.registerCommand(new LevelsCommand());
  }

  @EventHandler(MessageRecordedEvent, { featureId: FeatureIds.Levels })
  public async onMessageRecorded(event: MessageRecordedEvent): Promise<void> {
    const guild = event.guildData;
    if (!guild) {
      return;
    }
    await levelsService.grantMessageXp(guild, event.userId, event.channelId);
  }

  @EventHandler(VoiceSessionEndedEvent, { featureId: FeatureIds.Levels })
  public async onVoiceSessionEnded(event: VoiceSessionEndedEvent): Promise<void> {
    const guild = event.guildData;
    if (!guild) {
      return;
    }
    const durationSeconds = Math.max(
      0,
      Math.floor((event.leftAt.getTime() - event.joinedAt.getTime()) / 1000)
    );
    await levelsService.grantVoiceXp(guild, event.userId, durationSeconds);
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
  const member = await guild.members.fetch(event.userId).catch(() => null);
  if (!member) {
    return;
  }
  const rewards = await levelsService.rewardsBetween(guild.id, event.prevLevel + 1, event.newLevel);
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
  try {
    await channel.send({
      embeds: [baseEmbed("levels").setTitle("🎉 Level Up").setDescription(description)],
    });
  } catch (error) {
    console.error(`Failed to announce level-up for ${event.userId}:`, error);
  }
}
