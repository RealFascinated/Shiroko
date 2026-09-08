import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
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
const FONT = "Geist";
const ACCENT = "#9b59b6";
const ACCENT_DIM = "rgba(155, 89, 182, 0.35)";

let fontsRegistered = false;

/**
 * Register the bundled Geist font once. Production images ship no system
 * fonts, so canvas text silently renders nothing without this.
 */
function ensureFonts(): void {
  if (fontsRegistered) {
    return;
  }
  GlobalFonts.registerFromPath("assets/fonts/Geist.ttf", "Geist");
  fontsRegistered = true;
}

/**
 * Render a stats card for `data` as a PNG buffer.
 */
export async function renderStatsCard(data: StatsCardData): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  paintBackground(ctx);
  await paintHeader(ctx, data);
  paintWindowRow(ctx, data);
  paintChart(ctx, data.series);
  paintFooter(ctx, data.guildName);
  return canvas.encode("png");
}

/**
 * Fill the card background.
 */
function paintBackground(ctx: SKRSContext2D): void {
  ctx.fillStyle = "#1a1626";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/**
 * Draw the avatar, display name, and card title.
 */
async function paintHeader(ctx: SKRSContext2D, data: StatsCardData): Promise<void> {
  const size = 96;
  const x = 48;
  const y = 36;
  const avatar = await loadAvatar(data.avatarUrl);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, x, y, size, size);
  } else {
    ctx.fillStyle = "#2a2340";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 44px "${FONT}"`;
    ctx.fillText(data.name.slice(0, 1).toUpperCase(), x + size / 2 - 14, y + size / 2 + 16);
  }
  ctx.restore();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 34px "${FONT}"`;
  ctx.fillText(fitText(ctx, data.name, 560), x + size + 24, y + 42);
  ctx.fillStyle = ACCENT;
  ctx.font = `500 20px "${FONT}"`;
  ctx.fillText(cardTitle(data.kind), x + size + 24, y + 74);
}

/**
 * Draw the four window tiles: today, last 7 days, last 30 days, total.
 */
function paintWindowRow(ctx: SKRSContext2D, data: StatsCardData): void {
  const labels = ["Today", "Last 7d", "Last 30d", "Total"];
  const tiles = tileValues(data);
  const gap = 20;
  const tileWidth = (WIDTH - 96 - gap * 3) / 4;
  const y = 168;
  const height = 104;
  tiles.forEach((tile, index) => {
    const x = 48 + index * (tileWidth + gap);
    ctx.fillStyle = index === 3 ? "rgba(155, 89, 182, 0.28)" : "rgba(255, 255, 255, 0.06)";
    roundRectPath(ctx, x, y, tileWidth, height, 16);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `500 16px "${FONT}"`;
    ctx.fillText(labels[index]!, x + 18, y + 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 30px "${FONT}"`;
    ctx.fillText(fitText(ctx, tile.value, tileWidth - 36), x + 18, y + 68);
    if (tile.sub) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.font = `500 15px "${FONT}"`;
      ctx.fillText(fitText(ctx, tile.sub, tileWidth - 36), x + 18, y + 90);
    }
  });
}

function paintChart(ctx: SKRSContext2D, series: DaySeries): void {
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
    ctx.fillStyle = index === 6 ? ACCENT : ACCENT_DIM;
    roundRectPath(ctx, barX, baseY - barHeight, barWidth, barHeight, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = `500 14px "${FONT}"`;
    const label = series.dayLabels[index] ?? "";
    ctx.fillText(label, barX + barWidth / 2 - ctx.measureText(label).width / 2, baseY + 24);
  });
}
/**
 * Draw the muted data-source line.
 */
function paintFooter(ctx: SKRSContext2D, guildName: string): void {
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = `400 13px "${FONT}"`;
  ctx.fillText(`${fitText(ctx, guildName, 300)} · last 7 days`, 48, HEIGHT - 14);
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
/**
 * Shorten `text` with an ellipsis until it fits `maxWidth`.
 */
function fitText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let shortened = text;
  while (shortened.length > 1 && ctx.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}…`;
}

/**
 * Trace a rounded rectangle path without painting it.
 */
function roundRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Fetch the avatar URL as a canvas image, or `null` when unavailable.
 */
async function loadAvatar(url: string): Promise<Image | null> {
  try {
    return (await loadImage(url)) as unknown as Image;
  } catch {
    return null;
  }
}
