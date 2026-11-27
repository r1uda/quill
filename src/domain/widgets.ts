import { CalendarEvent, Settings, addDays, dateKey, parseLocal } from "./model";
import { monthCells, onDay } from "./calendar";
import { nextOccasion } from "./occasions";

export function widgetSnapshot(events: CalendarEvent[], settings: Settings, now = new Date()) {
  const first = monthCells(now)[0];
  const days: Record<string, { id: string; title: string; time: string; location: string }[]> = {};
  // Enough native-readable data for month boundaries and background rollover.
  // Never copy API credentials, notes, or user photos to the widget cache.
  for (let n = 0; n < 100; n++) {
    const day = addDays(first, n);
    days[dateKey(day)] = onDay(events, day).map(e => ({
      id: e.id, title: e.title, time: e.allDay ? "全天" : e.start.slice(11, 16), location: e.location,
    }));
  }
  const occasions = events.filter(e => e.kind !== "event").map(e => {
    const next = nextOccasion(e, now);
    return next ? { id: e.id, title: e.title, date: dateKey(next) } : undefined;
  }).filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => a.date.localeCompare(b.date));
  return { version: 1, generatedAt: now.toISOString(), accent: settings.appearance.accent, days, occasions };
}
