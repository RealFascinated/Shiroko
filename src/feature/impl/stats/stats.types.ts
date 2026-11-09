/**
 * Which activity a card shows. `messages` charts message counts, `voice`
 * charts voice hours, `overall` shows message counts with voice hours
 * underneath each tile.
 */
export type StatsCardKind = "messages" | "voice" | "overall";

/**
 * Counts for one display window set: today, last 7 days, last 30 days, total.
 */
export interface StatsSummary {
  today: number;
  last7days: number;
  last30days: number;
  total: number;
}

/**
 * Voice activity in one window: closed sessions plus any live session.
 */
export interface VoiceWindow {
  sessions: number;
  seconds: number;
}

export interface VoiceSummary {
  today: VoiceWindow;
  last7days: VoiceWindow;
  last30days: VoiceWindow;
  total: VoiceWindow;
}

/**
 * Per-day values for the chart, oldest first, with short weekday names drawn
 * under each bar. Both derive from the same UTC days as the query window.
 */
export interface DaySeries {
  values: number[];
  dayLabels: string[];
}

export interface CardStats {
  messages: StatsSummary;
  voice: VoiceSummary;
  series: DaySeries;
}
