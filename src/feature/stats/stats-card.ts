import Canvas from "../../lib/canvas";
import type { DaySeries, StatsSummary, VoiceSummary } from "./stats.service";

/**
 * Which activity a card shows. `messages` charts message counts, `voice`
 * charts voice hours, `overall` shows message counts with voice hours
 * underneath each tile.
 */
export type StatsCardKind = "messages" | "voice" | "overall";

/**
 * Everything a card paints: who it is for, where the data comes from, and
 * the windowed summaries plus the 7-day chart series (counts for messages,
 * seconds for voice).
 */
export interface StatsCardData {
  kind: StatsCardKind;
  name: string;
  avatarUrl: string;
  guildName: string;
  messages: StatsSummary;
  voice: VoiceSummary;
  series: DaySeries;
}

const WIDTH = 900;
const HEIGHT = 460;
const ACCENT = "#9b59b6";
const ACCENT_DIM = "rgba(155, 89, 182, 0.35)";

/**
 * Render a stats card for `data` as a PNG buffer.
 */
export async function renderStatsCard(data: StatsCardData): Promise<Buffer> {
  const canvas = new Canvas(WIDTH, HEIGHT).background("#1a1626");
  await paintHeader(canvas, data);
  paintWindowRow(canvas, data);
  paintChart(canvas, data.series);
  paintFooter(canvas, data.guildName);
  return canvas.png();
}

/**
 * Draw the avatar, display name, and card title.
 */
async function paintHeader(canvas: Canvas, data: StatsCardData): Promise<void> {
  const size = 96;
  const x = 48;
  const y = 36;
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const avatar = await Canvas.loadImage(data.avatarUrl);
  if (avatar) {
    canvas.circleImage(avatar, centerX, centerY, size / 2);
  } else {
    canvas
      .roundedRect(x, y, size, size, size / 2, "#2a2340")
      .centeredText(data.name.slice(0, 1).toUpperCase(), centerX, centerY + 16, 44, "#ffffff", 700);
  }
  canvas.circleOutline(centerX, centerY, size / 2 + 1, ACCENT, 3);
  canvas.text(canvas.fitText(data.name, 560, 34, 700), x + size + 24, y + 42, 34, "#ffffff", 700);
  canvas.text(cardTitle(data.kind), x + size + 24, y + 74, 20, ACCENT, 500);
}

/**
 * Draw the four window tiles: today, last 7 days, last 30 days, total.
 */
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

/**
 * Draw the 7-day bar chart with weekday labels.
 */
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

/**
 * Draw the muted data-source line.
 */
function paintFooter(canvas: Canvas, guildName: string): void {
  canvas.text(
    `${canvas.fitText(guildName, 300, 13)} · graph - last 7 days`,
    48,
    HEIGHT - 14,
    13,
    "rgba(255, 255, 255, 0.35)"
  );
}

/**
 * Title for the card header per kind.
 */
function cardTitle(kind: StatsCardKind): string {
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
      { value: formatHours(data.voice.today.seconds), sub: formatSessions(data.voice.today.sessions) },
      {
        value: formatHours(data.voice.last7days.seconds),
        sub: formatSessions(data.voice.last7days.sessions),
      },
      {
        value: formatHours(data.voice.last30days.seconds),
        sub: formatSessions(data.voice.last30days.sessions),
      },
      { value: formatHours(data.voice.total.seconds), sub: formatSessions(data.voice.total.sessions) },
    ];
  }
  return [
    { value: formatCount(data.messages.today), sub: `${formatHours(data.voice.today.seconds)} voice` },
    {
      value: formatCount(data.messages.last7days),
      sub: `${formatHours(data.voice.last7days.seconds)} voice`,
    },
    {
      value: formatCount(data.messages.last30days),
      sub: `${formatHours(data.voice.last30days.seconds)} voice`,
    },
    { value: formatCount(data.messages.total), sub: `${formatHours(data.voice.total.seconds)} voice` },
  ];
}

/**
 * Format a message count with thousands separators.
 */
function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/**
 * Format voice seconds as compact hours, e.g. `3.5h` or `12m`.
 */
function formatHours(seconds: number): string {
  if (seconds < 3600) {
    return `${Math.max(1, Math.round(seconds / 60))}m`;
  }
  const hours = seconds / 3600;
  return `${hours >= 100 ? Math.round(hours) : Math.round(hours * 10) / 10}h`;
}

/**
 * Format a session count as `1 session` or `4 sessions`.
 */
function formatSessions(sessions: number): string {
  return `${sessions} session${sessions === 1 ? "" : "s"}`;
}
