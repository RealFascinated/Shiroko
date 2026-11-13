import type { Guild } from "discord.js";
import type { LogType } from "./log-type";
import { loggingSettings } from "./logging-settings";

export default class LoggingService {
  public async getChannelId(guild: Guild): Promise<string | null> {
    return loggingSettings.get(guild.id, "channelId");
  }

  public async isEnabled(guild: Guild, logType: LogType): Promise<boolean> {
    return loggingSettings.get(guild.id, `enabled.${logType}`);
  }
}

export const loggingService = new LoggingService();
