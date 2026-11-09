import Canvas, { CardColors } from "@/lib/canvas";
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
const HEIGHT = 440;
const ACCENT = "#9b59b6";
const MARGIN = 40;
const RIGHT = WIDTH - MARGIN;
const LABELS = ["Today", "Last 7d", "Last 30d", "Total"];

export async function renderStatsCard(data: StatsCardData): Promise<Buffer> {
  const canvas = new Canvas(WIDTH, HEIGHT).card();
  await paintHeader(canvas, data);
  canvas.line(MARGIN, 124.5, RIGHT, 124.5, CardColors.rule);
  paintWindowRow(canvas, data);
  canvas.line(MARGIN, 244.5, RIGHT, 244.5, CardColors.rule);
  paintChart(canvas, data);
  return canvas.png();
}

async function paintHeader(canvas: Canvas, data: StatsCardData): Promise<void> {
  const size = 56;
  canvas.avatar(await Canvas.loadImage(data.avatarUrl), data.name, MARGIN, 36, size);
  const x = MARGIN + size + 18;
  const maxWidth = RIGHT - x;
  canvas.text(canvas.fitText(data.name, maxWidth, 24, 700), x, 62, 24, CardColors.text, 700);
  canvas.text(
    canvas.fitText(`${cardTitle(data.kind, data.scope)} · ${data.guildName}`, maxWidth, 15, 500),
    x,
    86,
    15,
    CardColors.muted,
    500
  );
}

/**
 * The four windows as columns split by hairlines rather than boxed tiles,
 * with the running total set in the accent colour.
 */
function paintWindowRow(canvas: Canvas, data: StatsCardData): void {
  const tiles = tileValues(data);
  const columnWidth = (RIGHT - MARGIN) / 4;
  tiles.forEach((tile, index) => {
    const x = MARGIN + index * columnWidth;
    const textX = index === 0 ? x : x + 24;
    if (index > 0) {
      canvas.line(x + 0.5, 148, x + 0.5, 222, CardColors.rule);
    }
    canvas.label(LABELS[index]!, textX, 162);
    canvas.text(
      canvas.fitText(tile.value, columnWidth - 40, 30, 700),
      textX,
      198,
      30,
      index === tiles.length - 1 ? ACCENT : CardColors.text,
      700
    );
    if (tile.sub) {
      canvas.text(canvas.fitText(tile.sub, columnWidth - 40, 14, 500), textX, 220, 14, CardColors.muted, 500);
    }
  });
}

function paintChart(canvas: Canvas, data: StatsCardData): void {
  const { series } = data;
  canvas.label("Last 7 days", MARGIN, 280);
  const width = RIGHT - MARGIN;
  const baseY = 382;
  const topY = 312;
  const max = Math.max(...series.values, 1);
  const gap = 24;
  const barWidth = (width - gap * 6) / 7;
  series.values.forEach((value, index) => {
    const barX = MARGIN + index * (barWidth + gap);
    const centerX = barX + barWidth / 2;
    const barHeight = Math.max(value > 0 ? 4 : 2, ((baseY - topY) * value) / max);
    const today = index === series.values.length - 1;
    canvas.roundedRect(barX, baseY - barHeight, barWidth, barHeight, 3, today ? ACCENT : CardColors.inactive);
    canvas.centeredText(
      canvas.fitText(formatBarValue(data.kind, value), barWidth + gap - 4, 13, 500),
      centerX,
      baseY - barHeight - 8,
      13,
      today ? CardColors.text : CardColors.muted,
      500
    );
    canvas.centeredText(series.dayLabels[index] ?? "", centerX, baseY + 24, 12, CardColors.faint, 600);
  });
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

function formatBarValue(kind: StatsCardKind, value: number): string {
  if (value === 0) {
    return "0";
  }
  return kind === "voice" ? formatVoiceDuration(value) : formatCount(value);
}

function formatSessions(sessions: number): string {
  return `${sessions} ${pluralise(sessions, "session")}`;
}
