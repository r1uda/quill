import { CalendarEvent } from "../domain/model";
// A browser tab cannot reliably schedule closed-app local notifications.
export async function requestReminders() {
  throw new Error("手机本地提醒请在安装版中开启；浏览器预览可以保存提醒设置。");
  return false;
}
export async function syncReminders(_events: CalendarEvent[], _sound: boolean) {
  return 0;
}
export async function notificationStatus() {
  return "浏览器预览，手机安装版可用";
}
export async function openReminderSettings(_kind: "notification" | "alarm") {
  throw new Error("请在手机安装版中设置提醒权限。");
}
export async function testReminder(_mode: "notification" | "alarm") {
  throw new Error("请在手机安装版中测试提醒。");
}
export async function stopAlarm() {}
