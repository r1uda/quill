import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import { uid } from "../domain/model";
export type DraftMap = Record<string, unknown>;
const KEY = "qingri:drafts:file:v1";
export async function loadDrafts(): Promise<DraftMap> {
  const uri = await AsyncStorage.getItem(KEY);
  if (!uri) return {};
  const file = new File(uri);
  if (!file.exists) throw new Error("草稿文件暂时无法读取");
  const data = JSON.parse(await file.text());
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("草稿格式不正确");
  return data;
}
export async function persistDrafts(drafts: DraftMap): Promise<void> {
  const old = await AsyncStorage.getItem(KEY);
  const file = new File(Paths.document, `qingri-drafts-${uid()}.json`);
  const snapshot = JSON.stringify(drafts, (key, value) =>
    key === "data" &&
    typeof value === "string" &&
    value.startsWith("data:image/")
      ? undefined
      : key === "bytes"
        ? undefined
        : value,
  );
  file.write(snapshot);
  try {
    await AsyncStorage.setItem(KEY, file.uri);
  } catch (error) {
    file.delete();
    throw error;
  }
  if (
    old &&
    old.startsWith(Paths.document.uri.replace(/\/$/, "") + "/qingri-drafts-")
  ) {
    try {
      const previous = new File(old);
      if (previous.exists) previous.delete();
    } catch {}
  }
}
