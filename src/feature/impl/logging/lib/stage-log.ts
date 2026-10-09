import { StageInstancePrivacyLevel, type StageInstance } from "discord.js";
import { changeLine, channelMention, code, detailLine, enumLabel } from "./text";

const PRIVACY_NAMES: Record<number, string> = {
  [StageInstancePrivacyLevel.Public]: "Public",
  [StageInstancePrivacyLevel.GuildOnly]: "Guild Only",
};

export function stageDetailLines(instance: StageInstance): string[] {
  return [
    detailLine("Topic", code(instance.topic)),
    detailLine("Channel", channelMention(instance.channelId)),
    detailLine("Privacy", code(enumLabel(PRIVACY_NAMES, instance.privacyLevel))),
  ];
}

export function describeStageChanges(oldInstance: StageInstance, newInstance: StageInstance): string[] {
  const lines: string[] = [];
  if (oldInstance.topic !== newInstance.topic) {
    lines.push(changeLine("Topic", code(oldInstance.topic), code(newInstance.topic)));
  }
  if (oldInstance.privacyLevel !== newInstance.privacyLevel) {
    lines.push(
      changeLine(
        "Privacy",
        enumLabel(PRIVACY_NAMES, oldInstance.privacyLevel),
        enumLabel(PRIVACY_NAMES, newInstance.privacyLevel)
      )
    );
  }
  return lines;
}
