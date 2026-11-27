import { Lunar, Solar, LunarMonth, LunarYear } from "lunar-typescript";
import {
  CalendarEvent,
  newEvent,
  dateKey,
  parseLocal,
  pad,
  addDays,
} from "./model";
import { chineseNumber, normalizeSpokenYears } from "./numbers";
import { lunarToday } from "./calendar";

const number =
  "(?:\\d{1,2}|初?[一二两三四五六七八九十]{1,3}|廿[一二三四五六七八九]?|卅)";
const monthNumber = "(?:1[0-2]|0?[1-9]|十一|十二|十|[一二两三四五六七八九])";
const datePattern = `(?:(\\d{4})年)?(${monthNumber})月(${number})[日号]?`;
export function birthdayIntent(text: string) {
  return (
    /生日/.test(text) &&
    !/生日(?:聚会|派对|宴|晚会)|(?:买|购买|准备|送).{0,12}(?:礼物|蛋糕)/.test(
      text,
    )
  );
}
export function occasionIntent(text: string) {
  return birthdayIntent(text) || /纪念日/.test(text);
}
function cleanName(s: string) {
  return s
    .replace(
      /(?:请|麻烦|帮我|给我|帮忙|把|将|添加(?:一个|个)?|记录(?:一下)?|记住|记下|记个|记一下|加上|加到日历|记到日历)/g,
      "",
    )
    .replace(new RegExp(datePattern, "g"), "")
    .replace(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g, "")
    .replace(/(?:出生(?:年份)?|生于)(?:是|为|于)?\s*\d{4}年?/g, "")
    .replace(/今天|今日|昨天|明天|今年|去年|明年|\d{4}年|出生/g, "")
    .replace(/^[给是在于\s，,]+|[的在是于过\s，,]+$/g, "")
    .trim();
}
export function parseOccasion(
  text: string,
  now = new Date(),
): { event: CalendarEvent; issues: string[] } | undefined {
  text = normalizeSpokenYears(text);
  if (!occasionIntent(text)) return;
  const e = newEvent(now);
  const issues: string[] = [];
  if ((text.match(/生日|纪念日/g) || []).length > 1)
    issues.push("这里包含多项生日或纪念日，请分别输入，或连接 AI 批量识别");
  if (issues.length) return { event: e, issues };
  const birthday = birthdayIntent(text);
  e.kind = birthday ? "birthday" : "anniversary";
  e.repeat = "yearly";
  e.allDay = true;
  const before = text
    .slice(0, text.indexOf(birthday ? "生日" : "纪念日"))
    .replace(/(?:农历|阴历|公历|阳历)$/, "");
  const person =
    cleanName(before) ||
    /(?:名字|姓名|叫)(?:是|为)?\s*([^，,。；;\s]{1,20})/.exec(text)?.[1] ||
    "";
  if (birthday) {
    e.person = person;
    e.title = person ? `${person}的生日` : "生日";
    if (!person || /^(他|她|谁|一个)$/.test(person))
      issues.push("请补充是谁的生日");
  } else e.title = `${cleanName(before) || "重要"}纪念日`;

  const dates = [
    ...text.matchAll(new RegExp(datePattern, "g")),
    ...text.matchAll(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g),
  ]
    .sort((a, b) => a.index! - b.index!)
    .map((m) => ({
      raw: m[0],
      year: m[1] ? +m[1] : undefined,
      month: chineseNumber(m[2]),
      day: chineseNumber(m[3]),
      born:
        /(?:出生于?|生于)\s*$/.test(text.slice(0, m.index)) ||
        /^\s*(?:出生|生的|生人)/.test(text.slice(m.index! + m[0].length)),
    }));
  const birthYear =
    /(?:出生(?:年份|年)?(?:是|为|于)?|生于)\s*[：:]?\s*(\d{4})年?/.exec(
      text,
    )?.[1] || /(\d{4})年\s*(?:出生|生的|生人)/.exec(text)?.[1];
  const born = dates.find((d) => d.born && d.year);
  if (birthday) e.birthYear = birthYear ? +birthYear : born?.year;
  const lunar = birthday && /农历|阴历/.test(text);
  const direct = lunar
    ? new RegExp(
        `(?:农历|阴历)(?:生日)?(?:是|在|为)?\\s*(?:\\d{4}年)?(闰?)(正|冬|腊|${number})月(${number})[日号]?`,
      ).exec(text)
    : null;
  if (direct) {
    const month =
      direct[2] === "正"
        ? 1
        : direct[2] === "冬"
          ? 11
          : direct[2] === "腊"
            ? 12
            : chineseNumber(direct[2]);
    e.lunar = {
      month,
      day: chineseNumber(direct[3]),
      leap: !!direct[1],
      birthYear: e.birthYear,
      noLeap: "regular",
      shortMonth: "last",
    };
  } else {
    const date = dates.find((d) => !d.born) || dates[0];
    const relative = /(今天|今日|昨天|明天)/.exec(text)?.[1];
    let reference: Date | undefined;
    if (date) {
      let year = date.year;
      if (!year && /今年/.test(text)) year = now.getFullYear();
      if (!year && /去年/.test(text)) year = now.getFullYear() - 1;
      if (!year && /明年/.test(text)) year = now.getFullYear() + 1;
      if (lunar && !year)
        issues.push("请补充那次过农历生日的公历年份，或直接填写农历几月几日");
      else
        reference = parseLocal(
          `${year || now.getFullYear()}-${pad(date.month)}-${pad(date.day)}`,
        );
    } else if (relative)
      reference = addDays(
        now,
        relative === "昨天" ? -1 : relative === "明天" ? 1 : 0,
      );
    if (reference) {
      e.start = dateKey(reference) + "T09:00";
      if (lunar)
        e.lunar = {
          ...lunarToday(reference),
          birthYear: e.birthYear,
          referenceDate: dateKey(reference),
        };
    } else if (!issues.length)
      issues.push(
        birthday
          ? "请补充生日月日；农历生日也可以提供某次过生日当天的公历年月日"
          : "请补充纪念日的月日",
      );
  }
  const advance =
    /提前\s*(\d+|[一二两三四五六七八九十]+)\s*(分钟|小时|天)提醒/.exec(text);
  if (advance) {
    e.reminder = true;
    e.minutesBefore =
      chineseNumber(advance[1]) *
      (advance[2] === "天" ? 1440 : advance[2] === "小时" ? 60 : 1);
  }
  if (/不用提醒|不提醒|关闭提醒/.test(text)) e.reminder = false;
  else if (/提醒我|需要提醒|开启提醒/.test(text)) e.reminder = true;
  return { event: e, issues };
}

// Only clear birthday record titles are migrated; parties and gifts remain tasks.
export function normalizeOccasion(e: CalendarEvent): CalendarEvent {
  const clearBirthdayTitle =
    !/(?:陪|参加|庆祝|举办|去|过生日|送)/.test(e.title) &&
    /^(?:[^，,。；;\s]{1,20}的|[^，,。；;\s]{0,8})生日(?:提醒)?$/.test(e.title);
  const birthday =
    e.kind === "birthday" ||
    (e.kind === "event" && birthdayIntent(e.title) && clearBirthdayTitle);
  const anniversary = e.kind === "anniversary";
  if (!birthday && !anniversary) return e;
  let lunar = e.lunar;
  if (lunar?.referenceDate) {
    const converted = lunarToday(parseLocal(lunar.referenceDate));
    lunar = {
      ...lunar,
      month: converted.month,
      day: converted.day,
      leap: converted.leap,
    };
  }
  return {
    ...e,
    kind: birthday ? "birthday" : "anniversary",
    repeat: "yearly",
    allDay: true,
    birthYear: e.birthYear ?? lunar?.birthYear,
    lunar,
    person: birthday
      ? e.person || e.title.replace(/的?生日(?:提醒)?$/, "")
      : e.person,
  };
}
export function specialDateLabel(e: CalendarEvent) {
  if (e.lunar)
    return `农历${e.lunar.leap ? "闰" : ""}${e.lunar.month}月${e.lunar.day}日 · 每年`;
  const d = parseLocal(e.start);
  return `公历${d.getMonth() + 1}月${d.getDate()}日 · 每年`;
}
export function nextOccasion(
  e: CalendarEvent,
  from = new Date(),
): Date | undefined {
  const earliest =
    dateKey(from) > e.start.slice(0, 10) ? dateKey(from) : e.start.slice(0, 10);
  if (e.lunar) {
    const firstYear = Solar.fromDate(parseLocal(earliest)).getLunar().getYear();
    for (let year = firstYear; year < firstYear + 60; year++) {
      let month = e.lunar.month;
      if (e.lunar.leap) {
        if (LunarYear.fromYear(year).getLeapMonth() === month) month = -month;
        else if (e.lunar.noLeap === "skip") continue;
      }
      const max = LunarMonth.fromYm(year, month)?.getDayCount();
      if (!max || (e.lunar.day > max && e.lunar.shortMonth === "skip"))
        continue;
      const solar = Lunar.fromYmd(
        year,
        month,
        Math.min(e.lunar.day, max),
      ).getSolar();
      const date = new Date(
        solar.getYear(),
        solar.getMonth() - 1,
        solar.getDay(),
      );
      if (dateKey(date) >= earliest) return date;
    }
  } else {
    const base = parseLocal(e.start);
    for (
      let year = +earliest.slice(0, 4);
      year < +earliest.slice(0, 4) + 3;
      year++
    ) {
      const date = new Date(
        year,
        base.getMonth(),
        Math.min(
          base.getDate(),
          new Date(year, base.getMonth() + 1, 0).getDate(),
        ),
      );
      if (dateKey(date) >= earliest) return date;
    }
  }
}
export function matchesEventQuery(e: CalendarEvent, query: string) {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[的\s，,。？！?!]/g, "");
  const q = normalize(query)
    .replace(/^(?:搜索|查找|查询|查看|找一下|找)/, "")
    .replace(
      /(?:是什么时候|什么时候|是哪一天|是哪天|几月几号|几月几日|哪天|日期)$/,
      "",
    );
  const kind =
    e.kind === "birthday" ? "生日" : e.kind === "anniversary" ? "纪念日" : "";
  return normalize(
    `${e.title}${e.person || ""}${kind}${e.location}${e.notes}`,
  ).includes(q);
}
