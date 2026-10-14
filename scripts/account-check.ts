import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createCommunity } from "../server/community";

const service = createCommunity(":memory:");
const person = {
  name: "测试",
  gender: "female",
  time: { year: 1996, month: 3, day: 21, hour: 10, minute: 30 },
  place: { name: "德州市", longitude: 116.3, latitude: 37.4, timezone: 8 },
  hourUnknown: false,
};

function call(method: string, path: string, body?: unknown, cookie = "") {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(stream, {
    method,
    url: path,
    headers: {
      host: "127.0.0.1:5176",
      origin: "http://127.0.0.1:5176",
      "content-type": "application/json",
      cookie,
    },
    socket: { remoteAddress: "203.0.113.8" },
  });
  return new Promise<{ status: number; cookie: string; json: Record<string, unknown> }>((resolve) => {
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      end(data?: string) {
        const setCookie = this.headers["set-cookie"] || "";
        const token = /cosmos_session=([^;]+)/.exec(setCookie)?.[1] || "";
        resolve({
          status: this.statusCode,
          cookie: token ? `cosmos_session=${token}` : cookie,
          json: data ? (JSON.parse(data) as Record<string, unknown>) : {},
        });
      },
    };
    void service.handle(stream as never, res as never);
  });
}

const created = await call("PUT", "/account", { person, galaxyId: "galaxy-1", kind: "open" });
assert.equal(created.status, 200);
const user = created.json.user as { id: string; birth: boolean };
assert.equal(user.birth, true);
assert.equal(typeof created.json.restoreKey, "string");
const cookie = created.cookie;

const saved = await call(
  "PUT",
  "/sky",
  {
    galaxyId: "galaxy-1",
    roundTurns: 2,
    conjunctionAt: null,
    conjunctionAsked: false,
    ziHour: "early",
    stars: [{ id: "core", kind: "core", title: "本命", note: "", echo: "", god: "", litAt: 1 }],
    messages: [{ id: "m1", role: "user", text: "最近项目要延期", at: 2 }],
    memories: [{ id: "mem", text: "最近项目要延期", at: 2 }],
    mood: { near: 40, sting: 0, worry: 50, lift: 8, at: 2 },
    bond: {
      happiness: 70,
      sadness: 20,
      anger: 0,
      anxiety: 8,
      affection: 52,
      intimacy: 31,
      trust: 41,
      energy: 76,
      missLevel: 18,
      patience: 80,
      currentMood: "开心",
      lastInteraction: 2,
      conversationStreak: 1,
    },
    reachedAt: null,
  },
  cookie,
);
assert.equal(saved.status, 200);

const sky = await call("GET", "/sky", undefined, cookie);
assert.equal(sky.status, 200);
const messages = sky.json.messages as { text: string }[];
assert.equal(messages[0].text, "最近项目要延期");
const memories = sky.json.memories as { text: string }[];
assert.equal(memories[0].text, "最近项目要延期");
assert.equal((sky.json.bond as { currentMood: string }).currentMood, "开心");

const restored = await call("POST", "/restore", { restoreKey: created.json.restoreKey });
assert.equal(restored.status, 200);
const again = await call("GET", "/session", undefined, restored.cookie);
const sessionUser = again.json.user as { id: string; birth: boolean };
assert.equal(sessionUser.id, user.id);
assert.equal(sessionUser.birth, true);

const edited = await call("PUT", "/account", { person: { ...person, name: "改名" }, galaxyId: "galaxy-1", kind: "edit" }, cookie);
assert.equal(edited.status, 200);
assert.equal((edited.json.user as { name: string }).name, "改名");

service.close();
console.log("Account tables, sky save and restore: passed.");
