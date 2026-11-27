import { test } from "node:test";
import assert from "node:assert/strict";
import { Lunar } from "lunar-typescript";
import * as XLSX from "xlsx";
import {
  dateKey,
  newEvent,
  parseLocal,
  validateEvent,
  defaultSettings,
} from "../src/domain/model";
import { parseSentence } from "../src/domain/parse";
import { occursOn, lunarToday, monthCells } from "../src/domain/calendar";
import {
  readWorkbook,
  detectMapping,
  parseTable,
  dedupe,
  matchesName,
  parseRecognizedText,
} from "../src/domain/imports";
import { validateBackup } from "../src/domain/backup";
const now = new Date(2026, 9, 28, 10, 0);
test("reject impossible dates and clock times", () => {
  assert.throws(() => parseLocal("2026-02-30"));
  assert.throws(() => parseLocal("2026-10-28T24:00"));
  assert.equal(dateKey(parseLocal("2028-02-29")), "2028-02-29");
});
test("Chinese sentence resolves tomorrow afternoon and title", () => {
  const r = parseSentence("明天下午三点开会", now);
  assert.deepEqual(r.issues, []);
  assert.equal(r.event.start, "2026-10-29T15:00");
  assert.equal(r.event.title, "开会");
});
test("speech month/day numerals and 号 are parsed without leaving date words in the title", () => {
  const a = parseSentence("十一月三号下午两点四十五分小组讨论", now);
  assert.deepEqual(a.issues, []);
  assert.equal(a.event.start, "2026-11-03T14:45");
  assert.equal(a.event.title, "小组讨论");
  const b = parseSentence("十二月二十五号晚上七点和小林吃饭", now);
  assert.equal(b.event.start, "2026-12-25T19:00");
  assert.equal(b.event.title, "和小林吃饭");
  const c = parseSentence("11月3号下午两点讨论", now);
  assert.equal(c.event.title, "讨论");
});
test("Chinese half hour and explicit reminder", () => {
  const r = parseSentence("今天晚上八点半阅读 提前十分钟提醒", now);
  assert.equal(r.event.start, "2026-10-28T20:30");
  assert.equal(r.event.reminder, true);
  assert.equal(r.event.minutesBefore, 10);
  assert.equal(r.event.title, "阅读");
});
test("missing dates are questions, not silently scheduled", () => {
  assert.ok(parseSentence("下午三点开会", now).issues.length);
});
test("ambiguous three oclock is not automatically saved", () => {
  assert.ok(parseSentence("明天三点开会", now).issues.length);
});
test("explicit date without clock is all day", () => {
  const r = parseSentence("10月30日提交报告", now);
  assert.equal(r.event.allDay, true);
  assert.equal(r.event.title, "提交报告");
  assert.equal(r.event.start.slice(0, 10), "2026-10-30");
});
test("next week weekday works across months", () => {
  const r = parseSentence("下周三下午两点讨论", now);
  assert.equal(r.event.start, "2026-11-04T14:00");
  assert.deepEqual(r.issues, []);
});
test("daily and weekly expressions preserve repeat", () => {
  assert.equal(parseSentence("每天晚上八点阅读", now).event.repeat, "daily");
  const w = parseSentence("每周三下午三点讨论", now);
  assert.equal(w.event.repeat, "weekly");
  assert.equal(w.event.title, "讨论");
});
test("lunar birthday today does not depend on birth year", () => {
  const r = parseSentence("妈妈今天过农历生日，1975年出生", now);
  assert.deepEqual(r.issues, []);
  assert.equal(r.event.lunar?.month, 9);
  assert.equal(r.event.lunar?.day, 19);
  assert.equal(r.event.lunar?.birthYear, 1975);
  assert.equal(r.event.title, "妈妈的生日");
});
test("lunar annual recurrence follows lunar date instead of Gregorian day", () => {
  const e = {
    ...newEvent(now),
    kind: "birthday" as const,
    title: "生日",
    allDay: true,
    repeat: "yearly" as const,
    lunar: lunarToday(now),
  };
  const next = Lunar.fromYmd(2027, 9, 19).getSolar();
  const d = new Date(next.getYear(), next.getMonth() - 1, next.getDay());
  assert.equal(occursOn(e, d), true);
  assert.notEqual(dateKey(d).slice(5), "10-28");
  assert.equal(occursOn(e, new Date(2027, 9, 28)), false);
});
test("leap-month fallback is explicit and skip is respected", () => {
  const e = {
    ...newEvent(new Date(2025, 0, 1)),
    title: "生日",
    kind: "birthday" as const,
    lunar: {
      month: 6,
      day: 3,
      leap: true,
      noLeap: "regular" as const,
      shortMonth: "last" as const,
    },
  };
  const solar = Lunar.fromYmd(2026, 6, 3).getSolar();
  const d = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
  assert.equal(occursOn(e, d), true);
  assert.equal(
    occursOn({ ...e, lunar: { ...e.lunar, noLeap: "skip" } }, d),
    false,
  );
});
test("weekly recurrence does not create events before start", () => {
  const e = {
    ...newEvent(new Date(2026, 9, 28)),
    title: "例会",
    repeat: "weekly" as const,
  };
  assert.equal(occursOn(e, new Date(2026, 9, 21)), false);
  assert.equal(occursOn(e, new Date(2026, 10, 4)), true);
});
test("month grid is Monday-first with complete weeks", () => {
  const cells = monthCells(now);
  assert.equal(cells[0].getDay(), 1);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.filter((d) => d.getMonth() === 9).length, 31);
});
test("event validation rejects empty title and backwards ranges", () => {
  assert.throws(() => validateEvent(newEvent(now)));
  assert.throws(() =>
    validateEvent({ ...newEvent(now), title: "test", end: "2026-10-27T09:00" }),
  );
});
test("name filter only matches exact name tokens and aliases", () => {
  assert.equal(matchesName("林同学、李同学", "林同学", ""), true);
  assert.equal(matchesName("林同学甲", "林同学", ""), false);
  assert.equal(matchesName("Xiao Lin", "林同学", "Xiao Lin"), true);
});
test("Excel round trip, exact name filter and editable parsed events", () => {
  const rows = [
    ["日期", "时间", "事项", "姓名"],
    ["2026-10-29", "09:00", "值班", "林同学"],
    ["2026-10-30", "15:00", "讨论", "李同学"],
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "安排");
  const tables = readWorkbook(
    XLSX.write(book, { type: "array", bookType: "xlsx" }),
  );
  const result = parseTable(
    tables[0],
    detectMapping(tables[0].rows),
    { name: "林同学", aliases: "" },
    true,
  );
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].title, "值班");
  assert.equal(result.events[0].start, "2026-10-29T09:00");
});
test("unmatched names never import everyone else", () => {
  const table = {
    name: "安排",
    rows: [
      ["日期", "事项", "姓名"],
      ["2026-10-29", "值班", "其他人"],
    ],
  };
  const r = parseTable(
    table,
    detectMapping(table.rows),
    { name: "林同学", aliases: "" },
    true,
  );
  assert.equal(r.events.length, 0);
  assert.ok(r.warnings.length);
});
test("bad spreadsheet rows give warnings rather than impossible events", () => {
  const table = {
    name: "安排",
    rows: [
      ["日期", "事项"],
      ["2026-02-30", "值班"],
    ],
  };
  const r = parseTable(
    table,
    detectMapping(table.rows),
    { name: "", aliases: "" },
    false,
  );
  assert.equal(r.events.length, 0);
  assert.match(r.warnings[0], /第2行/);
});
test("Excel date cells preserve their real year regardless of displayed date format", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["日期", "事项"],
    [new Date(2030, 9, 29, 15, 0), "未来安排"],
  ]);
  sheet.A2.z = "m/d/yy";
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "安排");
  const table = readWorkbook(
    XLSX.write(book, { type: "array", bookType: "xlsx" }),
  )[0];
  const result = parseTable(
    table,
    detectMapping(table.rows),
    { name: "", aliases: "" },
    false,
  );
  assert.equal(result.events[0].start, "2030-10-29T15:00");
});
test("ambiguous CSV date order requires correction", () => {
  const table = {
    name: "安排",
    rows: [
      ["日期", "事项"],
      ["04/05/2030", "有歧义安排"],
    ],
  };
  const r = parseTable(
    table,
    detectMapping(table.rows),
    { name: "", aliases: "" },
    false,
  );
  assert.equal(r.events.length, 0);
  assert.match(r.warnings[0], /月日顺序不明确/);
});
test("duplicate import is suppressed without suppressing different dates", () => {
  const e = { ...newEvent(now), title: "值班" };
  assert.equal(dedupe([e, { ...e, id: "other" }], [e]).length, 0);
  assert.equal(
    dedupe([{ ...e, id: "next", start: "2026-10-29T09:00" }], [e]).length,
    1,
  );
});
test("OCR text parsing retains unparsed lines as warnings", () => {
  const r = parseRecognizedText("2026年10月30日15:00报名截止\n没有日期的备注");
  assert.equal(r.events.length, 1);
  assert.equal(r.warnings.length, 1);
});
test("backups reject malformed events, duplicate ids and unsupported versions", () => {
  const e = { ...newEvent(now), title: "值班" };
  assert.equal(
    validateBackup({ version: 1, events: [e], settings: defaultSettings })
      .events.length,
    1,
  );
  assert.throws(() => validateBackup({ version: 2, events: [] }));
  assert.throws(() => validateBackup({ version: 1, events: [e, e] }));
  assert.throws(() =>
    validateBackup({ version: 1, events: [{ ...e, start: "unknown" }] }),
  );
});
