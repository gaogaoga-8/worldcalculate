import { Capacitor } from "@capacitor/core";
import { readModel } from "./settings";
import type { OracleTurn } from "./prompt";

export async function askOracle(messages: OracleTurn[]): Promise<string> {
  const link = readModel();
  const baseUrl = link.baseUrl.trim();
  const model = link.model.trim();
  const apiKey = link.apiKey.trim();
  const filled = [baseUrl, model, apiKey].filter(Boolean).length;
  if (Capacitor.isNativePlatform()) {
    if (filled !== 3) throw new Error("这台手机没有接上模型。打开菜单，把接口、模型和密钥三项都填上再问。");
    return askRelay(baseUrl, model, apiKey, messages);
  }
  if (filled > 0 && filled < 3) {
    throw new Error("接口、模型和密钥要一起填。留空则用本机的 Cursor。");
  }
  const response = await fetch("/api/oracle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages,
      relay: filled === 3 ? { baseUrl, model, apiKey } : undefined,
    }),
  });
  const data = await response.json().catch(() => ({})) as { text?: string; error?: string };
  if (!response.ok) throw new Error(data.error || "模型没有答上来。");
  if (!data.text?.trim()) throw new Error("模型没有给出正文。");
  return data.text.trim();
}

async function askRelay(baseUrl: string, model: string, apiKey: string, messages: OracleTurn[]): Promise<string> {
  const response = await fetch(chatUrl(baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  const data = await response.json().catch(() => null) as {
    error?: { message?: string };
    choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[];
  } | null;
  if (!response.ok) throw new Error(data?.error?.message || `接口返回 ${response.status}`);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part) => part.text || "").join("").trim();
    if (text) return text;
  }
  throw new Error("接口没有给出正文。");
}

function chatUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) throw new Error("接口地址要以 http:// 或 https:// 开头。");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}
