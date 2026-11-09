import Canvas from "@/lib/canvas";
import { formatCount, pluralise } from "@/lib/format";
import { TimeUnit, formatDuration } from "@/lib/time";
import type { DaySeries, StatsCardKind, StatsSummary, VoiceSummary } from "./stats.types";

export type StatsCardScope = "user" | "server";

/**
 * Everything a card paints: who it is for, where the data comes from, and
 * the windowed summaries plus the 7-day chart series (counts for messages,
 * seconds for voice).
 */
export interface StatsCardData {
  kind: StatsCardKind;
  scope: StatsCardScope;
  name: string;
  avatarUrl: string | null;
  guildName: string;
  messages: StatsSummary;
  voice: VoiceSummary;
  series: DaySeries;
}

const WIDTH = 900;
const HEIGHT = 460;
const ACCENT = "#9b59b6";
const ACCENT_DIM = "rgba(155, 89, 182, 0.35)";

export async function renderStatsCard(data: StatsCardData): Promise<Buffer> {
  const canvas = new Canvas(WIDTH, HEIGHT).background("#1a1626");
  await paintHeader(canvas, data);
  paintWindowRow(canvas, data);
  paintChart(canvas, data.series);
  paintFooter(canvas, data.guildName);
  return canvas.png();
}

async function paintHeader(canvas: Canvas, data: StatsCardData): Promise<void> {
  const size = 96;
  const x = 48;
  const y = 36;
  await canvas.avatar(data.avatarUrl, data.name, x, y, size, ACCENT);
  canvas.text(canvas.fitText(data.name, 560, 34, 700), x + size + 24, y + 42, 34, "#ffffff", 700);
  canvas.text(cardTitle(data.kind, data.scope), x + size + 24, y + 74, 20, ACCENT, 500);
}

function paintWindowRow(canvas: Canvas, data: StatsCardData): void {
  const labels = ["Today", "Last 7d", "Last 30d", "Total"];
  const tiles = tileValues(data);
  const gap = 20;
  const tileWidth = (WIDTH - 96 - gap * 3) / 4;
  const y = 168;
  const height = 104;
  tiles.forEach((tile, index) => {
    const x = 48 + index * (tileWidth + gap);
    canvas.roundedRect(
      x,
      y,
      tileWidth,
      height,
      16,
      index === 3 ? "rgba(155, 89, 182, 0.28)" : "rgba(255, 255, 255, 0.06)"
    );
    canvas.text(labels[index]!, x + 18, y + 30, 16, "rgba(255, 255, 255, 0.6)", 500);
    canvas.text(canvas.fitText(tile.value, tileWidth - 36, 30, 700), x + 18, y + 68, 30, "#ffffff", 700);
    if (tile.sub) {
      canvas.text(
        canvas.fitText(tile.sub, tileWidth - 36, 15, 500),
        x + 18,
        y + 90,
        15,
        "rgba(255, 255, 255, 0.55)",
        500
      );
    }
  });
}

function paintChart(canvas: Canvas, series: DaySeries): void {
  const x = 48;
  const width = WIDTH - 96;
  const baseY = 408;
  const topY = 308;
  const max = Math.max(...series.values, 1);
  const gap = 14;
  const barWidth = (width - gap * 6) / 7;
  series.values.forEach((value, index) => {
    const barX = x + index * (barWidth + gap);
    const barHeight = Math.max(value > 0 ? 6 : 2, ((baseY - topY) * value) / max);
    canvas.roundedRect(barX, baseY - barHeight, barWidth, barHeight, 6, index === 6 ? ACCENT : ACCENT_DIM);
    canvas.centeredText(
      series.dayLabels[index] ?? "",
      barX + barWidth / 2,
      baseY + 24,
      14,
      "rgba(255, 255, 255, 0.55)",
      500
    );
  });
}

function paintFooter(canvas: Canvas, guildName: string): void {
  canvas.text(
    `${canvas.fitText(guildName, 300, 13)} · graph - last 7 days`,
    48,
    HEIGHT - 14,
    13,
    "rgba(255, 255, 255, 0.35)"
  );
}

function cardTitle(kind: StatsCardKind, scope: StatsCardScope): string {
  if (scope === "server") {
    if (kind === "messages") {
      return "Server message stats";
    }
    if (kind === "voice") {
      return "Server voice stats";
    }
    return "Server activity";
  }
  if (kind === "messages") {
    return "Message stats";
  }
  if (kind === "voice") {
    return "Voice stats";
  }
  return "Message and Voice activity";
}

/**
 * Main and sub strings for the four window tiles per kind. Messages show
 * counts, voice shows hours with session counts, overall shows counts with
 * voice hours underneath.
 */
function tileValues(data: StatsCardData): Array<{ value: string; sub?: string }> {
  if (data.kind === "messages") {
    return [
      { value: formatCount(data.messages.today) },
      { value: formatCount(data.messages.last7days) },
      { value: formatCount(data.messages.last30days) },
      { value: formatCount(data.messages.total) },
    ];
  }
  if (data.kind === "voice") {
    return [
      {
        value: formatVoiceDuration(data.voice.today.seconds),
        sub: formatSessions(data.voice.today.sessions),
      },
      {
        value: formatVoiceDuration(data.voice.last7days.seconds),
        sub: formatSessions(data.voice.last7days.sessions),
      },
      {
        value: formatVoiceDuration(data.voice.last30days.seconds),
        sub: formatSessions(data.voice.last30days.sessions),
      },
      {
        value: formatVoiceDuration(data.voice.total.seconds),
        sub: formatSessions(data.voice.total.sessions),
      },
    ];
  }
  return [
    {
      value: formatCount(data.messages.today),
      sub: `${formatVoiceDuration(data.voice.today.seconds)} voice`,
    },
    {
      value: formatCount(data.messages.last7days),
      sub: `${formatVoiceDuration(data.voice.last7days.seconds)} voice`,
    },
    {
      value: formatCount(data.messages.last30days),
      sub: `${formatVoiceDuration(data.voice.last30days.seconds)} voice`,
    },
    {
      value: formatCount(data.messages.total),
      sub: `${formatVoiceDuration(data.voice.total.seconds)} voice`,
    },
  ];
}

/**
 * Format voice seconds compactly for tiles, e.g. `3h, 30m`.
 */
function formatVoiceDuration(seconds: number): string {
  return formatDuration(TimeUnit.toMillis(TimeUnit.Second, Math.max(1, Math.round(seconds))));
}

function formatSessions(sessions: number): string {
  return `${sessions} ${pluralise(sessions, "session")}`;
}
