import { test } from "node:test";
import assert from "node:assert/strict";
import { widgetSnapshot } from "../src/domain/widgets";
import { defaultSettings, newEvent } from "../src/domain/model";

test("widget cache expands weekly schedules and crosses the month boundary without copying private configuration", () => {
  const now = new Date(2026, 9, 30, 9);
  const event = { ...newEvent(now), title: "每周讨论", start: "2026-10-30T14:00", repeat: "weekly" as const, notes: "私密备注" };
  const settings = { ...defaultSettings, ai: { ...defaultSettings.ai, url: "https://private.example", model: "private-model" } };
  const snapshot = widgetSnapshot([event], settings, now);
  assert.equal(snapshot.days['2026-10-30'][0].title, "每周讨论");
  assert.equal(snapshot.days['2026-11-06'][0].time, "14:00");
  assert.equal(snapshot.days['2026-11-07'].length, 0);
  assert.ok(!JSON.stringify(snapshot).includes("私密"));
  assert.ok(!JSON.stringify(snapshot).includes("private"));
});
test("widget birthday uses the next lunar occurrence and data deletion empties the cache", () => {
  const now = new Date(2026, 9, 30, 9);
  const event = { ...newEvent(now), title: "小林生日", kind: "birthday" as const, allDay: true, start: "2020-01-01T09:00", repeat: "yearly" as const, lunar: { month: 5, day: 5, leap: false, noLeap: "regular" as const, shortMonth: "last" as const } };
  const snapshot = widgetSnapshot([event], defaultSettings, now);
  assert.equal(snapshot.occasions[0].date, "2027-06-09");
  assert.equal(widgetSnapshot([], defaultSettings, now).occasions.length, 0);
  assert.ok(Object.values(widgetSnapshot([], defaultSettings, now).days).every(x => !x.length));
});
