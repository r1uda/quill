import type { SpeechSession, SpeechOptions } from "./speech.types";
export type { SpeechSession } from "./speech.types";
export function prepareSpeech() {}
export async function startSpeech(
  onText: (s: string) => void,
  onEnd: () => void,
  onError: (s: string) => void,
  options: SpeechOptions = {},
): Promise<SpeechSession> {
  const browser = window as any;
  const Constructor =
    browser.SpeechRecognition || browser.webkitSpeechRecognition;
  if (!Constructor)
    throw new Error("此浏览器不支持语音识别，请使用支持语音的浏览器或手机版");
  const recognition = new Constructor();
  if (options.signal?.aborted) return { stop() {}, cancel() {} };
  let ended = false;
  let aborted = false;
  const cancel = () => {
    if (!ended) {
      aborted = true;
      recognition.abort();
    }
  };
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.onresult = (e: any) => {
    if (ended || aborted) return;
    let text = "";
    for (let i = 0; i < e.results.length; i++)
      text += e.results[i][0].transcript;
    onText(text);
  };
  recognition.onerror = (e: any) => {
    if (!ended && !aborted && e.error !== "aborted")
      onError(
        e.error === "not-allowed"
          ? "请允许浏览器使用麦克风"
          : "语音识别暂不可用，请检查网络和浏览器设置",
      );
  };
  recognition.onstart = () => {
    if (!ended && !aborted) options.onStart?.();
  };
  recognition.onend = () => {
    if (!ended) {
      ended = true;
      options.signal?.removeEventListener("abort", cancel);
      onEnd();
    }
  };
  options.signal?.addEventListener("abort", cancel, { once: true });
  try {
    recognition.start();
  } catch (error) {
    options.signal?.removeEventListener("abort", cancel);
    throw error;
  }
  return {
    stop: () => {
      if (!ended && !aborted) recognition.stop();
    },
    cancel,
  };
}
