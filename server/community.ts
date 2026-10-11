import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const DAY = 86400000;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const today = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type Account = { id: string; name: string };
type Thread = {
  id: string;
  a: string;
  b: string;
  requester: string;
  status: string;
  at: number;
};

export function createCommunity(
  file = process.env.COMMUNITY_DB || resolve(".data/community.sqlite"),
) {
  if (file !== ":memory:")
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS beacons(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), day TEXT NOT NULL, body TEXT NOT NULL, mood TEXT NOT NULL, topic TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(user_id, day));
    CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY, a TEXT REFERENCES users(id), b TEXT REFERENCES users(id), requester TEXT NOT NULL, status TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(a,b));
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, thread_id TEXT REFERENCES threads(id), sender TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS blocks(owner TEXT REFERENCES users(id), other TEXT REFERENCES users(id), PRIMARY KEY(owner,other));
  `);
  const rates = new Map<string, { count: number; until: number }>();
  function limited(key: string, max: number, window = 60000) {
    const at = Date.now();
    if (rates.size > 5000)
      for (const [k, v] of rates) if (v.until < at) rates.delete(k);
    let row = rates.get(key);
    if (!row || row.until < at) {
      row = { count: 0, until: at + window };
      rates.set(key, row);
    }
    if (++row.count > max) throw new ApiError(429, "慢一点，再试一次。");
  }
  function current(req: IncomingMessage): Account | undefined {
    const token = /(?:^|;\s*)cosmos_session=([^;]+)/.exec(
      req.headers.cookie || "",
    )?.[1];
    if (!token) return;
    return db
      .prepare(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
      )
      .get(sha(token), Date.now()) as Account | undefined;
  }
  function required(req: IncomingMessage) {
    const user = current(req);
    if (!user) throw new ApiError(401, "先留下一个称呼，再把回声送出去。");
    return user;
  }
  const publicUser = (u: Account) => ({ id: u.id, name: u.name });
  function cookie(res: ServerResponse, token: string, age = 30 * 86400) {
    res.setHeader(
      "set-cookie",
      `cosmos_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.COOKIE_SECURE === "1" ? "; Secure" : ""}`,
    );
  }
  function blocked(a: string, b: string) {
    return !!db
      .prepare(
        "SELECT 1 FROM blocks WHERE (owner=? AND other=?) OR (owner=? AND other=?)",
      )
      .get(a, b, b, a);
  }
  function member(id: string, user: string) {
    const row = db
      .prepare("SELECT * FROM threads WHERE id=? AND (a=? OR b=?)")
      .get(id, user, user) as Thread | undefined;
    if (!row || blocked(row.a, row.b))
      throw new ApiError(404, "这颗星暂时找不到了。");
    return row;
  }
  function transaction<T>(operation: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
    _next?: () => void,
  ) {
    const url = new URL(req.url || "/", "http://local");
    const method = req.method || "GET";
    const path = url.pathname;
    if (!["GET", "POST", "PUT", "DELETE"].includes(method)) {
      res.statusCode = 405;
      res.end();
      return;
    }
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    const send = (data: unknown) => res.end(JSON.stringify(data));
    try {
      if (method !== "GET") {
        const origin = req.headers.origin;
        const expected = process.env.APP_ORIGIN || `http://${req.headers.host}`;
        if (origin && origin !== expected)
          throw new ApiError(403, "请从这片星空重新进入。");
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new ApiError(415, "请求格式不正确。");
      }
      limited(`all:${req.socket.remoteAddress}`, 180);
      if (path === "/session" && method === "GET") {
        const u = current(req);
        send({ user: u ? publicUser(u) : null });
        return;
      }
      if (path === "/guest" && method === "POST") {
        limited(`guest:${req.socket.remoteAddress}`, 30, 15 * 60000);
        const body = await readJson(req);
        const name = clean(body.name, 24);
        const existing = current(req);
        if (existing) {
          db.prepare("UPDATE users SET name=? WHERE id=?").run(
            name,
            existing.id,
          );
          send({ user: { id: existing.id, name } });
          return;
        }
        const u = { id: randomUUID(), name };
        db.prepare("INSERT INTO users VALUES(?,?)").run(u.id, u.name);
        const token = randomBytes(32).toString("base64url");
        db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
          sha(token),
          u.id,
          Date.now() + 365 * DAY,
        );
        cookie(res, token, 365 * 86400);
        send({ user: u });
        return;
      }
      if (path === "/logout" && method === "POST") {
        const token = /(?:^|;\s*)cosmos_session=([^;]+)/.exec(
          req.headers.cookie || "",
        )?.[1];
        if (token)
          db.prepare("DELETE FROM sessions WHERE token=?").run(sha(token));
        cookie(res, "", 0);
        send({ ok: true });
        return;
      }
      if (path === "/beacons" && method === "GET") {
        const u = current(req);
        const rows = db
          .prepare(
            "SELECT b.*,u.name FROM beacons b JOIN users u ON u.id=b.user_id WHERE b.at>? ORDER BY b.at DESC LIMIT 200",
          )
          .all(Date.now() - 7 * DAY) as any[];
        const moods = ["hear", "listen", "together"];
        const mood = moods.includes(url.searchParams.get("mood") || "")
          ? url.searchParams.get("mood")
          : "hear";
        const complement =
          mood === "hear" ? "listen" : mood === "listen" ? "hear" : "together";
        const topic = url.searchParams.get("topic");
        const latest = new Set<string>();
        send({
          beacons: rows
            .filter((r) => {
              if (latest.has(r.user_id)) return false;
              latest.add(r.user_id);
              return r.user_id !== u?.id && (!u || !blocked(u.id, r.user_id));
            })
            .sort(
              (a, b) =>
                (b.mood === complement ? 2 : 0) +
                (b.topic === topic ? 1 : 0) -
                ((a.mood === complement ? 2 : 0) + (a.topic === topic ? 1 : 0)),
            )
            .slice(0, 36)
            .map((r) => ({
              id: r.id,
              userId: r.user_id,
              name: r.name,
              body: r.body,
              mood: r.mood,
              topic: r.topic,
              at: r.at,
            })),
        });
        return;
      }
      if (path === "/beacons" && method === "POST") {
        const u = required(req);
        limited(`beacon:${u.id}`, 12, 3600000);
        const body = await readJson(req);
        const text = clean(body.body, 160);
        const mood = choice(body.mood, ["hear", "listen", "together"]);
        const topic = choice(body.topic, [
          "life",
          "work",
          "relationship",
          "study",
          "anything",
        ]);
        const id = randomUUID();
        const day = today();
        db.prepare(
          "INSERT INTO beacons VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET body=excluded.body,mood=excluded.mood,topic=excluded.topic,at=excluded.at",
        ).run(id, u.id, day, text, mood, topic, Date.now());
        send({ ok: true });
        return;
      }
      if (path === "/beacons/mine" && method === "GET") {
        const u = required(req);
        const r = db
          .prepare(
            "SELECT id,body,mood,topic FROM beacons WHERE user_id=? ORDER BY at DESC LIMIT 1",
          )
          .get(u.id);
        send({ beacon: r || null });
        return;
      }
      if (path === "/beacons/mine" && method === "DELETE") {
        const u = required(req);
        db.prepare("DELETE FROM beacons WHERE user_id=?").run(u.id);
        send({ ok: true });
        return;
      }
      if (path === "/threads" && method === "GET") {
        const u = required(req);
        const rows = db
          .prepare(
            `SELECT t.*,u.id AS otherId,u.name FROM threads t JOIN users u ON u.id=CASE WHEN t.a=? THEN t.b ELSE t.a END WHERE (t.a=? OR t.b=?) AND t.status!='closed' ORDER BY t.at DESC`,
          )
          .all(u.id, u.id, u.id) as any[];
        send({
          threads: rows
            .filter((r) => !blocked(u.id, r.otherId))
            .map((r) => ({
              id: r.id,
              name: r.name,
              otherId: r.otherId,
              status: r.status,
              incoming: r.requester !== u.id,
              at: r.at,
            })),
        });
        return;
      }
      if (path === "/respond" && method === "POST") {
        const u = required(req);
        limited(`respond:${u.id}`, 8, DAY);
        const body = await readJson(req);
        const text = clean(body.body, 600);
        const beacon = db
          .prepare("SELECT * FROM beacons WHERE id=? AND at>?")
          .get(String(body.beaconId), Date.now() - 7 * DAY) as any;
        if (!beacon || beacon.user_id === u.id || blocked(u.id, beacon.user_id))
          throw new ApiError(404, "这句回声已经飘远了。");
        const [a, b] = [u.id, beacon.user_id].sort();
        const id = transaction(() => {
          let t = db
            .prepare("SELECT * FROM threads WHERE a=? AND b=?")
            .get(a, b) as Thread | undefined;
          if (t && t.status !== "accepted")
            throw new ApiError(
              409,
              t.status === "pending"
                ? "回声已经送达，给对方一点时间。"
                : "这段回声已经结束。",
            );
          if (!t) {
            t = {
              id: randomUUID(),
              a,
              b,
              requester: u.id,
              status: "pending",
              at: Date.now(),
            };
            db.prepare("INSERT INTO threads VALUES(?,?,?,?,?,?)").run(
              t.id,
              a,
              b,
              u.id,
              t.status,
              t.at,
            );
          }
          db.prepare("INSERT INTO messages VALUES(?,?,?,?,?)").run(
            randomUUID(),
            t.id,
            u.id,
            text,
            Date.now(),
          );
          return t.id;
        });
        send({ id });
        return;
      }
      const match =
        /^\/threads\/([^/]+)(?:\/(accept|decline|messages|block))?$/.exec(path);
      if (match) {
        const u = required(req);
        const t = member(match[1], u.id);
        const action = match[2];
        if (!action && method === "GET") {
          const messages = db
            .prepare(
              "SELECT id,sender,body,at FROM messages WHERE thread_id=? ORDER BY at DESC,rowid DESC LIMIT 500",
            )
            .all(t.id)
            .reverse();
          send({ messages, status: t.status });
          return;
        }
        if (
          (action === "accept" || action === "decline") &&
          method === "POST"
        ) {
          if (t.requester === u.id || t.status !== "pending")
            throw new ApiError(403, "等对方接住这句回声。");
          db.prepare("UPDATE threads SET status=? WHERE id=?").run(
            action === "accept" ? "accepted" : "closed",
            t.id,
          );
          send({ ok: true });
          return;
        }
        if (action === "messages" && method === "POST") {
          if (t.status !== "accepted")
            throw new ApiError(403, "等对方也愿意聊聊。");
          limited(`message:${u.id}`, 25);
          const body = await readJson(req);
          const text = clean(body.body, 1000);
          const at = Date.now();
          transaction(() => {
            db.prepare("INSERT INTO messages VALUES(?,?,?,?,?)").run(
              randomUUID(),
              t.id,
              u.id,
              text,
              at,
            );
            db.prepare("UPDATE threads SET at=? WHERE id=?").run(at, t.id);
          });
          send({ ok: true });
          return;
        }
        if (action === "block" && method === "POST") {
          const other = t.a === u.id ? t.b : t.a;
          db.prepare("INSERT OR IGNORE INTO blocks VALUES(?,?)").run(
            u.id,
            other,
          );
          send({ ok: true });
          return;
        }
      }
      throw new ApiError(404, "找不到这条路。");
    } catch (error) {
      res.statusCode = error instanceof ApiError ? error.status : 500;
      send({
        error:
          error instanceof ApiError ? error.message : "暂时没连上，稍后再试。",
      });
    }
  }
  return { handle, close: () => db.close() };
}
function clean(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max || /[\u0000-\u0008]/.test(text))
    throw new ApiError(400, `请写 1–${max} 个字。`);
  return text;
}
function choice(value: unknown, allowed: string[]) {
  if (typeof value !== "string" || !allowed.includes(value))
    throw new ApiError(400, "再选一次。");
  return value;
}
async function readJson(
  req: IncomingMessage,
  max = 8000,
): Promise<Record<string, any>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new ApiError(413, "这段内容太长了。");
    chunks.push(Buffer.from(chunk));
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw 0;
    return parsed;
  } catch {
    throw new ApiError(400, "请求格式不正确。");
  }
}
export function communityPlugin(): Plugin {
  const attach = (server: any) => {
    const service = createCommunity();
    server.middlewares.use(
      "/api/community",
      (req: IncomingMessage, res: ServerResponse, next: () => void) =>
        void service.handle(req, res, next),
    );
    server.httpServer?.once("close", service.close);
  };
  return {
    name: "community",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
