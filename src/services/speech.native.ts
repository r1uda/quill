import { Platform } from "react-native";
import { startOfflineSpeech, prepareOfflineSpeech } from "./speech.offline";
import type { SpeechSession, SpeechOptions } from "./speech.types";
export type { SpeechSession } from "./speech.types";
export async function startSpeech(
  onText: (s: string) => void,
  onEnd: () => void,
  onError: (s: string) => void,
  options: SpeechOptions = {},
): Promise<SpeechSession> {
  if (Platform.OS === "android")
    return startOfflineSpeech(onText, onEnd, onError, options);
  const { ExpoSpeechRecognitionModule: m } =
    await import("expo-speech-recognition");
  if (options.signal?.aborted) return { stop() {}, cancel() {} };
  if (!m.isRecognitionAvailable())
    throw new Error(
      "这台手机暂未提供可用的系统语音识别，可先轻点快速添加输入一句话",
    );
  const permission = await m.getPermissionsAsync();
  if (options.signal?.aborted) return { stop() {}, cancel() {} };
  if (!permission.granted) {
    const requested = await m.requestPermissionsAsync();
    if (options.signal?.aborted) return { stop() {}, cancel() {} };
    if (!requested.granted)
      throw new Error("需要允许麦克风与语音识别权限，才能长按说话");
    // A permission dialog consumes the original finger gesture. Start afresh
    // rather than assuming the finger is still down after the dialog closes.
    throw new Error("麦克风权限已开启，请再长按一次说话。");
  }
  let ended = false;
  let aborted = false;
  let committed = "";
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (ended) return;
    ended = true;
    if (watchdog) clearTimeout(watchdog);
    subs.forEach((s) => s.remove());
    options.signal?.removeEventListener("abort", cancel);
    onEnd();
  };
  const cancel = () => {
    if (ended) return;
    aborted = true;
    try {
      m.abort();
    } catch {
    } finally {
      finish();
    }
  };
  const subs = [
    m.addListener("start", () => {
      if (watchdog) clearTimeout(watchdog);
      if (!ended && !aborted) options.onStart?.();
    }),
    m.addListener("result", (e) => {
      if (ended || aborted) return;
      const text = e.results[0]?.transcript || "";
      onText(committed + text);
      if (e.isFinal && Platform.OS === "ios") committed += text;
    }),
    m.addListener("end", () => {
      finish();
    }),
    m.addListener("error", (e) => {
      if (ended || aborted || e.error === "aborted") return;
      const message: Record<string, string> = {
        "not-allowed":
          "麦克风权限未开启，请在手机权限设置中允许使用麦克风后再试。",
        "service-not-allowed":
          "手机当前没有可用的系统语音识别服务。窗口会保留，也可以先输入一句话。",
        "language-not-supported":
          "当前语音服务暂不支持中文识别，可以先输入一句话。",
        "audio-capture": "麦克风暂时无法使用，可能正被通话或其他录音占用。",
        "no-speech": "没有听清内容，请重新长按并靠近手机说话。",
        network: "语音服务连接失败，请检查手机网络后重试。",
        busy: "语音服务正在忙，请稍后重新长按。",
        client: "语音服务没有正常完成本次识别，请重新长按。",
      };
      onError(
        message[e.error] ||
          `语音识别暂不可用（${e.error}），可以重试或输入一句话。`,
      );
      try {
        m.abort();
      } catch {
      } finally {
        finish();
      }
    }),
  ];
  options.signal?.addEventListener("abort", cancel, { once: true });
  watchdog = setTimeout(() => {
    if (ended || aborted) return;
    onError("手机语音服务未能启动，请重新长按；也可以先输入一句话。");
    cancel();
  }, 10000);
  try {
    // Android continuous mode supplies a custom audio stream that some OEM
    // recognizers reject. Use the system's ordinary one-utterance microphone.
    m.start({
      lang: "zh-CN",
      interimResults: true,
      continuous: true,
    });
  } catch (error) {
    if (watchdog) clearTimeout(watchdog);
    subs.forEach((s) => s.remove());
    options.signal?.removeEventListener("abort", cancel);
    throw error;
  }
  return {
    stop: () => {
      if (ended || aborted) return;
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (ended || aborted) return;
        onError("语音服务没有返回最终结果，已保留识别文字，请检查后点添加。");
        cancel();
      }, 6000);
      try {
        m.stop();
      } catch {
        onError("语音服务未能正常结束，已保留文字，可以检查后点添加。");
        cancel();
      }
    },
    cancel,
  };
}
export function prepareSpeech() {
  try {
    if (Platform.OS === "android") prepareOfflineSpeech().catch(() => {});
  } catch {}
}
