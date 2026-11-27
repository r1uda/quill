import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { defaultSettings } from "../domain/model";
import { AppData, validateBackup } from "../domain/backup";
import {readSnapshot,writeSnapshot} from '../domain/snapshot';
export { validateBackup } from "../domain/backup";
export type { AppData } from "../domain/backup";
const SECRET = "qingri-api-key";
export async function loadData(): Promise<AppData> {
  const raw = await readSnapshot(AsyncStorage);
  return raw
    ? validateBackup(JSON.parse(raw))
    : { version: 1, events: [], settings: defaultSettings };
}
let queue = Promise.resolve();
export function persist(data: AppData): Promise<void> {
  const snapshot = JSON.stringify(data);
  queue = queue.catch(() => {}).then(() => writeSnapshot(AsyncStorage, snapshot));
  return queue;
}
let webKey = "";
export async function getApiKey() {
  return Platform.OS === "web"
    ? webKey
    : (await SecureStore.getItemAsync(SECRET)) || "";
}
export async function setApiKey(key: string) {
  if (Platform.OS === "web") webKey = key;
  else if (key) await SecureStore.setItemAsync(SECRET, key);
  else await SecureStore.deleteItemAsync(SECRET);
}
