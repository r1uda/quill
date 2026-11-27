import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { AppData, loadData, persist } from "./services/storage";
import { defaultSettings, CalendarEvent, validateEvent } from "./domain/model";
import { syncReminders } from "./services/notifications";
import { normalizeOccasion } from "./domain/occasions";
import { syncWidgets } from "./services/widgets";
interface State {
  data: AppData;
  ready: boolean;
  error: string;
  mutate: (f: (d: AppData) => AppData) => Promise<void>;
  saveEvents: (events: CalendarEvent[]) => Promise<void>;
  reload: () => void;
  notificationError: string;
}
const Context = createContext<State>(null!);
export function Store({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>({
    version: 1,
    events: [],
    settings: defaultSettings,
  });
  const ref = useRef(data);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notificationError, setNotificationError] = useState("");
  const pending = useRef(Promise.resolve());
  const reload = () => {
    setError("");
    loadData()
      .then((d) => {
        ref.current = d;
        setData(d);
        setReady(true);
      })
      .catch((e) => {
        setError(`读取本机数据失败：${e.message}。原数据未被覆盖。`);
        setReady(false);
      });
  };
  useEffect(reload, []);
  useEffect(() => {
    if (!ready) return;
    const sync = () => { syncWidgets(data.events, data.settings).catch(e => console.warn("桌面小组件更新失败", e)); };
    sync();
    const sub = AppState.addEventListener("change", s => { if (s === "active") sync(); });
    return () => sub.remove();
  }, [ready, data.events, data.settings.appearance.accent]);
  const mutate = (f: (d: AppData) => AppData) => {
    const work = pending.current
      .catch(() => {})
      .then(async () => {
        const next = f(ref.current);
        await persist(next);
        ref.current = next;
        setData(next);
      });
    pending.current = work;
    return work;
  };
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const sync = () =>
      syncReminders(data.events, data.settings.reminders.sound)
        .then(() => {
          if (active) setNotificationError("");
        })
        .catch((error: Error) => {
          if (active)
            setNotificationError(
              `日程已保存，提醒未排程：${error.message || "请检查提醒设置"}`,
            );
        });
    sync();
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") sync();
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, [ready, data.events, data.settings.reminders.sound]);
  const saveEvents = (items: CalendarEvent[]) =>
    mutate((d) => {
      const events = items.map((e) =>
        validateEvent(normalizeOccasion(validateEvent(e))),
      );
      const ids = new Set(events.map((e) => e.id));
      return {
        ...d,
        events: [...d.events.filter((e) => !ids.has(e.id)), ...events],
      };
    });
  return (
    <Context.Provider
      value={{
        data,
        ready,
        error,
        mutate,
        saveEvents,
        reload,
        notificationError,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
