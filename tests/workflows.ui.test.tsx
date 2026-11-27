import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import App from "../App";
import { dateKey, defaultSettings } from "../src/domain/model";
const memory = vi.hoisted(() => new Map<string, string>());
const savedDrafts = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));
vi.mock("../src/services/drafts", () => ({
  loadDrafts: async () => structuredClone(savedDrafts.value),
  persistDrafts: async (data: Record<string, unknown>) => {
    savedDrafts.value = structuredClone(data);
  },
}));
vi.mock("../src/services/background", () => ({
  cropBackground: async () => "data:image/jpeg;base64,dGVzdA==",
}));
const fakeFiles = vi.hoisted(() => ({
  pickDocument: vi.fn(),
  readBytes: vi.fn(),
  pickImage: vi.fn(),
  exportText: vi.fn(),
}));
const voice = vi.hoisted(() => ({
  text: undefined as undefined | ((s: string) => void),
  end: undefined as undefined | (() => void),
  cancel: vi.fn(),
  error: undefined as undefined | ((s: string) => void),
  gate: undefined as undefined | Promise<void>,
  stop: vi.fn(),
  startError: undefined as Error | undefined,
  deferEnd: false,
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => memory.get(k) || null,
    setItem: async (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: async (k: string) => {
      memory.delete(k);
    },
  },
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("react-native-safe-area-context", async () => {
  const R = await import("react");
  return {
    SafeAreaProvider: ({ children }: any) =>
      R.createElement("div", {}, children),
    SafeAreaView: ({ children, style }: any) =>
      R.createElement("div", {}, children),
  };
});
vi.mock("@react-native-community/slider", async () => {
  const R = await import("react");
  return { default: () => R.createElement("input", { type: "range" }) };
});
vi.mock("lucide-react-native", async () => {
  const R = await import("react");
  const names = [
    "CalendarDays",
    "ListTodo",
    "SquarePen",
    "UserRound",
    "Plus",
    "Mic",
    "X",
    "Bell",
    "MapPin",
    "Repeat2",
    "FileText",
    "Clock3",
    "Check",
    "ArrowUpRight",
    "CalendarHeart",
    "ChevronLeft",
    "ChevronRight",
    "Search",
    "FileSpreadsheet",
    "ImagePlus",
    "FileImage",
    "Settings2",
    "Palette",
    "Database",
    "ShieldCheck",
    "CloudOff",
  ];
  return Object.fromEntries(
    names.map((name) => [
      name,
      () => R.createElement("span", { "aria-hidden": true }),
    ]),
  );
});
vi.mock("../src/services/files", () => fakeFiles);
vi.mock("../src/services/speech", () => ({
  prepareSpeech: () => {},
  startSpeech: async (
    onText: (s: string) => void,
    onEnd: () => void,
    onError: (s: string) => void,
    options?: { signal?: AbortSignal; onStart?: () => void },
  ) => {
    voice.text = onText;
    voice.end = onEnd;
    voice.error = onError;
    if (voice.gate) await voice.gate;
    if (voice.startError) throw voice.startError;
    if (!options?.signal?.aborted) options?.onStart?.();
    return {
      stop() {
        voice.stop();
        if (!voice.deferEnd) onEnd();
      },
      cancel() {
        voice.cancel();
        onEnd();
      },
    };
  },
}));
vi.mock("../src/services/notifications", () => ({
  syncReminders: async () => 0,
  notificationStatus: async () => "浏览器预览",
  requestReminders: async () => true,
  openReminderSettings: async () => {},
  testReminder: async () => {},
  stopAlarm: async () => {},
}));
vi.mock("../src/services/ocr", () => ({
  recognizeImage: async () => `${dateKey(new Date())}15:00项目讨论`,
}));
beforeEach(() => {
  memory.clear();
  savedDrafts.value = {};
  voice.gate = undefined;
  voice.startError = undefined;
  voice.deferEnd = false;
  vi.clearAllMocks();
});
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
});
const saved = () => {
  const raw = JSON.parse(memory.get("qingri:data:v1") || "{}");
  if (raw.format !== "qingri-chunks-v1") return raw;
  return JSON.parse(
    Array.from(
      { length: raw.parts },
      (_, i) => memory.get(`qingri:data:v1:${raw.generation}:${i}`) || "",
    ).join(""),
  );
};
async function start(name = "林同学") {
  render(<App />);
  await screen.findByText("你好，quill。");
  if (name)
    await userEvent.type(screen.getByPlaceholderText("表格中使用的姓名"), name);
  await userEvent.click(screen.getByRole("button", { name: "先使用基础日历" }));
  await screen.findByText("quill");
}
describe("real React UI and local persistence", () => {
  it("birthday catalog and name search find birthdays outside the seven-day schedule", async () => {
    await start();
    await userEvent.click(
      screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "一句话日程" }),
      "添加张三的生日，他是2000年5月6日出生的",
    );
    await userEvent.click(screen.getByRole("button", { name: "添加到日历" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "生日与纪念日" }),
    );
    await screen.findByText("张三的生日");
    expect(screen.getByText("公历5月6日 · 每年")).toBeDefined();
    await userEvent.type(
      screen.getByRole("textbox", { name: "搜索日程" }),
      "张三生日",
    );
    expect(screen.getByText("张三的生日")).toBeDefined();
    expect(saved().events[0]).toMatchObject({
      kind: "birthday",
      repeat: "yearly",
      allDay: true,
      birthYear: 2000,
    });
  });
  it("quick-add OFF remains off even when the sentence asks for a reminder", async () => {
    await start();
    await userEvent.click(
      screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }),
    );
    expect(screen.getByText("关闭")).toBeDefined();
    await userEvent.type(
      screen.getByRole("textbox", { name: "一句话日程" }),
      "明天下午三点开会 提前十分钟提醒",
    );
    await userEvent.click(screen.getByRole("button", { name: "添加到日历" }));
    await waitFor(() => expect(saved().events).toHaveLength(1));
    expect(saved().events[0].reminder).toBe(false);
  });
  it("default appearance restores immediately and survives reopening", async () => {
    await start();
    await userEvent.click(screen.getByRole("button", { name: "我的" }));
    await userEvent.click(screen.getByText("背景与外观"));
    await userEvent.click(screen.getByRole("button", { name: "浅紫" }));
    await userEvent.click(screen.getByRole("button", { name: "保存外观" }));
    await waitFor(() =>
      expect(saved().settings.appearance.accent).toBe("purple"),
    );
    await userEvent.click(screen.getByText("背景与外观"));
    await userEvent.click(screen.getByRole("button", { name: "恢复默认外观" }));
    await waitFor(() =>
      expect(saved().settings.appearance).toEqual(defaultSettings.appearance),
    );
    cleanup();
    render(<App />);
    await screen.findByText("quill");
    expect(saved().settings.appearance).toEqual(defaultSettings.appearance);
  });
  it("the month title opens a year/month selector and jumps directly to the chosen month", async () => {
    await start();
    const current = new Date();
    await userEvent.click(
      screen.getByRole("button", { name: /选择年月，当前/ }),
    );
    await screen.findByText("选择年月");
    await userEvent.click(screen.getByRole("button", { name: "选择年份" }));
    await userEvent.click(
      screen.getByRole("button", {
        name: `选择${current.getFullYear() + 1}年`,
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "选择2月" }));
    expect(screen.queryByText("选择年月")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: `选择年月，当前${current.getFullYear() + 1}年2月`,
      }),
    ).toBeDefined();
    const day = Math.min(
      current.getDate(),
      new Date(current.getFullYear() + 1, 2, 0).getDate(),
    );
    expect(screen.getByText(new RegExp(`^2月${day}日`))).toBeDefined();
  });
  it("chooses GPT or Claude and a model without typing either name or service URL", async () => {
    await start();
    await userEvent.click(screen.getByRole("button", { name: "我的" }));
    await userEvent.click(screen.getByText("AI 设置"));
    await userEvent.click(
      screen.getByRole("button", { name: "选择大模型服务" }),
    );
    for (const label of [
      "DeepSeek（DS）",
      "智谱 GLM",
      "OpenAI / GPT",
      "Anthropic / Claude",
      "Google Gemini",
      "豆包 / 火山方舟",
      "腾讯混元",
      "百度千帆 / 文心",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeDefined();
    }
    await userEvent.click(screen.getByRole("button", { name: "OpenAI / GPT" }));
    expect(screen.queryByRole("textbox", { name: "API 服务地址" })).toBeNull();
    expect(screen.getByRole("button", { name: "gpt-5.4-mini" })).toBeDefined();
    await userEvent.type(screen.getByLabelText("API Key"), "dummy-gpt-key");
    await userEvent.click(screen.getByRole("button", { name: "OpenAI / GPT" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Anthropic / Claude" }),
    );
    expect(screen.getByLabelText("API Key")).toHaveProperty("value", "");
    await userEvent.click(
      screen.getByRole("button", { name: "claude-sonnet-4-6" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "claude-opus-5-5" }),
    );
    await userEvent.type(screen.getByLabelText("API Key"), "dummy-claude-key");
    await userEvent.click(screen.getByLabelText("启用AI"));
    await userEvent.click(screen.getByRole("button", { name: "保存 AI 设置" }));
    await waitFor(() =>
      expect(saved().settings.ai.model).toBe("claude-opus-5-5"),
    );
    expect(saved().settings.ai.url).toBe("https://api.anthropic.com/v1");
    expect(saved().settings.ai.protocol).toBe("anthropic");
    expect(JSON.stringify(saved())).not.toContain("dummy-claude-key");
  });
  it("refreshed models can be selected and saved without typing a model ID", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: "new-chat-model" }] })),
      );
    try {
      await start();
      await userEvent.click(screen.getByRole("button", { name: "我的" }));
      await userEvent.click(screen.getByText("AI 设置"));
      await userEvent.click(
        screen.getByRole("button", { name: "选择大模型服务" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "DeepSeek（DS）" }),
      );
      await userEvent.type(screen.getByLabelText("API Key"), "dummy-key");
      await userEvent.click(
        screen.getByRole("button", { name: "刷新模型列表" }),
      );
      await screen.findByText("已获取 1 个模型，点模型名称即可选择");
      await userEvent.click(
        screen.getByRole("button", { name: "deepseek-flash" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "new-chat-model" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "保存 AI 设置" }),
      );
      await waitFor(() =>
        expect(saved().settings.ai.model).toBe("new-chat-model"),
      );
      expect(saved().settings.ai.models).toEqual(["new-chat-model"]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      fetchMock.mockRestore();
    }
  });
  it("unfinished manual forms survive tab changes and a complete reload", async () => {
    await start();
    await userEvent.click(screen.getByRole("button", { name: "普通添加" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "标题" }),
      "还没填完的实验安排",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "备注（选填）" }),
      "明天补充地点",
    );
    await userEvent.click(screen.getByLabelText("日程"));
    await userEvent.click(screen.getByRole("button", { name: "普通添加" }));
    expect(screen.getByRole("textbox", { name: "标题" })).toHaveProperty(
      "value",
      "还没填完的实验安排",
    );
    await waitFor(() => expect(savedDrafts.value["manual:new"]).toBeDefined());
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    render(<App />);
    await screen.findByText("quill");
    await userEvent.click(screen.getByRole("button", { name: "普通添加" }));
    expect(
      screen.getByRole("textbox", { name: "备注（选填）" }),
    ).toHaveProperty("value", "明天补充地点");
    await userEvent.click(screen.getByRole("button", { name: "保存日程" }));
    await screen.findByText("还没填完的实验安排");
    await waitFor(() =>
      expect(savedDrafts.value["manual:new"]).toBeUndefined(),
    );
  });
  it("quick text draft is restored after closing and reopening", async () => {
    await start();
    await userEvent.click(
      screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "一句话日程" }),
      "明天要补充的事",
    );
    await userEvent.click(screen.getByLabelText("关闭快速添加"));
    await userEvent.click(
      screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }),
    );
    expect(screen.getByRole("textbox", { name: "一句话日程" })).toHaveProperty(
      "value",
      "明天要补充的事",
    );
  });
  it("image instructions survive a trip to AI settings", async () => {
    await start();
    await userEvent.click(screen.getByRole("button", { name: "普通添加" }));
    await userEvent.click(screen.getByRole("button", { name: "图片" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "补充要求（选填）" }),
      "只识别我的活动",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "使用补充要求需要配置 AI" }),
    );
    await screen.findByText("选择大模型服务");
    await userEvent.click(screen.getByRole("button", { name: "普通添加" }));
    expect(
      screen.getByRole("textbox", { name: "补充要求（选填）" }),
    ).toHaveProperty("value", "只识别我的活动");
  });
  it("onboards, adds one sentence, and undoes the exact saved item", async () => {
    await start();
    expect(saved().settings.name).toBe("林同学");
    await userEvent.click(
      screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "一句话日程" }),
      "明天下午三点开会",
    );
    await userEvent.click(screen.getByRole("button", { name: "添加到日历" }));
    await screen.findByText("开会");
    expect(saved().events).toHaveLength(1);
    expect(saved().events[0].start).toContain("T15:00");
    await userEvent.click(screen.getByRole("button", { name: "撤销" }));
    await waitFor(() => expect(saved().events).toHaveLength(0));
  });
  it("manual add and edit survive a full unmount and reload", async () => {
    await start();
    await userEvent.click(screen.getByRole("button", { name: "普通添加" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "标题" }),
      "整理机器人实验记录",
    );
    await userEvent.click(screen.getByRole("button", { name: "保存日程" }));
    await screen.findByText("整理机器人实验记录");
    await userEvent.click(screen.getByText("整理机器人实验记录"));
    await userEvent.click(screen.getByRole("button", { name: "编辑日程" }));
    const field = screen.getByRole("textbox", { name: "标题" });
    await userEvent.clear(field);
    await userEvent.type(field, "复查实验记录");
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
    await screen.findByText("复查实验记录");
    cleanup();
    render(<App />);
    await screen.findByText("复查实验记录");
    expect(saved().events).toHaveLength(1);
  });
  it("missing API preserves image instructions and blocks AI execution", async () => {
    await start();
    await userEvent.click(screen.getByRole("button", { name: "普通添加" }));
    await userEvent.click(screen.getByRole("button", { name: "图片" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "补充要求（选填）" }),
      "只记录报名截止",
    );
    await screen.findByText("使用补充要求需要配置 AI");
    expect(
      (
        screen.getByRole("textbox", {
          name: "补充要求（选填）",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("只记录报名截止");
    expect(
      screen
        .getByRole("button", { name: "按补充要求使用 AI 识别" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    await userEvent.click(screen.getByText("清空补充，使用基础识别"));
    expect(
      (
        screen.getByRole("textbox", {
          name: "补充要求（选填）",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("");
  });
  it("imports an actual XLSX through name filtering into persistent events", async () => {
    const rows = [
      ["日期", "时间", "事项", "姓名"],
      [dateKey(new Date()), "09:00", "本人值班", "林同学"],
      [dateKey(new Date()), "15:00", "别人值班", "其他人"],
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "安排");
    fakeFiles.pickDocument.mockResolvedValue({
      name: "安排表.xlsx",
      uri: "fixture",
      size: 200,
    });
    fakeFiles.readBytes.mockResolvedValue(
      XLSX.write(book, { type: "array", bookType: "xlsx" }),
    );
    await start();
    await userEvent.click(screen.getByRole("button", { name: "普通添加" }));
    await userEvent.click(screen.getByRole("button", { name: "Excel" }));
    await userEvent.click(screen.getByText("选择 Excel 或 CSV 表格"));
    await screen.findByText("安排表.xlsx");
    expect(
      screen.getByRole("switch", { name: "只导入我的安排" }),
    ).toHaveProperty("checked", true);
    await userEvent.click(screen.getByRole("button", { name: "开始基础识别" }));
    await screen.findByText("识别预览 · 已选 1 项");
    await userEvent.click(
      screen.getByRole("button", { name: "添加 1 项到日历" }),
    );
    await screen.findByText("本人值班");
    expect(saved().events).toHaveLength(1);
    expect(saved().events[0].title).toBe("本人值班");
  });
  it("saves lunar birthday as a lunar annual recurrence", async () => {
    await start();
    await userEvent.click(screen.getByRole("button", { name: "普通添加" }));
    await userEvent.click(screen.getByRole("button", { name: "生日" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "谁的生日" }),
      "妈妈",
    );
    await userEvent.click(screen.getByRole("button", { name: "农历生日" }));
    await userEvent.click(
      screen.getByRole("button", { name: "按公历日期换算" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "出生年份（选填）" }),
      "1975",
    );
    await userEvent.click(screen.getByRole("button", { name: "保存生日" }));
    await screen.findByText("妈妈的生日");
    expect(saved().events[0].lunar.birthYear).toBe(1975);
    expect(saved().events[0].repeat).toBe("yearly");
  });
  it("profile and appearance persist and keys are not in backup data", async () => {
    await start();
    await userEvent.click(screen.getByRole("button", { name: "我的" }));
    await userEvent.click(screen.getByText("个人资料"));
    const f = screen.getByRole("textbox", { name: "姓名别名（选填）" });
    await userEvent.type(f, "Xiao Lin");
    await userEvent.click(screen.getByRole("button", { name: "保存个人资料" }));
    await waitFor(() => expect(saved().settings.aliases).toBe("Xiao Lin"));
    await userEvent.click(screen.getByText("背景与外观"));
    await userEvent.click(screen.getByRole("button", { name: "浅紫" }));
    await userEvent.click(screen.getByRole("button", { name: "保存外观" }));
    await waitFor(() =>
      expect(saved().settings.appearance.accent).toBe("purple"),
    );
    expect(JSON.stringify(saved())).not.toContain("apiKey");
  });
  it("per-event reminder changes are persisted without removing the event", async () => {
    await start();
    await userEvent.click(
      screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "一句话日程" }),
      "明天下午三点项目讨论",
    );
    await userEvent.click(screen.getByRole("button", { name: "添加到日历" }));
    await screen.findByText("项目讨论");
    await userEvent.click(
      screen.getByRole("switch", { name: "项目讨论的提醒" }),
    );
    await waitFor(() => expect(saved().events[0].reminder).toBe(true));
    await userEvent.click(
      screen.getByRole("switch", { name: "项目讨论的提醒" }),
    );
    await waitFor(() => expect(saved().events[0].reminder).toBe(false));
    expect(saved().events).toHaveLength(1);
    expect(screen.getByText("项目讨论")).toBeDefined();
  });
  it("the reminder control inside quick-add rows is clickable", async () => {
    await start();
    await userEvent.click(
      screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }),
    );
    const toggle = screen.getByRole("switch", { name: "提醒开关" });
    await userEvent.click(toggle);
    expect(toggle).toHaveProperty("checked", true);
    await userEvent.type(
      screen.getByRole("textbox", { name: "一句话日程" }),
      "明天下午三点提醒测试",
    );
    await userEvent.click(screen.getByRole("button", { name: "添加到日历" }));
    await screen.findByText("提醒测试");
    expect(saved().events[0].reminder).toBe(true);
  });
  it("right sliding WHILE holding confirms on release and supports undo", async () => {
    await start();
    const user = userEvent.setup();
    const quick = screen.getByRole("button", {
      name: "快速添加，轻点输入，长按说话",
    });
    await user.pointer({ target: quick, coords: {clientX: 200, clientY: 500, pageX: 200, pageY: 500}, keys: "[MouseLeft>]" });
    await screen.findByText("正在听…");
    expect(screen.queryByRole("textbox", {name:"一句话日程"})).toBeNull();
    expect(screen.queryByRole("button", {name:"添加到日历"})).toBeNull();
    voice.text?.("明天下午四点语音讨论");
    fireEvent.touchMove(quick, { changedTouches: [{identifier:1,pageX:300,pageY:500,clientX:300,clientY:500}], touches: [{identifier:1,pageX:300,pageY:500,clientX:300,clientY:500}] });
    expect(screen.getByText("已选确认，松手后识别并添加")).toBeDefined();
    expect(saved().events).toHaveLength(0);
    await user.pointer({ keys: "[/MouseLeft]" });
    await screen.findByText("语音讨论");
    expect(saved().events[0].start).toContain("T16:00");
    await userEvent.click(screen.getByRole("button", { name: "撤销" }));
    await waitFor(() => expect(saved().events).toHaveLength(0));
  });
  it("voice correction changes the recognized text before it is saved", async () => {
    await start();
    const user = userEvent.setup();
    await user.pointer({ target: screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }), coords: {clientX:200,clientY:500,pageX:200,pageY:500}, keys: "[MouseLeft>]" });
    await screen.findByText("正在听…");
    voice.text?.("明天下午四点错误名字");
    fireEvent.touchMove(screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }), {changedTouches:[{pageX:100,pageY:500,clientX:100,clientY:500,identifier:1}],touches:[{pageX:100,pageY:500,clientX:100,clientY:500,identifier:1}]});
    await user.pointer({ keys: "[/MouseLeft]" });
    await screen.findByRole("textbox", { name: "一句话日程" });
    const input = screen.getByRole("textbox", { name: "一句话日程" });
    await user.clear(input);
    await user.type(input, "明天下午三点正确名字");
    expect(saved().events).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "添加到日历" }));
    await screen.findByText("正确名字");
    expect(saved().events[0].start).toContain("T15:00");
  });
  it("closing an unconfirmed transcript preserves it as a draft without adding", async () => {
    await start();
    const user = userEvent.setup();
    await user.pointer({ target: screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }), keys: "[MouseLeft>]" });
    await screen.findByText("正在听…");
    voice.text?.("明天下午四点待核对");
    await user.pointer({ keys: "[/MouseLeft]" });
    await screen.findByRole("textbox", { name: "一句话日程" });
    await user.click(screen.getByLabelText("关闭快速添加"));
    await user.click(screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }));
    expect(screen.getByRole("textbox", { name: "一句话日程" })).toHaveProperty("value", "明天下午四点待核对");
    expect(saved().events).toHaveLength(0);
  });
  it("right-release waits for the final transcript, not an early partial result", async () => {
    voice.deferEnd = true;
    await start();
    const user = userEvent.setup();
    const quick = screen.getByRole("button", {name:"快速添加，轻点输入，长按说话"});
    await user.pointer({target:quick,coords:{pageX:200,pageY:500,clientX:200,clientY:500},keys:"[MouseLeft>]"});
    await screen.findByText("正在听…");
    voice.text?.("明天下午三点尚未结束");
    fireEvent.touchMove(quick,{changedTouches:[{pageX:300,pageY:500}],touches:[{pageX:300,pageY:500}]});
    await user.pointer({keys:"[/MouseLeft]"});
    await screen.findByText("正在识别…");
    expect(saved().events).toHaveLength(0);
    voice.text?.("明天下午四点完整结果");voice.end?.();
    await screen.findByText("完整结果");
    expect(saved().events[0].start).toContain("T16:00");
  });
  it("moving back to the center before release disarms confirmation", async () => {
    await start();const user=userEvent.setup();
    const quick=screen.getByRole("button",{name:"快速添加，轻点输入，长按说话"});
    await user.pointer({target:quick,coords:{pageX:200,pageY:500,clientX:200,clientY:500},keys:"[MouseLeft>]"});
    await screen.findByText("正在听…");voice.text?.("明天下午四点只保留文字");
    fireEvent.touchMove(quick,{changedTouches:[{pageX:300,pageY:500}],touches:[{pageX:300,pageY:500}]});
    fireEvent.touchMove(quick,{changedTouches:[{pageX:200,pageY:500}],touches:[{pageX:200,pageY:500}]});
    await user.pointer({keys:"[/MouseLeft]"});
    await screen.findByRole("textbox",{name:"一句话日程"});
    expect(saved().events).toHaveLength(0);
  });
  it("a backdrop touch delivered during recording or its release does not dismiss the voice window", async () => {
    await start();
    const user = userEvent.setup();
    await user.pointer({
      target: screen.getByRole("button", {
        name: "快速添加，轻点输入，长按说话",
      }),
      keys: "[MouseLeft>]",
    });
    await screen.findByText("正在听…");
    fireEvent.click(screen.getByLabelText("收起快速添加"));
    expect(screen.getByText("正在听…")).toBeDefined();
    voice.error?.("手机语音服务暂不可用");
    voice.end?.();
    await screen.findByText("手机语音服务暂不可用");
    await user.pointer({ keys: "[/MouseLeft]" });
    fireEvent.click(screen.getByLabelText("收起快速添加"));
    expect(screen.getByText("手机语音服务暂不可用")).toBeDefined();
    expect(saved().events).toHaveLength(0);
  });
  it("startup failure stays visible even if the original finger is held beyond the initial backdrop guard", async () => {
    voice.startError = new Error("当前手机没有识别服务");
    await start();
    const user = userEvent.setup();
    await user.pointer({
      target: screen.getByRole("button", {
        name: "快速添加，轻点输入，长按说话",
      }),
      keys: "[MouseLeft>]",
    });
    await screen.findByText("当前手机没有识别服务");
    await new Promise((resolve) => setTimeout(resolve, 700));
    fireEvent.click(screen.getByLabelText("收起快速添加"));
    expect(screen.getByText("当前手机没有识别服务")).toBeDefined();
    await user.pointer({ keys: "[/MouseLeft]" });
    fireEvent.click(screen.getByLabelText("收起快速添加"));
    expect(screen.getByText("当前手机没有识别服务")).toBeDefined();
    expect(saved().events).toHaveLength(0);
  });
  it("native touch release arriving on the new overlay stops speech without dismissing an incomplete sentence", async () => {
    await start();
    const user = userEvent.setup();
    await user.pointer({
      target: screen.getByRole("button", {
        name: "快速添加，轻点输入，长按说话",
      }),
      keys: "[MouseLeft>]",
    });
    await screen.findByText("正在听…");
    voice.text?.("我要开个会");
    fireEvent.touchEnd(screen.getByLabelText("收起快速添加"), {
      touches: [],
      changedTouches: [
        { identifier: 1, pageX: 0, pageY: 0, clientX: 0, clientY: 0, force: 0 },
      ],
    });
    await waitFor(() => expect(voice.stop).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByLabelText("收起快速添加"));
    expect(screen.getByRole("textbox", { name: "一句话日程" })).toHaveProperty(
      "value",
      "我要开个会",
    );
    expect(saved().events).toHaveLength(0);
    await user.pointer({ keys: "[/MouseLeft]" });
  });
  it("closing while microphone permission is pending prevents late voice results and reopening", async () => {
    let ready!: () => void;
    voice.gate = new Promise<void>((resolve) => {
      ready = resolve;
    });
    await start();
    const user = userEvent.setup();
    await user.pointer({
      target: screen.getByRole("button", {
        name: "快速添加，轻点输入，长按说话",
      }),
      keys: "[MouseLeft>]",
    });
    await screen.findByText("正在准备麦克风…");
    await user.click(screen.getByLabelText("关闭快速添加"));
    ready();
    await waitFor(() => expect(voice.cancel).toHaveBeenCalled());
    voice.text?.("明天下午三点不该添加");
    voice.end?.();
    expect(screen.queryByRole("textbox", { name: "一句话日程" })).toBeNull();
    expect(saved().events).toHaveLength(0);
  });
  it("release before permission resolves preserves the previous quick draft and never adds late speech", async () => {
    let ready!: () => void;
    voice.gate = new Promise<void>((resolve) => {
      ready = resolve;
    });
    await start();
    await userEvent.click(
      screen.getByRole("button", { name: "快速添加，轻点输入，长按说话" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "一句话日程" }),
      "还没填完的内容",
    );
    const user = userEvent.setup();
    await user.pointer({
      target: screen.getByRole("button", { name: "按住说话" }),
      keys: "[MouseLeft>]",
    });
    await screen.findByText("正在准备麦克风…");
    await user.pointer({ keys: "[/MouseLeft]" });
    await screen.findByText("麦克风还在准备时已松开，请再长按一次说话。");
    ready();
    await waitFor(() => expect(voice.cancel).toHaveBeenCalled());
    voice.text?.("明天下午三点不该添加");
    voice.end?.();
    expect(screen.getByRole("textbox", { name: "一句话日程" })).toHaveProperty(
      "value",
      "还没填完的内容",
    );
    expect(saved().events).toHaveLength(0);
  });
  it("cancelling voice capture while holding does not add an event", async () => {
    await start();
    const user = userEvent.setup();
    const quick = screen.getByRole("button", {
      name: "快速添加，轻点输入，长按说话",
    });
    await user.pointer({ target: quick, keys: "[MouseLeft>]" });
    await screen.findByText("正在听…");
    voice.text?.("明天下午四点不该添加");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(voice.cancel).toHaveBeenCalled());
    await user.pointer({ keys: "[/MouseLeft]" });
    expect(saved().events).toHaveLength(0);
  });
});
