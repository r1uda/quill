import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { DraftMap, loadDrafts, persistDrafts } from "./services/drafts";
interface DraftContext {
  ready: boolean;
  status: "saved" | "saving" | "error";
  error: string;
  get: <T>(key: string) => T | undefined;
  set: (key: string, value: unknown) => void;
  remove: (key: string) => void;
  flush: () => Promise<void>;
}
const Context = createContext<DraftContext>(null!);
export function DraftProvider({ children }: { children: React.ReactNode }) {
  const current = useRef<DraftMap>({});
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<DraftContext["status"]>("saved");
  const [error, setError] = useState("");
  const [, setRevision] = useState(0);
  const blocked = useRef(false);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef(Promise.resolve());
  const version = useRef(0);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    if (blocked.current || !loaded.current) return Promise.resolve();
    const snapshot = current.current;
    const token = version.current;
    const work = queue.current
      .catch(() => {})
      .then(() => persistDrafts(snapshot));
    queue.current = work;
    work
      .then(() => {
        if (token === version.current) {
          setStatus("saved");
          setError("");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("草稿未能保存，请暂时保留当前页面");
      });
    return work;
  };
  const schedule = () => {
    version.current++;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      flush().catch(() => {});
    }, 250);
  };
  useEffect(() => {
    let active = true;
    loadDrafts()
      .then((data) => {
        if (active) {
          current.current = data;
          loaded.current = true;
          setRevision((r) => r + 1);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          blocked.current = true;
          setReady(true);
          setStatus("error");
          setError("上次草稿未能读取，原文件已保留");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (s) => {
      if (s !== "active") flush().catch(() => {});
    });
    const hide = () => {
      flush().catch(() => {});
    };
    if (Platform.OS === "web") {
      window.addEventListener("pagehide", hide);
      document.addEventListener("visibilitychange", hide);
    }
    return () => {
      listener.remove();
      if (Platform.OS === "web") {
        window.removeEventListener("pagehide", hide);
        document.removeEventListener("visibilitychange", hide);
      }
      if (timer.current) clearTimeout(timer.current);
      flush().catch(() => {});
    };
  }, []);
  const set = (key: string, value: unknown) => {
    if (blocked.current) return;
    current.current = { ...current.current, [key]: value };
    setRevision((r) => r + 1);
    schedule();
  };
  const remove = (key: string) => {
    if (blocked.current) return;
    const next = { ...current.current };
    delete next[key];
    current.current = next;
    setRevision((r) => r + 1);
    schedule();
  };
  return (
    <Context.Provider
      value={{
        ready,
        status,
        error,
        get: <T,>(key: string) => current.current[key] as T | undefined,
        set,
        remove,
        flush,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useDrafts = () => useContext(Context);
