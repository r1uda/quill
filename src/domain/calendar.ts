import { Solar, LunarYear, LunarMonth } from "lunar-typescript";
import { CalendarEvent, addDays, dateKey, parseLocal, dateTime } from "./model";
export const weekNames = ["日", "一", "二", "三", "四", "五", "六"];
export function lunarLabel(d: Date) {
  const lunar = Solar.fromDate(d).getLunar();
  return `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
}
export function lunarToday(d = new Date()) {
  const l = Solar.fromDate(d).getLunar();
  return {
    month: Math.abs(l.getMonth()),
    day: l.getDay(),
    leap: l.getMonth() < 0,
    noLeap: "regular" as const,
    shortMonth: "last" as const,
  };
}
export function occursOn(e: CalendarEvent, day: Date): boolean {
  const start = parseLocal(e.start);
  if (dateKey(day) < dateKey(start)) return false;
  if (e.kind === "birthday" && e.lunar) {
    const l = Solar.fromDate(day).getLunar();
    let month = e.lunar.leap ? -e.lunar.month : e.lunar.month;
    if (
      e.lunar.leap &&
      LunarYear.fromYear(l.getYear()).getLeapMonth() !== e.lunar.month
    ) {
      if (e.lunar.noLeap === "skip") return false;
      month = e.lunar.month;
    }
    if (l.getMonth() !== month) return false;
    const monthDays =
      LunarMonth.fromYm(l.getYear(), month)?.getDayCount() ?? 30;
    return (
      l.getDay() ===
      (e.lunar.day > monthDays && e.lunar.shortMonth === "last"
        ? monthDays
        : e.lunar.day)
    );
  }
  if (e.repeat === "daily") return true;
  if (e.repeat === "weekly") return start.getDay() === day.getDay();
  if (e.repeat === "yearly") {
    const finalDay = new Date(
      day.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    return (
      day.getMonth() === start.getMonth() &&
      day.getDate() === Math.min(start.getDate(), finalDay)
    );
  }
  // Multi-day events remain visible on each covered date.
  return (
    dateKey(day) >= dateKey(start) &&
    dateKey(day) <= (e.end?.slice(0, 10) || dateKey(start))
  );
}
export function occurrenceTime(e: CalendarEvent, day: Date): Date {
  const start = parseLocal(e.start);
  const d = new Date(day);
  d.setHours(start.getHours(), start.getMinutes(), 0, 0);
  return d;
}
export function onDay(events: CalendarEvent[], day: Date) {
  return events
    .filter((e) => occursOn(e, day))
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) ||
        a.start.slice(11).localeCompare(b.start.slice(11)),
    );
}
export function monthCells(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const count =
    Math.ceil(
      (offset +
        new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()) /
        7,
    ) * 7;
  return Array.from({ length: count }, (_, i) => addDays(first, i - offset));
}
export function upcoming(
  events: CalendarEvent[],
  from = new Date(),
  days = 366,
) {
  const rows: { event: CalendarEvent; date: Date; at: string }[] = [];
  for (let n = 0; n < days; n++) {
    const d = addDays(from, n);
    for (const e of onDay(events, d))
      rows.push({ event: e, date: d, at: dateTime(occurrenceTime(e, d)) });
  }
  return rows;
}
export function describeDate(s: string) {
  const d = parseLocal(s);
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekNames[d.getDay()]}`;
}
