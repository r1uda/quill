import { requireNativeModule } from "expo-modules-core";
import type { PlannedReminder } from "../domain/reminders";
export interface ReminderStatus {
  notifications: boolean;
  exact: boolean;
  count: number;
  messageChannel: boolean;
  alarmChannel: boolean;
  lastFired: number;
  error: string;
}
interface Device {
  reminderStatus(): Promise<ReminderStatus>;
  scheduleReminders(json: string): Promise<number>;
  testReminder(mode: "notification" | "alarm"): Promise<number>;
  openAlarmSettings(): void;
  openNotificationSettings(): void;
  stopAlarm(): void;
}
export const device = () => requireNativeModule<Device>("QingriDevice");
export const scheduleDeviceReminders = (plan: PlannedReminder[]) =>
  device().scheduleReminders(JSON.stringify(plan));
