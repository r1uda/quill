import { Platform } from "react-native";
import { widgetSnapshot } from "../domain/widgets";
import { CalendarEvent, Settings } from "../domain/model";

export async function syncWidgets(events: CalendarEvent[], settings: Settings) {
  if (Platform.OS !== "android") return;
  const { requireNativeModule } = await import("expo-modules-core");
  const module = requireNativeModule<{ updateWidgets(json: string): Promise<void> }>("QingriDevice");
  await module.updateWidgets(JSON.stringify(widgetSnapshot(events, settings)));
}
export async function pinWidget(size: "4x4" | "4x2" | "2x2" | "1x2") {
  if (Platform.OS !== "android") return false;
  const { requireNativeModule } = await import("expo-modules-core");
  return requireNativeModule<{ pinWidget(size: string): Promise<boolean> }>("QingriDevice").pinWidget(size);
}
