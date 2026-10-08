import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "vite";

type Turn = { role: "system" | "user" | "assistant"; content: string };
type Relay = { baseUrl: string; model: string; apiKey: string };

export function oraclePlugin(): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }
    try {
      const body = JSON.parse(await readBody(req)) as {
        messages?: Turn[];
        relay?: Relay;
      };
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (!messages.length) throw new Error("没有问题。");
      const text = body.relay?.apiKey
        ? await relay(body.relay, messages)
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
    }
  };
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
    "只输出命理回答的正文。不要使用工具，不要创建或修改任何文件。",
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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
