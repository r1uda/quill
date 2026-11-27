export type EventKind = "event" | "birthday" | "anniversary";
export type Repeat = "none" | "daily" | "weekly" | "yearly";
export interface LunarBirthday {
  month: number;
  day: number;
  leap: boolean;
  birthYear?: number;
  referenceDate?: string;
  noLeap: "regular" | "skip";
  shortMonth: "last" | "skip";
}
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  kind: EventKind;
  repeat: Repeat;
  lunar?: LunarBirthday;
  person?: string;
  birthYear?: number;
  location: string;
  notes: string;
  reminder: boolean;
  reminderMode?: "notification" | "alarm";
  minutesBefore: number;
  createdAt: string;
}
export interface Settings {
  name: string;
  aliases: string;
  onboarded: boolean;
  ai: {
    enabled: boolean;
    url: string;
    model: string;
    provider?: string;
    protocol?: "chat" | "anthropic";
    models?: string[];
  };
  appearance: {
    accent: "blue" | "purple";
    background: string;
    blur: number;
    brightness: number;
    opacity: number;
  };
  reminders: {
    defaultOn: boolean;
    minutes: number;
    sound: boolean;
    mode?: "notification" | "alarm";
  };
}
export const defaultSettings: Settings = {
  name: "",
  aliases: "",
  onboarded: false,
  ai: { enabled: false, url: "", model: "" },
  appearance: {
    accent: "blue",
    background: "",
    blur: 12,
    brightness: 80,
    opacity: 94,
  },
  reminders: { defaultOn: false, minutes: 10, sound: true },
};
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
export const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateTime = (d: Date) =>
  `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const addDays = (d: Date, n: number) => {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
};
export const parseLocal = (s: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  if (!m) throw new Error("请使用 YYYY-MM-DD 和 HH:mm 格式");
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  if (
    d.getFullYear() !== +m[1] ||
    d.getMonth() + 1 !== +m[2] ||
    d.getDate() !== +m[3] ||
    d.getHours() !== +(m[4] || 0) ||
    d.getMinutes() !== +(m[5] || 0)
  )
    throw new Error("日期或时间不存在，请检查");
  return d;
};
export function newEvent(day = new Date()): CalendarEvent {
  const start = new Date(day);
  start.setHours(9, 0, 0, 0);
  return {
    id: uid(),
    title: "",
    start: dateTime(start),
    allDay: false,
    kind: "event",
    repeat: "none",
    location: "",
    notes: "",
    reminder: false,
    minutesBefore: 10,
    createdAt: new Date().toISOString(),
  };
}
export function validateEvent(value: unknown): CalendarEvent {
  if (!value || typeof value !== "object") throw new Error("日程格式不正确");
  const x = value as CalendarEvent;
  if (typeof x.title !== "string" || !x.title.trim() || x.title.length > 300)
    throw new Error("请填写日程标题（最多300字）");
  const start = parseLocal(x.start);
  if (
    x.reminderMode !== undefined &&
    !["notification", "alarm"].includes(x.reminderMode)
  )
    throw new Error("提醒方式不正确");
  if (x.end && parseLocal(x.end) < start)
    throw new Error("结束时间不能早于开始时间");
  if (
    !["event", "birthday", "anniversary"].includes(x.kind) ||
    !["none", "daily", "weekly", "yearly"].includes(x.repeat)
  )
    throw new Error("日程类型或重复方式不正确");
  if (
    x.lunar &&
    (x.kind !== "birthday" ||
      !Number.isInteger(x.lunar.month) ||
      x.lunar.month < 1 ||
      x.lunar.month > 12 ||
      !Number.isInteger(x.lunar.day) ||
      x.lunar.day < 1 ||
      x.lunar.day > 30 ||
      !["regular", "skip"].includes(x.lunar.noLeap) ||
      !["last", "skip"].includes(x.lunar.shortMonth))
  )
    throw new Error("请检查农历生日日期与规则");
  if (
    x.lunar?.birthYear !== undefined &&
    (!Number.isInteger(x.lunar.birthYear) ||
      x.lunar.birthYear < 1 ||
      x.lunar.birthYear > new Date().getFullYear())
  )
    throw new Error("请检查出生年份，不能填写未来年份");
  if (
    x.birthYear !== undefined &&
    (!Number.isInteger(x.birthYear) ||
      x.birthYear < 1 ||
      x.birthYear > new Date().getFullYear())
  )
    throw new Error("请检查出生年份，不能填写未来年份");
  if (x.lunar?.referenceDate !== undefined) parseLocal(x.lunar.referenceDate);
  if (
    !Number.isFinite(x.minutesBefore) ||
    x.minutesBefore < 0 ||
    x.minutesBefore > 525600
  )
    throw new Error("提前提醒时间不正确");
  return {
    ...newEvent(start),
    ...x,
    id: typeof x.id === "string" && x.id.length < 150 ? x.id : uid(),
    title: x.title.trim(),
    location: String(x.location || "").slice(0, 500),
    notes: String(x.notes || "").slice(0, 10000),
    reminder: !!x.reminder,
    allDay: !!x.allDay,
  };
}
