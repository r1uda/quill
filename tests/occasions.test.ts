import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSentence } from "../src/domain/parse";
import { dateKey, newEvent } from "../src/domain/model";
import {
  nextOccasion,
  matchesEventQuery,
  normalizeOccasion,
} from "../src/domain/occasions";
import { lunarToday } from "../src/domain/calendar";
import { reminderPlan } from "../src/domain/reminders";
const now = new Date(2026, 9, 29, 13, 0);
test("date of birth becomes an annual birthday rather than a past one-off task", () => {
  const r = parseSentence("添加张三的生日，他是2000年5月6日出生的", now);
  assert.deepEqual(r.issues, []);
  assert.equal(r.event.kind, "birthday");
  assert.equal(r.event.repeat, "yearly");
  assert.equal(r.event.allDay, true);
  assert.equal(r.event.person, "张三");
  assert.equal(r.event.birthYear, 2000);
  assert.equal(dateKey(nextOccasion(r.event, now)!), "2027-05-06");
  assert.equal(matchesEventQuery(r.event, "张三生日"), true);
});
test("lunar reference year and birth year stay separate", () => {
  const r = parseSentence("妈妈2024年6月10日过农历生日，1975年出生", now);
  assert.deepEqual(r.issues, []);
  assert.equal(r.event.person, "妈妈");
  assert.equal(r.event.lunar?.referenceDate, "2024-06-10");
  assert.equal(r.event.birthYear, 1975);
  assert.equal(r.event.lunar?.month, lunarToday(new Date(2024, 5, 10)).month);
  assert.equal(r.event.lunar?.day, lunarToday(new Date(2024, 5, 10)).day);
  assert.ok(nextOccasion(r.event, now));
  const spoken = parseSentence(
    "妈妈二零二四年六月十日过农历生日，一九七五年出生",
    now,
  );
  assert.deepEqual(spoken.issues, []);
  assert.equal(spoken.event.lunar?.referenceDate, "2024-06-10");
  assert.equal(spoken.event.birthYear, 1975);
  assert.equal(
    normalizeOccasion({
      ...r.event,
      lunar: { ...r.event.lunar!, noLeap: "skip", shortMonth: "skip" },
    }).lunar?.shortMonth,
    "skip",
  );
});
test("direct lunar input works without AI and missing reference year is never guessed from birth year", () => {
  const r = parseSentence("添加妈妈的农历生日，农历六月初三，1975年出生", now);
  assert.deepEqual(r.issues, []);
  assert.equal(r.event.lunar?.month, 6);
  assert.equal(r.event.lunar?.day, 3);
  assert.equal(
    parseSentence("妈妈6月10日过农历生日，1975年出生", now).event.lunar,
    undefined,
  );
  assert.ok(
    parseSentence("妈妈6月10日过农历生日，1975年出生", now).issues.length,
  );
});
test("multiple birthdays ask for clarification while birthday party and gift tasks remain ordinary", () => {
  assert.ok(parseSentence("张三5月6日生日，李四8月9日生日", now).issues.length);
  assert.equal(parseSentence("明天下午三点生日聚会", now).event.kind, "event");
  const gift = { ...newEvent(now), title: "给妈妈买生日礼物" };
  assert.equal(normalizeOccasion(gift).kind, "event");
  assert.equal(
    normalizeOccasion({ ...gift, title: "妈妈的生日" }).repeat,
    "yearly",
  );
});
test("reminder planning excludes disabled and past triggers and retains each chosen mode", () => {
  const base = {
    ...newEvent(now),
    start: "2026-10-29T14:00",
    title: "测试",
    reminder: true,
    minutesBefore: 0,
  };
  const plan = reminderPlan(
    [
      base,
      { ...base, id: "off", reminder: false },
      { ...base, id: "alarm", reminderMode: "alarm" },
      { ...base, id: "past", start: "2026-10-29T12:00" },
    ],
    true,
    now,
  );
  assert.equal(plan.length, 2);
  assert.equal(plan[0].local, "2026-10-29T14:00");
  assert.equal(plan[1].mode, "alarm");
});
