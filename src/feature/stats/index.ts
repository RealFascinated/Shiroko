import { EventBus } from "../../event/event-bus";
import { EventHandler } from "../../event/event-handler";
import { EventListener } from "../../event/event-listener";
import BotReadyEvent from "../../event/events/bot-ready.event";
import MessageCreatedEvent from "../../event/events/message-created.event";
import MessageRecordedEvent from "../../event/events/message-recorded.event";
import VoiceStateChangedEvent from "../../event/events/voice-state-changed.event";
import GlobalUsersManager from "../../user/global-users-manager";
import { FeatureIds } from "../feature-ids";
import Feature from "../feature.ts";
import StatsCommand from "./command/stats/stats.command";
import { statsService } from "./stats.service";

/**
 * The stats feature: `/stats` command plus voice/message tracking.
 */
export default class StatsFeature extends Feature {
  constructor() {
    super(FeatureIds.Stats);

    this.registerCommand(new StatsCommand());
  }
}

/**
 * Turns raw gateway events into stats tracking calls. Listens to
 * `MessageCreated`, `VoiceStateChanged`, and `BotReady` (to seed open
 * voice sessions), and emits derived `MessageRecorded` /
 * `VoiceSession*` events for other features to consume.
 */
export class StatsListeners extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  /**
   * Record one guild message, emitting `MessageRecorded` after a successful
   * insert so progression hooks (quests, etc.) can react.
   */
  @EventHandler(MessageCreatedEvent)
  public async onMessageCreated(event: MessageCreatedEvent): Promise<void> {
    if (event.globalUser) {
      void this.record(event);
      return;
    }
    const user = event.message.author;
    const globalUser = await GlobalUsersManager.getUser(user);
    void this.record(new MessageCreatedEvent(event.message, event.guild, globalUser));
  }

  private async record(event: MessageCreatedEvent): Promise<void> {
    const { message, guild, globalUser } = event;
    if (!guild || !globalUser) {
      return;
    }
    await statsService.recordMessage({
      id: message.id,
      userId: globalUser.id,
      guildId: guild.id,
      channelId: message.channelId,
      createdAt: message.createdAt,
    });
    await EventBus.post(
      new MessageRecordedEvent({
        userId: globalUser.id,
        guild,
        channelId: message.channelId,
      })
    );
  }

  /**
   * Track a voice state change: close/open sessions on leave/move/join.
   * No-ops on mute/deafen (equal channels).
   */
  @EventHandler(VoiceStateChangedEvent)
  public async onVoiceStateChanged(event: VoiceStateChangedEvent): Promise<void> {
    const { oldState, newState, guild } = event;
    if (!guild) {
      return;
    }
    await statsService.trackVoiceState(
      guild,
      newState.id,
      oldState?.channelId ?? null,
      newState.channelId,
      new Date()
    );
  }

  /**
   * Seed open voice sessions at startup.
   */
  @EventHandler(BotReadyEvent)
  public async onBotReady(event: BotReadyEvent): Promise<void> {
    await statsService.recoverOpenSessions(event.client);
  }
}
