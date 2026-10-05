import type { Guild } from "discord.js";
import { logTypes, type LogType } from "./log-type";
import { loggingSettings } from "./logging-settings";

export default class LoggingService {
  public async getChannelId(guild: Guild): Promise<string | null> {
    return loggingSettings.get(guild.id, "channelId");
  }

  public async setChannelId(guild: Guild, channelId: string): Promise<void> {
    await loggingSettings.set(guild.id, "channelId", channelId);
  }

  public async isEnabled(guild: Guild, logType: LogType): Promise<boolean> {
    return loggingSettings.get(guild.id, `enabled.${logType}`);
  }

  public async setEnabled(guild: Guild, logType: LogType, enabled: boolean): Promise<void> {
    await loggingSettings.set(guild.id, `enabled.${logType}`, enabled);
  }

  /**
   * A guild's logging configuration: the target channel and every log
   * type's enabled state, read in one store read.
   */
  public async info(
    guild: Guild
  ): Promise<{ channelId: string | null; states: Array<{ logType: LogType; enabled: boolean }> }> {
    const values = await loggingSettings.values(guild.id);
    return {
      channelId: values.channelId,
      states: (Object.keys(logTypes) as LogType[]).map(logType => ({
        logType,
        enabled: values.enabled[logType],
      })),
    };
  }
}

export const loggingService = new LoggingService();
