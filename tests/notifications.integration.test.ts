import { beforeEach, expect, it, vi } from "vitest";
import {
  syncReminders,
  notificationStatus,
  requestReminders,
} from "../src/services/notifications.native";
import { newEvent, dateTime } from "../src/domain/model";
const native = vi.hoisted(() => ({
  schedule: vi.fn(),
  status: vi.fn(),
  alarmSettings: vi.fn(),
  cancel: vi.fn(),
  legacy: vi.fn(),
  permission: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" }, Linking: {} }));
vi.mock("expo-modules-core", () => ({
  requireNativeModule: () => ({
    scheduleReminders: native.schedule,
    reminderStatus: native.status,
    openAlarmSettings: native.alarmSettings,
  }),
}));
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  requestPermissionsAsync: native.permission,
  getAllScheduledNotificationsAsync: native.legacy,
  cancelScheduledNotificationAsync: native.cancel,
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
beforeEach(() => {
  vi.clearAllMocks();
  native.schedule.mockImplementation(
    async (json: string) => JSON.parse(json).length,
  );
  native.status.mockResolvedValue({
    notifications: true,
    exact: true,
    count: 1,
    messageChannel: true,
    alarmChannel: true,
    lastFired: 0,
    error: "",
  });
  native.legacy.mockResolvedValue([{ identifier: "qingri:old" }]);
  native.permission.mockResolvedValue({ granted: true });
});
it("a scheduling failure remains visible and does not cancel legacy reminders first", async () => {
  native.schedule.mockRejectedValue(new Error("准时提醒权限尚未开启"));
  await expect(syncReminders([], true)).rejects.toThrow("准时提醒权限");
  expect(native.cancel).not.toHaveBeenCalled();
});
it("the native plan receives the selected mode and disabled events are excluded", async () => {
  const date = new Date(Date.now() + 3600000);
  const event = {
    ...newEvent(date),
    start: dateTime(date),
    title: "闹铃",
    reminder: true,
    reminderMode: "alarm" as const,
    minutesBefore: 0,
  };
  await syncReminders([event, { ...event, id: "off", reminder: false }], true);
  const plan = JSON.parse(native.schedule.mock.calls[0][0]);
  expect(plan).toHaveLength(1);
  expect(plan[0].mode).toBe("alarm");
  expect(native.cancel).toHaveBeenCalledWith("qingri:old");
});
it("notification and exact-alarm permissions are distinguished", async () => {
  native.status.mockResolvedValue({
    notifications: true,
    exact: false,
    count: 0,
    messageChannel: true,
    alarmChannel: true,
    lastFired: 0,
    error: "",
  });
  expect(await notificationStatus()).toContain("准时提醒：未开启");
  await requestReminders();
  expect(native.alarmSettings).toHaveBeenCalledOnce();
});
