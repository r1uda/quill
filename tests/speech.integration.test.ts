import { beforeEach, expect, it, vi } from "vitest";
import { startSpeech } from "../src/services/speech.native";
const native = vi.hoisted(() => ({
  listeners: new Map<string, (e: any) => void>(),
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  permission: vi.fn(),
  existingPermission: vi.fn(),
  available: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-modules-core", () => ({ requireNativeModule: vi.fn() }));
vi.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: native.available,
    requestPermissionsAsync: native.permission,
    getPermissionsAsync: native.existingPermission,
    getDefaultRecognitionService: () => ({
      packageName: "phone.system.speech",
    }),
    addListener: (name: string, fn: (e: any) => void) => {
      native.listeners.set(name, fn);
      return { remove: () => native.listeners.delete(name) };
    },
    start: native.start,
    stop: native.stop,
    abort: native.abort,
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  native.listeners.clear();
  native.available.mockReturnValue(true);
  native.permission.mockResolvedValue({ granted: true });
  native.existingPermission.mockResolvedValue({ granted: true });
});
it("iOS keeps its existing native speech path", async () => {
  const onStart = vi.fn();
  const onText = vi.fn();
  const onEnd = vi.fn();
  const session = await startSpeech(onText, onEnd, vi.fn(), { onStart });
  expect(native.start).toHaveBeenCalledWith({
    lang: "zh-CN",
    interimResults: true,
    continuous: true,
  });
  native.listeners.get("start")?.({});
  expect(onStart).toHaveBeenCalledOnce();
  native.listeners.get("result")?.({
    isFinal: true,
    results: [{ transcript: "明天下午三点开会" }],
  });
  session.stop();
  expect(native.stop).toHaveBeenCalledOnce();
  native.listeners.get("end")?.({});
  expect(onEnd).toHaveBeenCalledOnce();
  expect(onText).toHaveBeenCalledWith("明天下午三点开会");
  expect(native.listeners.size).toBe(0);
});
it("cancellation during permission prevents the microphone from starting later", async () => {
  native.existingPermission.mockResolvedValue({ granted: false });
  let allow!: (v: { granted: boolean }) => void;
  native.permission.mockReturnValue(
    new Promise((r) => {
      allow = r;
    }),
  );
  const request = new AbortController();
  const pending = startSpeech(vi.fn(), vi.fn(), vi.fn(), {
    signal: request.signal,
  });
  await vi.waitFor(() => expect(native.permission).toHaveBeenCalled());
  request.abort();
  allow({ granted: true });
  await pending;
  expect(native.start).not.toHaveBeenCalled();
});
it("first permission grant requires a new hold instead of recording after the system dialog", async () => {
  native.existingPermission.mockResolvedValue({ granted: false });
  await expect(startSpeech(vi.fn(), vi.fn(), vi.fn())).rejects.toThrow(
    "麦克风权限已开启，请再长按一次说话。",
  );
  expect(native.start).not.toHaveBeenCalled();
});
it("a recognition error reports a durable readable reason and removes listeners", async () => {
  const error = vi.fn();
  const end = vi.fn();
  await startSpeech(vi.fn(), end, error);
  native.listeners.get("error")?.({
    error: "service-not-allowed",
    message: "native detail",
  });
  expect(error).toHaveBeenCalledWith(
    expect.stringContaining("没有可用的系统语音识别服务"),
  );
  expect(end).toHaveBeenCalledOnce();
  expect(native.listeners.size).toBe(0);
});
it("abort ignores stale final results and ends the session only once", async () => {
  const text = vi.fn();
  const end = vi.fn();
  const request = new AbortController();
  await startSpeech(text, end, vi.fn(), { signal: request.signal });
  const staleResult = native.listeners.get("result")!;
  const staleEnd = native.listeners.get("end")!;
  request.abort();
  staleResult({ results: [{ transcript: "旧语音" }] });
  staleEnd({});
  expect(text).not.toHaveBeenCalled();
  expect(end).toHaveBeenCalledOnce();
});
