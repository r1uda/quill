import {
  CalendarEvent,
  newEvent,
  dateTime,
  dateKey,
  addDays,
  pad,
  parseLocal,
} from "./model";
import { lunarToday } from "./calendar";
import { chineseNumber, normalizeSpokenYears, normalizeSpokenDates } from "./numbers";
export { chineseNumber } from "./numbers";
import { parseOccasion } from "./occasions";
export function parseSentence(
  text: string,
  now = new Date(),
): { event: CalendarEvent; issues: string[] } {
  const raw = normalizeSpokenDates(normalizeSpokenYears(text.trim())).replace(/[，,]/g, " ");
  if (!raw) throw new Error("先写下一件事吧");
  const e = newEvent(now);
  const issues: string[] = [];
  let d = new Date(now);
  let hasDate = false;
  let title = raw;
  const special = parseOccasion(raw, now);
  if (special) return special;
  const explicit = /(?:(\d{4})[年\-/])?(\d{1,2})[月\-/](\d{1,2})[日号]?/.exec(raw);
  const rel = /(大后天|后天|明天|今天|今日)/.exec(raw);
  const weekday =
    /(下下周|下周|本周|这周|每周|周|星期)([一二三四五六日天])/.exec(raw);
  if (explicit) {
    const s = `${explicit[1] || now.getFullYear()}-${pad(+explicit[2])}-${pad(+explicit[3])}`;
    d = parseLocal(s);
    hasDate = true;
    title = title.replace(explicit[0], "");
  } else if (rel) {
    d = addDays(
      now,
      { 今天: 0, 今日: 0, 明天: 1, 后天: 2, 大后天: 3 }[rel[1]]!,
    );
    hasDate = true;
    title = title.replace(rel[0], "");
  } else if (weekday) {
    const index = "一二三四五六日".indexOf(
      weekday[2] === "天" ? "日" : weekday[2],
    );
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    const shift = weekday[1] === "下下周" ? 14 : weekday[1] === "下周" ? 7 : 0;
    d = addDays(monday, index + shift);
    if (
      !shift &&
      dateKey(d) < dateKey(now) &&
      ["周", "星期"].includes(weekday[1])
    )
      d = addDays(d, 7);
    hasDate = true;
    title = title.replace(weekday[0], "");
  }
  const clock =
    /(凌晨|早上|上午|中午|下午|晚上|傍晚)?\s*([零〇一二两三四五六七八九十\d]{1,3})(?:[:：点时])(?:([零一二三四五六七八九十\d]{1,3})分?|(半|一刻|三刻))?/.exec(
      raw,
    );
  let hours = 9,
    minutes = 0;
  if (clock) {
    hours = chineseNumber(clock[2]);
    minutes = clock[3]
      ? chineseNumber(clock[3])
      : clock[4] === "半"
        ? 30
        : clock[4] === "一刻"
          ? 15
          : clock[4] === "三刻"
            ? 45
            : 0;
    if (["下午", "晚上", "傍晚"].includes(clock[1]) && hours < 12) hours += 12;
    if (clock[1] === "中午" && hours < 11) hours += 12;
    if (clock[1] === "凌晨" && hours === 12) hours = 0;
    if (
      !clock[1] &&
      hours > 0 &&
      hours < 7 &&
      !clock[0].includes(":") &&
      !clock[0].includes("：")
    )
      issues.push("请确认是凌晨还是下午，可以补上“下午”等字样");
    if (
      hours > 23 ||
      minutes > 59 ||
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes)
    )
      throw new Error("没有读懂这个时间，请改成“下午三点”或“15:00”");
    title = title.replace(clock[0], "");
  } else {
    e.allDay = true;
  }
  if (/每天/.test(raw)) hasDate = true;
  if (!hasDate) issues.push("请补充哪一天，例如“明天”或“10月29日”");
  if (/每周/.test(raw)) e.repeat = "weekly";
  else if (/每天/.test(raw)) e.repeat = "daily";
  else if (/每年/.test(raw)) e.repeat = "yearly";
  const advance =
    /提前\s*(\d+|[一二两三四五六七八九十]+)\s*(分钟|小时|天)提醒/.exec(raw);
  if (advance) {
    e.reminder = true;
    e.minutesBefore =
      chineseNumber(advance[1]) *
      (advance[2] === "天" ? 1440 : advance[2] === "小时" ? 60 : 1);
    title = title.replace(advance[0], "");
  }
  if (/不(?:用)?提醒|关闭提醒/.test(raw)) {
    e.reminder = false;
    title = title.replace(/不(?:用)?提醒|关闭提醒/g, "");
  }
  title = title
    .replace(
      /(?:提醒我|帮我|帮忙|记一下|记录一下|添加|记上|每周|每天|每年)/g,
      "",
    )
    .replace(/^[\s，,。；;]+|[\s，,。；;]+$/g, "");
  if (!title) issues.push("请补充要做什么事");
  e.title = title;
  e.start = `${dateKey(d)}T${pad(hours)}:${pad(minutes)}`;
  return { event: e, issues };
}
