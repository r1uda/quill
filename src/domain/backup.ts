import {
  CalendarEvent,
  Settings,
  defaultSettings,
  validateEvent,
} from "./model";
import { normalizeOccasion } from "./occasions";
export interface AppData {
  version: 1;
  events: CalendarEvent[];
  settings: Settings;
}
export function validateBackup(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") throw new Error("备份格式不正确");
  const x = raw as AppData;
  if (x.version !== 1 || !Array.isArray(x.events) || x.events.length > 5000)
    throw new Error("不支持的备份版本或条目过多");
  const s = x.settings || defaultSettings;
  const settings: Settings = {
    ...defaultSettings,
    ...s,
    ai: { ...defaultSettings.ai, ...s.ai },
    appearance: { ...defaultSettings.appearance, ...s.appearance },
    reminders: { ...defaultSettings.reminders, ...s.reminders },
  };
  settings.name = String(settings.name || "").slice(0, 100);
  settings.aliases = String(settings.aliases || "").slice(0, 500);
  if (
    settings.reminders.mode !== undefined &&
    !["notification", "alarm"].includes(settings.reminders.mode)
  )
    throw new Error("备份中的提醒方式不正确");
  if (!["blue", "purple"].includes(settings.appearance.accent))
    settings.appearance.accent = "blue";
  for (const [key, min, max] of [
    ["blur", 0, 40],
    ["brightness", 0, 100],
    ["opacity", 30, 100],
  ] as const) {
    const v = Number(settings.appearance[key]);
    if (!Number.isFinite(v)) throw new Error("备份中的外观设置不正确");
    settings.appearance[key] = Math.max(min, Math.min(max, v));
  }
  if (
    typeof settings.appearance.background !== "string" ||
    settings.appearance.background.length > 3500000
  )
    throw new Error("背景数据不正确");
  if (
    settings.appearance.background &&
    !/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(
      settings.appearance.background,
    )
  )
    throw new Error("备份背景必须是图片数据");
  if (
    !Number.isFinite(settings.reminders.minutes) ||
    settings.reminders.minutes < 0 ||
    settings.reminders.minutes > 525600
  )
    throw new Error("备份提醒时间不正确");
  const events = x.events.map((e) =>
    validateEvent(normalizeOccasion(validateEvent(e))),
  );
  if (new Set(events.map((e) => e.id)).size !== events.length)
    throw new Error("备份包含重复的日程编号");
  // Explicit fields prevent accidental inclusion of a key from a modified backup.
  settings.ai = {
    enabled: !!settings.ai.enabled,
    url: String(settings.ai.url || ""),
    model: String(settings.ai.model || ""),
    provider:
      typeof settings.ai.provider === "string"
        ? settings.ai.provider.slice(0, 60)
        : undefined,
    protocol: settings.ai.protocol === "anthropic" ? "anthropic" : "chat",
    models: Array.isArray(settings.ai.models)
      ? [
          ...new Set(
            settings.ai.models.filter(
              (m): m is string =>
                typeof m === "string" && m.length > 0 && m.length <= 200,
            ),
          ),
        ].slice(0, 1000)
      : [],
  };
  return { version: 1, events, settings };
}
