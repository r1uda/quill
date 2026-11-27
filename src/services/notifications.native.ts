import * as Notifications from "expo-notifications";
import { Platform, Linking } from "react-native";
import { CalendarEvent } from "../domain/model";
import { reminderPlan } from "../domain/reminders";
import { device, scheduleDeviceReminders } from "./device";
Notifications.setNotificationHandler({
  handleNotification: async (n) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: !!n.request.content.sound,
    shouldSetBadge: false,
  }),
});
export async function requestReminders() {
  if (Platform.OS === "android") await device().reminderStatus();
  const permission = await Notifications.requestPermissionsAsync();
  const granted =
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (granted && Platform.OS === "android") {
    const status = await device().reminderStatus();
    if (!status.exact) device().openAlarmSettings();
  }
  return granted;
}
let syncQueue = Promise.resolve(0);
export function syncReminders(
  events: CalendarEvent[],
  sound: boolean,
): Promise<number> {
  syncQueue = syncQueue
    .catch(() => 0)
    .then(async () => {
      const next = reminderPlan(events, sound);
      if (Platform.OS === "android") {
        const count = await scheduleDeviceReminders(next);
        const legacy = await Notifications.getAllScheduledNotificationsAsync();
        for (const p of legacy)
          if (p.identifier.startsWith("qingri:"))
            await Notifications.cancelScheduledNotificationAsync(p.identifier);
        return count;
      }
      if (next.length && !(await Notifications.getPermissionsAsync()).granted)
        throw new Error("通知权限尚未开启，请在提醒设置中允许通知。");
      if (next.some((x) => x.mode === "alarm"))
        throw new Error(
          "当前 iOS 版本暂支持消息提醒，请将提醒方式改为消息通知。",
        );
      for (const x of next)
        await Notifications.scheduleNotificationAsync({
          identifier: x.id,
          content: {
            title: x.title,
            body: x.body,
            sound: sound ? "default" : false,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(x.when),
          },
        });
      const ids = new Set(next.map((x) => x.id));
      for (const p of await Notifications.getAllScheduledNotificationsAsync())
        if (p.identifier.startsWith("qingri:") && !ids.has(p.identifier))
          await Notifications.cancelScheduledNotificationAsync(p.identifier);
      return next.length;
    });
  return syncQueue;
}
export async function notificationStatus() {
  if (Platform.OS !== "android")
    return (await Notifications.getPermissionsAsync()).granted
      ? "已允许"
      : "尚未允许";
  const s = await device().reminderStatus();
  return `消息权限：${s.notifications ? "已开启" : "未开启"}；准时提醒：${s.exact ? "已开启" : "未开启"}\n已排程 ${s.count} 次${!s.messageChannel ? "；消息通道已关闭" : ""}${!s.alarmChannel ? "；闹铃通道已关闭" : ""}${s.lastFired ? `\n最近触发：${new Date(s.lastFired).toLocaleString()}` : ""}${s.error ? `\n${s.error}` : ""}`;
}
export async function openReminderSettings(kind: "notification" | "alarm") {
  if (Platform.OS === "android") {
    if (kind === "alarm") device().openAlarmSettings();
    else device().openNotificationSettings();
  } else await Linking.openSettings();
}
export async function testReminder(mode: "notification" | "alarm") {
  if (!(await requestReminders()))
    throw new Error("请先允许通知权限，再测试提醒。");
  if (Platform.OS === "android") {
    await syncQueue.catch(() => 0);
    await device().testReminder(mode);
  } else {
    if (mode === "alarm") throw new Error("当前 iOS 版本暂支持消息提醒。");
    await Notifications.scheduleNotificationAsync({
      content: { title: "消息提醒测试", sound: "default" },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 10000),
      },
    });
  }
}
export async function stopAlarm() {
  if (Platform.OS === "android") device().stopAlarm();
}
