import { beforeEach, expect, it, vi } from "vitest";
import { startOfflineSpeech } from "../src/services/speech.offline";
const native = vi.hoisted(() => ({
  listener: undefined as any,
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
  permission: vi.fn(),
  request: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("expo-modules-core", () => ({
  requireNativeModule: () => ({
    startSpeech: native.start,
    stopSpeech: native.stop,
    cancelSpeech: native.cancel,
    addListener: (_n: string, fn: any) => {
      native.listener = fn;
      return { remove: native.remove };
    },
  }),
}));
vi.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    getMicrophonePermissionsAsync: native.permission,
    requestMicrophonePermissionsAsync: native.request,
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  native.permission.mockResolvedValue({ granted: true });
  native.request.mockResolvedValue({ granted: true });
});
it("Android offline capture accepts only its own session, then waits for final text after release", async () => {
  const text = vi.fn(),
    end = vi.fn(),
    start = vi.fn();
  const session = await startOfflineSpeech(text, end, vi.fn(), {
    onStart: start,
  });
  const id = native.start.mock.calls[0][0];
  native.listener({ id: "stale", type: "text", text: "旧语音" });
  expect(text).not.toHaveBeenCalled();
  native.listener({ id, type: "start" });
  expect(start).toHaveBeenCalledOnce();
  session.stop();
  expect(native.stop).toHaveBeenCalledWith(id);
  expect(end).not.toHaveBeenCalled();
  native.listener({ id, type: "text", text: "明天下午三点开会" });
  native.listener({ id, type: "end" });
  expect(text).toHaveBeenCalledWith("明天下午三点开会");
  expect(end).toHaveBeenCalledOnce();
  expect(native.remove).toHaveBeenCalledOnce();
});
it("cancellation discards late native transcripts", async () => {
  const text = vi.fn(),
    end = vi.fn();
  const c = new AbortController();
  await startOfflineSpeech(text, end, vi.fn(), { signal: c.signal });
  const id = native.start.mock.calls[0][0];
  c.abort();
  native.listener({ id, type: "text", text: "被取消" });
  native.listener({ id, type: "end" });
  expect(text).not.toHaveBeenCalled();
  expect(end).toHaveBeenCalledOnce();
  expect(native.cancel).toHaveBeenCalledWith(id);
});
it("first microphone permission grant requires a fresh hold", async () => {
  native.permission.mockResolvedValue({ granted: false });
  await expect(startOfflineSpeech(vi.fn(), vi.fn(), vi.fn())).rejects.toThrow(
    "请再长按一次",
  );
  expect(native.start).not.toHaveBeenCalled();
});
