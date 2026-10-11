import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "vite";

type Turn = { role: "system" | "user" | "assistant"; content: string };
type Relay = { baseUrl: string; model: string; apiKey: string };

export function createOracleHandler(allowLocalRelay = false) {
  const rates = new Map<string, { count: number; until: number }>();
  let active = 0;
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }
    res.setHeader("cache-control", "no-store");
    res.setHeader("content-type", "application/json; charset=utf-8");
    let acquired = false;
    try {
      const expected = process.env.APP_ORIGIN || `http://${req.headers.host}`;
      if (req.headers.origin && req.headers.origin !== expected) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "请从这片星空重新进入。" }));
        return;
      }
      if (!req.headers["content-type"]?.startsWith("application/json")) {
        res.statusCode = 415;
        res.end(JSON.stringify({ error: "请求格式不正确。" }));
        return;
      }
      const ip = req.socket.remoteAddress || "local";
      if (rates.size > 5000)
        for (const [key, value] of rates)
          if (value.until < Date.now()) rates.delete(key);
      let rate = rates.get(ip);
      if (!rate || rate.until < Date.now()) {
        rate = { count: 0, until: Date.now() + 60000 };
        rates.set(ip, rate);
      }
      if (++rate.count > 12 || active >= 20) {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: "稍等一下，再继续聊。" }));
        return;
      }
      active++;
      acquired = true;
      const body = JSON.parse(await readBody(req)) as {
        messages?: Turn[];
        relay?: Relay;
      };
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (
        !messages.length ||
        messages.length > 32 ||
        messages.some(
          (m) =>
            !m ||
            !["system", "user", "assistant"].includes(m.role) ||
            typeof m.content !== "string" ||
            m.content.length > 24000,
        )
      )
        throw new Error("这段对话太长了，试着分开说。");
      const configured = process.env.ORACLE_API_KEY
        ? {
            baseUrl: process.env.ORACLE_BASE_URL || "",
            model: process.env.ORACLE_MODEL || "",
            apiKey: process.env.ORACLE_API_KEY,
          }
        : null;
      const local =
        ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) &&
        /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(
          req.headers.host || "",
        );
      if (body.relay?.apiKey && (!allowLocalRelay || !local))
        throw new Error("请使用这片星空已连接的聊天模型。");
      const text = body.relay?.apiKey
        ? await relay(body.relay, messages)
        : configured
          ? await relay(configured, messages)
          : await cursorAsk(messages);
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ text }));
    } catch (error) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "模型没有答上来。",
        }),
      );
    } finally {
      if (acquired) active--;
    }
  };
}

export function oraclePlugin(): Plugin {
  const handle = createOracleHandler(true);
  return {
    name: "oracle",
    configureServer(server) {
      server.middlewares.use(
        "/api/oracle",
        (req, res) => void handle(req, res),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        "/api/oracle",
        (req, res) => void handle(req, res),
      );
    },
  };
}

async function relay(link: Relay, messages: Turn[]): Promise<string> {
  const url = chatUrl(link.baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${link.apiKey}`,
    },
    body: JSON.stringify({ model: link.model, messages }),
    signal: AbortSignal.timeout(120000),
  });
  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: {
      message?: { content?: string | { type?: string; text?: string }[] };
    }[];
  } | null;
  if (!response.ok) {
    throw new Error(data?.error?.message || `接口返回 ${response.status}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => part.text || "")
      .join("")
      .trim();
    if (text) return text;
  }
  throw new Error("接口没有给出正文。");
}

function chatUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed))
    throw new Error("接口地址要以 http:// 或 https:// 开头。");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

const builtinCursorKey = "";

async function cursorAsk(messages: Turn[]): Promise<string> {
  const apiKey = process.env.CURSOR_API_KEY?.trim() || builtinCursorKey;
  if (!apiKey)
    throw new Error("聊天模型还没接好。可以先留下一句话，或在菜单接入模型。");
  const sdk = (await import("@cursor/sdk")) as {
    Agent: {
      prompt: (
        prompt: string,
        options: {
          apiKey: string;
          model: { id: string };
          local: { cwd: string };
          tools: string[];
        },
      ) => Promise<{ status?: string; result?: string }>;
    };
  };
  const dir = path.join(os.tmpdir(), "shijie-suanfa-oracle");
  fs.mkdirSync(dir, { recursive: true });
  const prompt = [
    "只输出对用户的自然语言回复。遵循对话中的系统规则，不要使用工具，不要创建或修改任何文件。",
    ...messages.map(
      (message) =>
        `${message.role === "system" ? "主控" : message.role === "assistant" ? "之前的回答" : "来问"}\n${message.content}`,
    ),
  ].join("\n\n");
  const result = await sdk.Agent.prompt(prompt, {
    apiKey,
    model: { id: "auto" },
    local: { cwd: dir },
    tools: [],
  });
  const text = result.result?.trim() || "";
  if (!text || result.status === "error")
    throw new Error("Cursor 这次没有给出正文。");
  return text;
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100000) throw new Error("这段对话太长了，试着分开说。");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
