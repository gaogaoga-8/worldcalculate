import http from "node:http";

const port = Number(process.env.PORT || 4173);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function chatUrl(base) {
  const trimmed = String(base || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) throw new Error("接口地址要以 http:// 或 https:// 开头。");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

function serverLink() {
  const apiKey = String(process.env.DEEPSEEK_API_KEY || "").trim();
  if (!apiKey) return null;
  return {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    apiKey,
    plain: true,
  };
}

async function relay(link, messages) {
  const payload = { model: link.model, messages };
  if (link.plain) payload.thinking = { type: "disabled" };
  const response = await fetch(chatUrl(link.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${link.apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `接口返回 ${response.status}`);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part) => part.text || "").join("").trim();
    if (text) return text;
  }
  throw new Error("接口没有给出正文。");
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || !req.url?.startsWith("/api/oracle")) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "没有这个接口。" }));
    return;
  }
  try {
    const body = JSON.parse(await readBody(req));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) throw new Error("没有问题。");
    const link = body.relay?.apiKey ? body.relay : serverLink();
    if (!link) throw new Error("公网页面需要在菜单里填上接口、模型和密钥。");
    const text = await relay(link, messages);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ text }));
  } catch (error) {
    res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "模型没有答上来。" }));
  }
});

server.listen(port, "127.0.0.1");
