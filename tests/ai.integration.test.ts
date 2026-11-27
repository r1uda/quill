import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  recognizeAI,
  endpoint,
  listModels,
  testConnection,
} from "../src/services/ai";
import {
  providers,
  selectProvider,
  providerFor,
  modelChoices,
} from "../src/domain/providers";
import { validateBackup } from "../src/domain/backup";
import { defaultSettings } from "../src/domain/model";
vi.mock("../src/services/storage", () => ({
  getApiKey: async () => "unit-test-key",
}));
const config = {
  enabled: true,
  url: "https://calendar-api.example/v1",
  model: "example-model",
};
beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
it("AI cannot turn a clearly specified birthday into a one-off birth-year task", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                events: [
                  {
                    title: "张三的生日",
                    kind: "event",
                    repeat: "none",
                    allDay: false,
                    start: "2000-05-06T09:00",
                  },
                ],
                questions: [],
              }),
            },
          },
        ],
      }),
    ),
  );
  const result = await recognizeAI(config, {
    text: "添加张三的生日，他是2000年5月6日出生的",
  });
  expect(result.events[0]).toMatchObject({
    kind: "birthday",
    repeat: "yearly",
    allDay: true,
    birthYear: 2000,
    person: "张三",
  });
});
afterEach(() => vi.unstubAllGlobals());
it("all presets supply official URLs and selectable models without changing legacy custom endpoints", () => {
  expect(providers.length).toBeGreaterThanOrEqual(13);
  for (const p of providers) {
    const selected = selectProvider(p.id, config);
    expect(selected.url).toBe(p.url);
    expect(endpoint(selected.url)).toMatch(/^https:/);
    expect(modelChoices(selected)).toContain(p.models[0]);
    expect(providerFor(selected)?.id).toBe(p.id);
  }
  expect(providerFor(config)).toBeUndefined();
  expect(config.url).toBe("https://calendar-api.example/v1");
});
it("Claude uses its messages protocol with a system prompt and correctly encoded image", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        content: [{ type: "text", text: '{"events":[],"questions":[]}' }],
      }),
    ),
  );
  const claude = selectProvider("anthropic", config);
  await recognizeAI(claude, {
    text: "测试",
    image: "data:image/png;base64,dGVzdA==",
  });
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe("https://api.anthropic.com/v1/messages");
  expect(init?.headers).toMatchObject({ "anthropic-version": "2026-10-21" });
  const body = JSON.parse(String(init?.body));
  expect(body.system).toContain("日历提取器");
  expect(body.messages[0].content[1]).toEqual({
    type: "image",
    source: { type: "base64", media_type: "image/png", data: "dGVzdA==" },
  });
  expect(body.messages.some((m: any) => m.role === "system")).toBe(false);
});
it("model refresh only calls the selected service and persists validated choices without credentials", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        data: [
          { id: "gpt-example-new" },
          { id: "text-embedding-example" },
          { id: "gpt-example-new" },
        ],
      }),
    ),
  );
  const selected = selectProvider("openai", config);
  const models = await listModels(selected, "test-only-secret");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
    "https://api.openai.com/v1/models",
  );
  expect(models).toEqual(["gpt-example-new"]);
  const restored = validateBackup({
    version: 1,
    events: [],
    settings: {
      ...defaultSettings,
      ai: { ...selected, models, key: "test-only-secret" },
    },
  });
  expect(restored.settings.ai.models).toEqual(models);
  expect(JSON.stringify(restored)).not.toContain("test-only-secret");
});
it("model refresh needs a key and a failed refresh leaves built-in choices usable", async () => {
  const selected = selectProvider("deepseek", config);
  await expect(listModels(selected, "")).rejects.toThrow(/API Key/);
  expect(fetch).not.toHaveBeenCalled();
  vi.mocked(fetch).mockResolvedValue(new Response("", { status: 404 }));
  await expect(listModels(selected, "test-only-key")).rejects.toThrow(
    /内置模型/,
  );
  expect(modelChoices(selected)).toContain("deepseek-flash");
});
it("GPT connection avoids unsupported sampling and legacy token parameters", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] })),
  );
  await testConnection(selectProvider("openai", config), "test-only-key");
  const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
  expect(body).not.toHaveProperty("temperature");
  expect(body).not.toHaveProperty("max_tokens");
});
it("rejects untrusted URL formats without making a request", () => {
  expect(() => endpoint("javascript:alert(1)")).toThrow();
  expect(() => endpoint("https://user:secret@example.com")).toThrow();
  expect(() => endpoint("https://example.com/v1?key=secret")).toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("validates AI dates and never accepts impossible dates", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                events: [
                  {
                    title: "错误日期",
                    start: "2026-02-30T15:00",
                    kind: "event",
                    repeat: "none",
                    minutesBefore: 10,
                  },
                ],
                questions: [],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    ),
  );
  await expect(recognizeAI(config, { text: "测试" })).rejects.toThrow(
    /日期或时间不存在/,
  );
});
it("assigns its own IDs so model output cannot replace existing event IDs", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                events: [
                  {
                    id: "existing-user-event",
                    title: "讨论",
                    start: "2026-10-30T15:00",
                    kind: "event",
                    repeat: "none",
                    minutesBefore: 10,
                  },
                ],
                questions: [],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    ),
  );
  const r = await recognizeAI(config, { text: "测试" });
  expect(r.events[0].id).not.toBe("existing-user-event");
  const call = vi.mocked(fetch).mock.calls[0];
  expect(call[0]).toBe("https://calendar-api.example/v1/chat/completions");
  expect((call[1]?.headers as Record<string, string>).Authorization).toBe(
    "Bearer unit-test-key",
  );
  expect(String(call[1]?.body)).not.toContain("unit-test-key");
});
it("cancels an in-flight provider request", async () => {
  vi.mocked(fetch).mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  );
  const controller = new AbortController();
  const request = recognizeAI(config, { text: "测试" }, controller.signal);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  controller.abort();
  await expect(request).rejects.toThrow("请求已取消");
});
