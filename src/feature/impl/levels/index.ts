import { EventBus } from "../../../event/event-bus.ts";
import { EventHandler } from "../../../event/event-handler.ts";
import { EventListener } from "../../../event/event-listener.ts";
import LevelUpEvent from "../../../event/events/level-up.event.ts";
import MessageRecordedEvent from "../../../event/events/message-recorded.event.ts";
import VoiceSessionEndedEvent from "../../../event/events/voice-session-ended.event.ts";
import { baseEmbed } from "../../../lib/embed.ts";
import SettingsManager from "../../../settings";
import { FeatureIds } from "../../feature-ids.ts";
import Feature from "../../feature.ts";
import LevelsCommand from "./command/levels/levels.command.ts";
import { levelsSettings } from "./levels-settings.ts";
import { levelsService } from "./levels.service.ts";

/**
 * The levelling feature: `/levels` command plus XP listeners. Consumes the
 * stats feature's derived events (`MessageRecorded`, `VoiceSessionEnded`)
 * as its only activity sources.
 */
export default class LevelsFeature extends Feature {
  constructor() {
    super(FeatureIds.Levels);

    SettingsManager.register(levelsSettings);
    this.registerCommand(new LevelsCommand());
  }
}

/**
 * Feeds the levelling service from derived activity events. Listens to the
 * stats listeners' outputs and emits `LevelUpEvent` for reward granters and
 * announcements. Gated on the levelling feature toggle.
 */
export class LevelsListeners extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
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
 * if any. A missing/deleted channel or missing send permission logs and
 * continues. Announcing is best-effort, never fatal.
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
  try {
    await channel.send({
      embeds: [
        baseEmbed("levels")
          .setTitle("🎉 Level Up")
          .setDescription(`**<@${event.userId}>** reached **level ${event.newLevel}**!`),
      ],
    });
  } catch (error) {
    console.error(`Failed to announce level-up for ${event.userId}:`, error);
  }
}
