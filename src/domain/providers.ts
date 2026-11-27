import { Settings } from "./model";

export interface AIProvider {
  id: string;
  label: string;
  url: string;
  models: string[];
  protocol?: "anthropic";
  aliases?: string[];
}

// Official service endpoints. Keys are never used to guess or probe providers.
// Model IDs are starter choices; the authenticated model list can be refreshed.
export const providers: AIProvider[] = [
  { id: "deepseek", label: "DeepSeek（DS）", url: "https://api.deepseek.com", models: ["deepseek-flash", "deepseek-v4-pro"], aliases: ["深度求索"] },
  { id: "glm", label: "智谱 GLM", url: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-5.3-flash", "glm-5.3", "glm-4.7"], aliases: ["智谱清言"] },
  { id: "openai", label: "OpenAI / GPT", url: "https://api.openai.com/v1", models: ["gpt-5.4-mini", "gpt-6.1-sol", "gpt-6-astra", "gpt-5.4"], aliases: ["ChatGPT"] },
  { id: "anthropic", label: "Anthropic / Claude", url: "https://api.anthropic.com/v1", models: ["claude-sonnet-4-6", "claude-opus-5-5", "claude-haiku-4-5"], protocol: "anthropic" },
  { id: "gemini", label: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai", models: ["gemini-3.8-flash"] },
  { id: "qwen", label: "通义千问（国内）", url: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen-plus", "qwen-flash", "qwen-vl-plus"], aliases: ["阿里云", "Qwen", "百炼"] },
  { id: "qwen-intl", label: "通义千问（新加坡）", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", models: ["qwen-plus", "qwen-flash", "qwen-vl-plus"] },
  { id: "kimi", label: "月之暗面 Kimi", url: "https://api.moonshot.cn/v1", models: ["kimi-k3.1-pro", "kimi-k3.1-pro-highspeed"], aliases: ["Moonshot"] },
  { id: "minimax", label: "MiniMax", url: "https://api.minimax.cn/v1", models: ["MiniMax-M3.1-Flash", "MiniMax-M3", "MiniMax-M2.7"] },
  { id: "grok", label: "xAI / Grok", url: "https://api.x.ai/v1", models: ["grok-4.7"] },
  { id: "siliconflow", label: "硅基流动", url: "https://api.siliconflow.cn/v1", models: ["deepseek-ai/DeepSeek-V4-Flash", "moonshotai/Kimi-K2.7-Code"], aliases: ["SiliconFlow"] },
  { id: "doubao", label: "豆包 / 火山方舟", url: "https://ark.cn-beijing.volces.com/api/v3", models: ["doubao-seed-2-1-pro-260915", "doubao-seed-2-0-lite-260215"], aliases: ["字节跳动", "Doubao"] },
  { id: "hunyuan", label: "腾讯混元", url: "https://api.hunyuan.cloud.tencent.com/v1", models: ["hunyuan-turbos-latest"], aliases: ["Hunyuan"] },
  { id: "qianfan", label: "百度千帆 / 文心", url: "https://qianfan.baidubce.com/v2", models: ["ernie-4.5-turbo-128k"], aliases: ["ERNIE", "Baidu"] },
];

export function providerFor(config: Settings["ai"]): AIProvider | undefined {
  const base = config.url.trim().replace(/\/(?:chat\/completions|messages)\/?$/, "").replace(/\/$/, "");
  // Match the saved URL too, so an old/custom endpoint is never silently replaced.
  return providers.find((p) => p.url === base);
}

export function selectProvider(id: string, current: Settings["ai"]): Settings["ai"] {
  const p = providers.find((p) => p.id === id);
  if (!p) return { ...current, provider: "custom" };
  return { enabled: current.enabled, provider: p.id, url: p.url, model: p.models[0], protocol: p.protocol || "chat", models: [] };
}

export function modelChoices(config: Settings["ai"]): string[] {
  return [...new Set([config.model, ...(config.models || []), ...(providerFor(config)?.models || [])].filter(Boolean))];
}
