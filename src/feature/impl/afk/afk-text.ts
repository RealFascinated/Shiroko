import { formatDuration } from "@/lib/time";
import { escapeMarkdown } from "discord.js";
import type { AfkState } from "./afk.service";

export const MAX_REASON_LENGTH = 100;
export const MAX_NOTICED = 3;

export function cleanReason(reason: string | null): string | null {
  return reason?.trim().slice(0, MAX_REASON_LENGTH) || null;
}

export function afkNotice(entries: { name: string; state: AfkState }[]): string {
  return entries
    .slice(0, MAX_NOTICED)
    .map(({ name, state }) => {
      const reason = state.reason ? `: **${state.reason}**` : "";
      return `💤 **${escapeMarkdown(name)}** is AFK${reason} · since <t:${Math.floor(state.since.getTime() / 1000)}:R>`;
    })
    .join("\n");
}

export function welcomeBack(name: string, state: AfkState, now: number = Date.now()): string {
  return `👋 Welcome back **${escapeMarkdown(name)}**. You were away for ${formatDuration(now - state.since.getTime())}.`;
}
