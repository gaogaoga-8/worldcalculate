import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createCommunity } from "../server/community";
import { createOracleHandler } from "../server/oraclePlugin";

const directory = mkdtempSync(join(tmpdir(), "worldcalculate-test-"));
const file = join(directory, "community.sqlite");
let service = createCommunity(file);
const server = createServer((req, res) => void service.handle(req, res));
async function listen(s: Server) {
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(s.address() as { port: number }).port}`;
}
async function close(s: Server) {
  await new Promise<void>((r) => s.close(() => r()));
}
const base = await listen(server);
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  origin?: string,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(method === "GET" ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie") || "",
  };
}
try {
  assert.equal(
    (await request("/beacons")).data.beacons.length,
    0,
    "No invented users",
  );
  assert.equal(
    (
      await request("/beacons", "POST", {
        body: "hello",
        mood: "hear",
        topic: "life",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/guest",
        "POST",
        { name: "A" },
        "",
        "https://foreign.example",
      )
    ).status,
    403,
    "Cross-origin mutations rejected",
  );
  const a = await request("/guest", "POST", { name: "访客 A" }),
    b = await request("/guest", "POST", { name: "访客 B" }),
    c = await request("/guest", "POST", { name: "访客 C" });
  const ac = a.cookie.split(";")[0],
    bc = b.cookie.split(";")[0],
    cc = c.cookie.split(";")[0];
  assert.ok(a.cookie.includes("HttpOnly") && a.cookie.includes("SameSite=Lax"));
  assert.ok(!JSON.stringify(a.data).includes("cosmos_session"));
  assert.equal(
    (await request("/session", "GET", undefined, ac)).data.user.id,
    a.data.user.id,
  );
  assert.equal(
    (await request("/guest", "POST", { name: "访客 A 的新称呼" }, ac)).data.user
      .id,
    a.data.user.id,
    "Returning guest is the same person",
  );
  const post = { body: "今天很累，想找人聊聊。", mood: "hear", topic: "work" };
  assert.equal((await request("/beacons", "POST", post, ac)).status, 200);
  const original = (await request("/beacons/mine", "GET", undefined, ac)).data
    .beacon;
  await request("/beacons", "POST", { ...post, body: "今天有一点勇气。" }, ac);
  assert.equal(
    (await request("/beacons/mine", "GET", undefined, ac)).data.beacon.id,
    original.id,
    "Same day updates one echo",
  );
  const published = (await request("/beacons", "GET", undefined, bc)).data
    .beacons;
  assert.equal(published.length, 1);
  assert.deepEqual(
    Object.keys(published[0]).sort(),
    ["at", "body", "id", "mood", "name", "topic", "userId"].sort(),
    "Only opted-in public fields",
  );
  assert.equal(
    (await request("/beacons", "GET", undefined, ac)).data.beacons.length,
    0,
    "Own beacon is not a stranger",
  );
  assert.equal(
    (await request("/beacons", "POST", { ...post, body: "x".repeat(161) }, ac))
      .status,
    400,
  );
  const invitation = await request(
    "/respond",
    "POST",
    { beaconId: published[0].id, body: "愿意听你说。" },
    bc,
  );
  assert.equal(invitation.status, 200);
  const id = invitation.data.id;
  assert.equal(
    (await request(`/threads/${id}`, "GET", undefined, cc)).status,
    404,
    "Third visitor cannot read a private invitation",
  );
  assert.equal(
    (await request(`/threads/${id}/accept`, "POST", {}, bc)).status,
    403,
    "Requester cannot consent for recipient",
  );
  assert.equal(
    (await request(`/threads/${id}/messages`, "POST", { body: "提前说话" }, bc))
      .status,
    403,
    "No conversation before mutual consent",
  );
  assert.equal(
    (
      await request(
        "/respond",
        "POST",
        { beaconId: published[0].id, body: "再发一次" },
        bc,
      )
    ).status,
    409,
    "No repeated invitations",
  );
  const inbound = (await request("/threads", "GET", undefined, ac)).data
    .threads;
  assert.equal(inbound[0].incoming, true);
  assert.equal(
    (await request(`/threads/${id}`, "GET", undefined, ac)).data.messages[0]
      .body,
    "愿意听你说。",
  );
  assert.equal(
    (await request(`/threads/${id}/accept`, "POST", {}, ac)).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/threads/${id}/messages`,
        "POST",
        { body: "谢谢，今天工作不太顺。" },
        ac,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/threads/${id}/messages`,
        "POST",
        { body: "发生什么了？" },
        bc,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request(`/threads/${id}`, "GET", undefined, bc)).data.messages
      .length,
    3,
  );
  // Reopening the database keeps real guest identities, consent and messages.
  service.close();
  service = createCommunity(file);
  assert.equal(
    (await request("/session", "GET", undefined, ac)).data.user.id,
    a.data.user.id,
  );
  assert.equal(
    (await request(`/threads/${id}`, "GET", undefined, bc)).data.status,
    "accepted",
  );
  const db = new DatabaseSync(file);
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS n FROM beacons").get() as { n: number }).n,
    1,
  );
  assert.notEqual(
    (
      db.prepare("SELECT token FROM sessions LIMIT 1").get() as {
        token: string;
      }
    ).token,
    ac.split("=")[1],
    "Only token hashes are stored",
  );
  db.close();
  await request(`/threads/${id}/block`, "POST", {}, ac);
  assert.equal(
    (await request(`/threads/${id}/messages`, "POST", { body: "blocked" }, bc))
      .status,
    404,
  );
  assert.equal(
    (await request("/threads", "GET", undefined, bc)).data.threads.length,
    0,
  );
  assert.equal(
    (await request("/beacons", "GET", undefined, bc)).data.beacons.length,
    0,
    "Block also removes discovery",
  );
  await request("/beacons/mine", "DELETE", {}, ac);
  assert.equal(
    (await request("/beacons", "GET", undefined, cc)).data.beacons.length,
    0,
    "Recall removes public echo",
  );
  await request("/logout", "POST", {}, ac);
  assert.equal(
    (await request("/session", "GET", undefined, ac)).data.user,
    null,
  );
  console.log(
    "Guest identity, real discovery, daily echo, privacy, mutual consent, messages, persistence, recall and block: passed.",
  );
} finally {
  await close(server);
  service.close();
  rmSync(directory, { recursive: true, force: true });
}

// Exercise the complete oracle HTTP transport against an isolated model fixture.
const saved = {
  url: process.env.ORACLE_BASE_URL,
  model: process.env.ORACLE_MODEL,
  key: process.env.ORACLE_API_KEY,
};
let received: any;
const fixture = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  received = JSON.parse(Buffer.concat(chunks).toString());
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      choices: [{ message: { content: "这是接口测试返回。" } }],
    }),
  );
});
const fixtureUrl = await listen(fixture);
process.env.ORACLE_BASE_URL = fixtureUrl;
process.env.ORACLE_MODEL = "test-model";
process.env.ORACLE_API_KEY = "test-only";
const oracle = createOracleHandler();
const app = createServer((req, res) => void oracle(req, res));
const oracleUrl = await listen(app);
try {
  const messages = [
    { role: "system", content: "用自然语言回应。" },
    { role: "user", content: "今天有点累。" },
  ];
  const response = await fetch(oracleUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, "这是接口测试返回。");
  assert.deepEqual(received.messages, messages);
  const forbidden = await fetch(oracleUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages,
      relay: { baseUrl: fixtureUrl, model: "test", apiKey: "test-only" },
    }),
  });
  assert.equal(
    forbidden.status,
    502,
    "Production refuses client-selected relay destinations",
  );
  console.log(
    "Configured model HTTP transport and production relay restriction: passed (fixture, not a live model evaluation).",
  );
} finally {
  await close(app);
  await close(fixture);
  for (const [key, value] of Object.entries({
    ORACLE_BASE_URL: saved.url,
    ORACLE_MODEL: saved.model,
    ORACLE_API_KEY: saved.key,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
