import { requireNativeModule } from "expo-modules-core";
import type { SpeechOptions, SpeechSession } from "./speech.types";
interface SpeechEvent {
  id: string;
  type: "start" | "text" | "error" | "end";
  text: string;
}
interface OfflineModule {
  prepareSpeech(): Promise<boolean>;
  startSpeech(id: string): void;
  stopSpeech(id: string): void;
  cancelSpeech(id: string): void;
  addListener(name: "speech", fn: (e: SpeechEvent) => void): { remove(): void };
}
let module: OfflineModule | undefined;
const engine = () =>
  (module ??= requireNativeModule<OfflineModule>("QingriDevice"));
export function prepareOfflineSpeech() {
  return engine().prepareSpeech();
}
export async function startOfflineSpeech(
  onText: (s: string) => void,
  onEnd: () => void,
  onError: (s: string) => void,
  options: SpeechOptions = {},
): Promise<SpeechSession> {
  const m = engine();
  const { ExpoSpeechRecognitionModule: permission } =
    await import("expo-speech-recognition");
  const empty = { stop() {}, cancel() {} };
  if (options.signal?.aborted) return empty;
  if (!(await permission.getMicrophonePermissionsAsync()).granted) {
    const granted = await permission.requestMicrophonePermissionsAsync();
    if (options.signal?.aborted) return empty;
    if (!granted.granted) throw new Error("需要允许麦克风权限，才能长按说话。");
    throw new Error("麦克风权限已开启，请再长按一次说话。");
  }
  if (options.signal?.aborted) return empty;
  const id = `${Date.now()}-${Math.random()}`;
  let ended = false;
  let timer: ReturnType<typeof setTimeout>;
  const finish = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    sub.remove();
    options.signal?.removeEventListener("abort", cancel);
    onEnd();
  };
  const cancel = () => {
    if (!ended) {
      m.cancelSpeech(id);
      finish();
    }
  };
  const sub = m.addListener("speech", (e) => {
    if (ended || e.id !== id) return;
    if (e.type === "start") {
      clearTimeout(timer);
      options.onStart?.();
    } else if (e.type === "text") onText(e.text);
    else if (e.type === "error") onError(e.text);
    else finish();
  });
  options.signal?.addEventListener("abort", cancel, { once: true });
  timer = setTimeout(() => {
    onError("离线识别引擎尚未准备好，请稍等后重新长按。");
    cancel();
  }, 30000);
  try {
    m.startSpeech(id);
  } catch (e) {
    finish();
    throw e;
  }
  return {
    cancel,
    stop() {
      if (ended) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        onError("识别未能结束，已保留文字，请检查后添加。");
        cancel();
      }, 45000);
      m.stopSpeech(id);
    },
  };
}
