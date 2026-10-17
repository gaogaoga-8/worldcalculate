// server/community-host.ts
import http from "node:http";

// server/community.ts
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
var DAY = 864e5;
var sha = (text) => createHash("sha256").update(text).digest("hex");
var today = () => new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);
var ApiError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  status;
};
function createCommunity(file = process.env.COMMUNITY_DB || resolve(".data/community.sqlite")) {
  if (file !== ":memory:")
    mkdirSync(dirname(file), { recursive: true, mode: 448 });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS beacons(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), day TEXT NOT NULL, body TEXT NOT NULL, mood TEXT NOT NULL, topic TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(user_id, day));
    CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY, a TEXT REFERENCES users(id), b TEXT REFERENCES users(id), requester TEXT NOT NULL, status TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(a,b));
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, thread_id TEXT REFERENCES threads(id), sender TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS blocks(owner TEXT REFERENCES users(id), other TEXT REFERENCES users(id), PRIMARY KEY(owner,other));
  `);
  const userColumns = db.prepare("PRAGMA table_info(users)").all();
  const have = new Set(userColumns.map((column) => column.name));
  for (const [name, definition] of [
    ["gender", "gender TEXT"],
    ["birth_year", "birth_year INTEGER"],
    ["birth_month", "birth_month INTEGER"],
    ["birth_day", "birth_day INTEGER"],
    ["birth_hour", "birth_hour INTEGER"],
    ["birth_minute", "birth_minute INTEGER"],
    ["hour_unknown", "hour_unknown INTEGER"],
    ["place_name", "place_name TEXT"],
    ["longitude", "longitude REAL"],
    ["latitude", "latitude REAL"],
    ["timezone", "timezone REAL"],
    ["mbti", "mbti TEXT"],
    ["galaxy_id", "galaxy_id TEXT"],
    ["round_turns", "round_turns INTEGER NOT NULL DEFAULT 0"],
    ["conjunction_at", "conjunction_at INTEGER"],
    ["conjunction_asked", "conjunction_asked INTEGER NOT NULL DEFAULT 0"],
    ["zi_hour", "zi_hour TEXT"],
    ["restore_hash", "restore_hash TEXT"],
    ["created_at", "created_at INTEGER"],
    ["updated_at", "updated_at INTEGER NOT NULL DEFAULT 0"],
    ["last_seen_at", "last_seen_at INTEGER"],
    ["login_name", "login_name TEXT"],
    ["password_hash", "password_hash TEXT"]
  ]) {
    if (!have.has(name)) db.exec(`ALTER TABLE users ADD COLUMN ${definition}`);
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_login_name ON users(login_name) WHERE login_name IS NOT NULL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS stars(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,
      palace TEXT,
      title TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      echo TEXT NOT NULL DEFAULT '',
      god TEXT NOT NULL DEFAULT '',
      reading TEXT NOT NULL DEFAULT '',
      lit_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      seq INTEGER NOT NULL,
      role TEXT NOT NULL,
      body TEXT NOT NULL,
      at INTEGER,
      reach INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS memories(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS moods(
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      near INTEGER NOT NULL,
      sting INTEGER NOT NULL,
      worry INTEGER NOT NULL,
      lift INTEGER NOT NULL,
      at INTEGER NOT NULL,
      reached_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS events(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_user ON events(user_id, at);
  `);
  const moodColumns = db.prepare("PRAGMA table_info(moods)").all();
  if (!moodColumns.some((column) => column.name === "bond")) db.exec("ALTER TABLE moods ADD COLUMN bond TEXT");
  const rates = /* @__PURE__ */ new Map();
  function limited(key, max, window = 6e4) {
    const at = Date.now();
    if (rates.size > 5e3) {
      for (const [k, v] of rates) if (v.until < at) rates.delete(k);
    }
    let row = rates.get(key);
    if (!row || row.until < at) {
      row = { count: 0, until: at + window };
      rates.set(key, row);
    }
    if (++row.count > max) throw new ApiError(429, "\u6162\u4E00\u70B9\uFF0C\u518D\u8BD5\u4E00\u6B21\u3002");
  }
  function current(req) {
    const token = /(?:^|;\s*)cosmos_session=([^;]+)/.exec(
      req.headers.cookie || ""
    )?.[1];
    if (!token) return;
    return db.prepare(
      "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?"
    ).get(sha(token), Date.now());
  }
  function required(req) {
    const user = current(req);
    if (!user) throw new ApiError(401, "\u5148\u7559\u4E0B\u4E00\u4E2A\u79F0\u547C\uFF0C\u518D\u628A\u56DE\u58F0\u9001\u51FA\u53BB\u3002");
    return user;
  }
  function cookie(res, token, age = 30 * 86400) {
    res.setHeader(
      "set-cookie",
      `cosmos_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.COOKIE_SECURE === "1" ? "; Secure" : ""}`
    );
  }
  function blocked(a, b) {
    return !!db.prepare(
      "SELECT 1 FROM blocks WHERE (owner=? AND other=?) OR (owner=? AND other=?)"
    ).get(a, b, b, a);
  }
  function member(id, user) {
    const row = db.prepare("SELECT * FROM threads WHERE id=? AND (a=? OR b=?)").get(id, user, user);
    if (!row || blocked(row.a, row.b))
      throw new ApiError(404, "\u8FD9\u9897\u661F\u6682\u65F6\u627E\u4E0D\u5230\u4E86\u3002");
    return row;
  }
  function transaction(operation) {
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
  function accountRow(id) {
    return db.prepare("SELECT * FROM users WHERE id=?").get(id);
  }
  function sessionUser(row) {
    return { id: row.id, name: row.name, birth: row.birth_year != null, login: Boolean(row.login_name), updatedAt: row.updated_at || 0 };
  }
  function recordEvent(userId, kind, at) {
    if (kind !== "open" && kind !== "edit" && kind !== "import") return;
    db.prepare("INSERT INTO events (id, user_id, kind, at) VALUES(?,?,?,?)").run(randomUUID(), userId, kind, at);
  }
  function textOrNull(value, max) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    return text ? text.slice(0, max) : null;
  }
  function personFrom(value) {
    if (!value || typeof value !== "object") throw new ApiError(400, "\u8FD8\u7F3A\u51FA\u751F\u8BB0\u5F55\u3002");
    const person = value;
    const time = person.time;
    const place = person.place;
    const name = clean(person.name, 24);
    const gender = person.gender === "female" ? "female" : person.gender === "male" ? "male" : "";
    if (!gender || !time || !place) throw new ApiError(400, "\u8FD8\u7F3A\u51FA\u751F\u8BB0\u5F55\u3002");
    const year = numberIn(time.year, 1900, 2100);
    const month = numberIn(time.month, 1, 12);
    const day = numberIn(time.day, 1, 31);
    const minute = numberIn(time.minute, 0, 59);
    const hourUnknown = person.hourUnknown === true || time.hour == null;
    const hour = hourUnknown ? null : numberIn(time.hour, 0, 23);
    const placeName = clean(place.name, 40);
    const longitude = numberIn(place.longitude, -180, 180);
    const latitude = numberIn(place.latitude, -90, 90);
    const timezone = numberIn(place.timezone, -12, 14);
    return {
      name,
      gender,
      year,
      month,
      day,
      hour,
      minute,
      hourUnknown,
      place: placeName,
      longitude,
      latitude,
      timezone,
      mbti: textOrNull(person.mbti, 8)
    };
  }
  function readSky(userId) {
    const row = accountRow(userId);
    if (!row || row.birth_year == null) throw new ApiError(404, "\u8FD8\u6CA1\u6709\u8FD9\u4EFD\u661F\u56FE\u3002");
    const stars = db.prepare("SELECT * FROM stars WHERE user_id=?").all(userId);
    const messages = db.prepare("SELECT * FROM chat_messages WHERE user_id=? ORDER BY seq").all(userId);
    const memories = db.prepare("SELECT id, text, at FROM memories WHERE user_id=? ORDER BY at").all(userId);
    const mood = db.prepare("SELECT * FROM moods WHERE user_id=?").get(userId);
    return {
      updatedAt: row.updated_at || 0,
      galaxyId: row.galaxy_id || "",
      roundTurns: row.round_turns || 0,
      conjunctionAt: row.conjunction_at,
      conjunctionAsked: row.conjunction_asked === 1,
      ziHour: row.zi_hour === "late" ? "late" : "early",
      person: {
        id: "self",
        name: row.name,
        gender: row.gender === "female" ? "female" : "male",
        time: {
          year: row.birth_year,
          month: row.birth_month,
          day: row.birth_day,
          hour: row.hour_unknown ? null : row.birth_hour,
          minute: row.birth_minute || 0
        },
        place: {
          name: row.place_name || "",
          longitude: row.longitude || 0,
          latitude: row.latitude || 0,
          timezone: row.timezone || 8
        },
        hourUnknown: row.hour_unknown === 1,
        mbti: row.mbti
      },
      stars: stars.map((star) => ({
        id: star.id,
        kind: star.kind,
        palace: star.palace,
        title: star.title,
        note: star.note,
        echo: star.echo,
        god: star.god,
        reading: star.reading,
        litAt: star.lit_at
      })),
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role === "guide" ? "guide" : "user",
        text: message.body,
        at: message.at,
        reach: message.reach === 1
      })),
      memories,
      mood: mood ? { near: Number(mood.near), sting: Number(mood.sting), worry: Number(mood.worry), lift: Number(mood.lift), at: Number(mood.at) } : null,
      bond: parseBond(mood?.bond),
      reachedAt: typeof mood?.reached_at === "number" ? mood.reached_at : null
    };
  }
  function writeSky(userId, body, now) {
    const stars = Array.isArray(body.stars) ? body.stars.slice(0, 40) : [];
    const messages = Array.isArray(body.messages) ? body.messages.slice(-300) : [];
    const memories = Array.isArray(body.memories) ? body.memories.slice(-18) : [];
    const mood = body.mood && typeof body.mood === "object" ? body.mood : null;
    transaction(() => {
      db.prepare("DELETE FROM stars WHERE user_id=?").run(userId);
      db.prepare("DELETE FROM chat_messages WHERE user_id=?").run(userId);
      db.prepare("DELETE FROM memories WHERE user_id=?").run(userId);
      const insertStar = db.prepare(
        "INSERT INTO stars (id, user_id, kind, palace, title, note, echo, god, reading, lit_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
      );
      for (const item of stars) {
        if (!item || typeof item !== "object") continue;
        const star = item;
        const kind = star.kind === "palace" || star.kind === "round" || star.kind === "core" ? star.kind : "";
        const title = textOrNull(star.title, 40);
        if (!kind || !title) continue;
        insertStar.run(
          textOrNull(star.id, 80) || randomUUID(),
          userId,
          kind,
          textOrNull(star.palace, 20),
          title,
          textOrNull(star.note, 80) || "",
          textOrNull(star.echo, 200) || "",
          textOrNull(star.god, 20) || "",
          textOrNull(star.reading, 8e3) || "",
          typeof star.litAt === "number" ? star.litAt : now
        );
      }
      const insertMessage = db.prepare(
        "INSERT INTO chat_messages (id, user_id, seq, role, body, at, reach) VALUES(?,?,?,?,?,?,?)"
      );
      messages.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const message = item;
        const text = textOrNull(message.text, 4e3);
        if (!text) return;
        insertMessage.run(
          textOrNull(message.id, 80) || randomUUID(),
          userId,
          index,
          message.role === "guide" ? "guide" : "user",
          text,
          typeof message.at === "number" ? message.at : null,
          message.reach === true ? 1 : 0
        );
      });
      const insertMemory = db.prepare("INSERT INTO memories (id, user_id, text, at) VALUES(?,?,?,?)");
      for (const item of memories) {
        if (!item || typeof item !== "object") continue;
        const memory = item;
        const text = textOrNull(memory.text, 80);
        if (!text) continue;
        insertMemory.run(textOrNull(memory.id, 80) || randomUUID(), userId, text, typeof memory.at === "number" ? memory.at : now);
      }
      if (mood) {
        db.prepare(
          "INSERT INTO moods (user_id, near, sting, worry, lift, at, reached_at, bond) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET near=excluded.near, sting=excluded.sting, worry=excluded.worry, lift=excluded.lift, at=excluded.at, reached_at=excluded.reached_at, bond=excluded.bond"
        ).run(
          userId,
          clampScore(mood.near),
          clampScore(mood.sting),
          clampScore(mood.worry),
          clampScore(mood.lift),
          typeof mood.at === "number" ? mood.at : now,
          typeof body.reachedAt === "number" ? body.reachedAt : null,
          bondText(body.bond)
        );
      }
      db.prepare(
        "UPDATE users SET galaxy_id=?, round_turns=?, conjunction_at=?, conjunction_asked=?, zi_hour=?, updated_at=? WHERE id=?"
      ).run(
        textOrNull(body.galaxyId, 80),
        typeof body.roundTurns === "number" ? Math.max(0, Math.floor(body.roundTurns)) : 0,
        typeof body.conjunctionAt === "number" ? body.conjunctionAt : null,
        body.conjunctionAsked === true ? 1 : 0,
        body.ziHour === "late" ? "late" : "early",
        now,
        userId
      );
    });
    return now;
  }
  async function handle(req, res, _next) {
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
    const send = (data) => res.end(JSON.stringify(data));
    try {
      if (method !== "GET") {
        const origin = req.headers.origin;
        const expected = process.env.APP_ORIGIN || `http://${req.headers.host}`;
        if (origin && origin !== expected)
          throw new ApiError(403, "\u8BF7\u4ECE\u8FD9\u7247\u661F\u7A7A\u91CD\u65B0\u8FDB\u5165\u3002");
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new ApiError(415, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E\u3002");
      }
      limited(`all:${clientAddress(req)}`, 180);
      if (path === "/session" && method === "GET") {
        const u = current(req);
        const row = u ? accountRow(u.id) : void 0;
        send({ user: row ? sessionUser(row) : null });
        return;
      }
      if (path === "/guest" && method === "POST") {
        limited(`guest:${clientAddress(req)}`, 30, 15 * 6e4);
        const body = await readJson(req);
        const name = clean(body.name, 24);
        const existing = current(req);
        if (existing) {
          db.prepare("UPDATE users SET name=? WHERE id=?").run(
            name,
            existing.id
          );
          send({ user: { id: existing.id, name } });
          return;
        }
        const u = { id: randomUUID(), name };
        const now = Date.now();
        db.prepare(
          "INSERT INTO users (id, name, created_at, updated_at, last_seen_at) VALUES(?,?,?,?,?)"
        ).run(u.id, u.name, now, now, now);
        const token = randomBytes(32).toString("base64url");
        db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
          sha(token),
          u.id,
          Date.now() + 365 * DAY
        );
        cookie(res, token, 365 * 86400);
        send({ user: u });
        return;
      }
      if (path === "/login" && method === "POST") {
        limited(`login:${clientAddress(req)}`, 10, 15 * 6e4);
        const body = await readJson(req);
        const loginName = clean(body.name, 24);
        const secret = typeof body.secret === "string" ? body.secret : "";
        if (secret.length < 4 || secret.length > 64) throw new ApiError(400, "\u90A3\u53E5\u8BDD\u518D\u957F\u4E00\u70B9\u3002");
        const now = Date.now();
        if (body.intent === "open") {
          const taken = db.prepare("SELECT id FROM users WHERE login_name=?").get(loginName);
          if (taken) throw new ApiError(409, "\u8FD9\u4E2A\u540D\u5B57\u5DF2\u7ECF\u7559\u4E0B\u8FC7\u4E86\u3002");
          const id = randomUUID();
          db.prepare(
            "INSERT INTO users (id, name, login_name, password_hash, created_at, updated_at, last_seen_at) VALUES(?,?,?,?,?,?,?)"
          ).run(id, loginName, loginName, hashPassword(secret), now, now, now);
          const token = randomBytes(32).toString("base64url");
          db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(token), id, now + 365 * DAY);
          cookie(res, token, 365 * 86400);
          const saved = accountRow(id);
          send({ user: saved ? sessionUser(saved) : null });
          return;
        }
        if (body.intent === "keep") {
          const existing = current(req);
          const row = existing ? accountRow(existing.id) : void 0;
          if (!row?.birth_year) throw new ApiError(401, "\u5148\u70B9\u4EAE\u4E09\u9897\u661F\u3002");
          const taken = db.prepare("SELECT id FROM users WHERE login_name=? AND id!=?").get(loginName, row.id);
          if (taken) throw new ApiError(409, "\u8FD9\u4E2A\u540D\u5B57\u5DF2\u7ECF\u7559\u4E0B\u8FC7\u4E86\u3002");
          db.prepare("UPDATE users SET login_name=?, password_hash=?, last_seen_at=? WHERE id=?").run(loginName, hashPassword(secret), now, row.id);
          const saved = accountRow(row.id);
          send({ user: saved ? sessionUser(saved) : null });
          return;
        }
        if (body.intent === "return") {
          const row = db.prepare("SELECT * FROM users WHERE login_name=?").get(loginName);
          if (!row?.password_hash || !checkPassword(secret, row.password_hash)) throw new ApiError(404, "\u5BF9\u4E0D\u4E0A\u8FD9\u9897\u661F\u3002");
          const token = randomBytes(32).toString("base64url");
          db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(token), row.id, now + 365 * DAY);
          db.prepare("UPDATE users SET last_seen_at=? WHERE id=?").run(now, row.id);
          cookie(res, token, 365 * 86400);
          send({ user: sessionUser(row) });
          return;
        }
        throw new ApiError(400, "\u6CA1\u542C\u61C2\u3002");
      }
      if (path === "/logout" && method === "POST") {
        const token = /(?:^|;\s*)cosmos_session=([^;]+)/.exec(
          req.headers.cookie || ""
        )?.[1];
        if (token)
          db.prepare("DELETE FROM sessions WHERE token=?").run(sha(token));
        cookie(res, "", 0);
        send({ ok: true });
        return;
      }
      if (path === "/account" && method === "PUT") {
        const body = await readJson(req, 2e4);
        const profile = personFrom(body.person);
        const now = Date.now();
        let existing = current(req);
        let restoreKey;
        if (!existing) {
          existing = { id: randomUUID(), name: profile.name };
          restoreKey = randomBytes(32).toString("base64url");
          db.prepare(
            "INSERT INTO users (id, name, created_at, updated_at, last_seen_at, restore_hash) VALUES(?,?,?,?,?,?)"
          ).run(existing.id, profile.name, now, now, now, sha(restoreKey));
          const token = randomBytes(32).toString("base64url");
          db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(token), existing.id, now + 365 * DAY);
          cookie(res, token, 365 * 86400);
        }
        const row = accountRow(existing.id);
        if (!row) throw new ApiError(401, "\u5148\u70B9\u4EAE\u4E09\u9897\u661F\u3002");
        if (!row.restore_hash) {
          restoreKey = randomBytes(32).toString("base64url");
          db.prepare("UPDATE users SET restore_hash=? WHERE id=?").run(sha(restoreKey), existing.id);
        }
        db.prepare(
          `UPDATE users SET name=?, gender=?, birth_year=?, birth_month=?, birth_day=?, birth_hour=?, birth_minute=?, hour_unknown=?, place_name=?, longitude=?, latitude=?, timezone=?, mbti=?, galaxy_id=?, updated_at=?, last_seen_at=? WHERE id=?`
        ).run(
          profile.name,
          profile.gender,
          profile.year,
          profile.month,
          profile.day,
          profile.hour,
          profile.minute,
          profile.hourUnknown ? 1 : 0,
          profile.place,
          profile.longitude,
          profile.latitude,
          profile.timezone,
          profile.mbti,
          textOrNull(body.galaxyId, 80),
          now,
          now,
          existing.id
        );
        recordEvent(existing.id, body.kind, now);
        const saved = accountRow(existing.id);
        send({ user: saved ? sessionUser(saved) : null, restoreKey, updatedAt: now });
        return;
      }
      if (path === "/restore" && method === "POST") {
        const body = await readJson(req);
        const key = typeof body.restoreKey === "string" ? body.restoreKey.trim() : "";
        if (!/^[A-Za-z0-9_-]{20,120}$/.test(key)) throw new ApiError(400, "\u8FD9\u4EFD\u661F\u56FE\u5BF9\u4E0D\u4E0A\u3002");
        const row = db.prepare("SELECT * FROM users WHERE restore_hash=?").get(sha(key));
        if (!row) throw new ApiError(404, "\u8FD9\u4EFD\u661F\u56FE\u5BF9\u4E0D\u4E0A\u3002");
        const token = randomBytes(32).toString("base64url");
        const now = Date.now();
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(token), row.id, now + 365 * DAY);
        db.prepare("UPDATE users SET last_seen_at=? WHERE id=?").run(now, row.id);
        cookie(res, token, 365 * 86400);
        recordEvent(row.id, "import", now);
        send({ user: sessionUser(row), updatedAt: row.updated_at || 0 });
        return;
      }
      if (path === "/events" && method === "POST") {
        const u = required(req);
        const body = await readJson(req);
        const now = Date.now();
        recordEvent(u.id, body.kind, now);
        db.prepare("UPDATE users SET last_seen_at=? WHERE id=?").run(now, u.id);
        send({ ok: true });
        return;
      }
      if (path === "/sky" && method === "GET") {
        const u = required(req);
        send(readSky(u.id));
        return;
      }
      if (path === "/sky" && method === "PUT") {
        const u = required(req);
        const body = await readJson(req, 15e5);
        const now = writeSky(u.id, body, Date.now());
        send({ updatedAt: now });
        return;
      }
      if (path === "/beacons" && method === "GET") {
        const u = current(req);
        const rows = db.prepare(
          "SELECT b.*,u.name FROM beacons b JOIN users u ON u.id=b.user_id WHERE b.at>? ORDER BY b.at DESC LIMIT 200"
        ).all(Date.now() - 7 * DAY);
        const moods = ["hear", "listen", "together"];
        const mood = moods.includes(url.searchParams.get("mood") || "") ? url.searchParams.get("mood") : "hear";
        const complement = mood === "hear" ? "listen" : mood === "listen" ? "hear" : "together";
        const topic = url.searchParams.get("topic");
        const latest = /* @__PURE__ */ new Set();
        send({
          beacons: rows.filter((r) => {
            if (latest.has(r.user_id)) return false;
            latest.add(r.user_id);
            return r.user_id !== u?.id && (!u || !blocked(u.id, r.user_id));
          }).sort(
            (a, b) => (b.mood === complement ? 2 : 0) + (b.topic === topic ? 1 : 0) - ((a.mood === complement ? 2 : 0) + (a.topic === topic ? 1 : 0))
          ).slice(0, 36).map((r) => ({
            id: r.id,
            userId: r.user_id,
            name: r.name,
            body: r.body,
            mood: r.mood,
            topic: r.topic,
            at: r.at
          }))
        });
        return;
      }
      if (path === "/beacons" && method === "POST") {
        const u = required(req);
        limited(`beacon:${u.id}`, 12, 36e5);
        const body = await readJson(req);
        const text = clean(body.body, 160);
        const mood = choice(body.mood, ["hear", "listen", "together"]);
        const topic = choice(body.topic, [
          "life",
          "work",
          "relationship",
          "study",
          "anything"
        ]);
        const id = randomUUID();
        const day = today();
        db.prepare(
          "INSERT INTO beacons VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET body=excluded.body,mood=excluded.mood,topic=excluded.topic,at=excluded.at"
        ).run(id, u.id, day, text, mood, topic, Date.now());
        send({ ok: true });
        return;
      }
      if (path === "/beacons/mine" && method === "GET") {
        const u = required(req);
        const r = db.prepare(
          "SELECT id,body,mood,topic FROM beacons WHERE user_id=? ORDER BY at DESC LIMIT 1"
        ).get(u.id);
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
        const rows = db.prepare(
          `SELECT t.*,u.id AS otherId,u.name FROM threads t JOIN users u ON u.id=CASE WHEN t.a=? THEN t.b ELSE t.a END WHERE (t.a=? OR t.b=?) AND t.status!='closed' ORDER BY t.at DESC`
        ).all(u.id, u.id, u.id);
        send({
          threads: rows.filter((r) => !blocked(u.id, r.otherId)).map((r) => ({
            id: r.id,
            name: r.name,
            otherId: r.otherId,
            status: r.status,
            incoming: r.requester !== u.id,
            at: r.at
          }))
        });
        return;
      }
      if (path === "/respond" && method === "POST") {
        const u = required(req);
        limited(`respond:${u.id}`, 8, DAY);
        const body = await readJson(req);
        const text = clean(body.body, 600);
        const beacon = db.prepare("SELECT * FROM beacons WHERE id=? AND at>?").get(String(body.beaconId), Date.now() - 7 * DAY);
        if (!beacon || beacon.user_id === u.id || blocked(u.id, beacon.user_id))
          throw new ApiError(404, "\u8FD9\u53E5\u56DE\u58F0\u5DF2\u7ECF\u98D8\u8FDC\u4E86\u3002");
        const [a, b] = [u.id, beacon.user_id].sort();
        const id = transaction(() => {
          let t = db.prepare("SELECT * FROM threads WHERE a=? AND b=?").get(a, b);
          if (t && t.status !== "accepted")
            throw new ApiError(
              409,
              t.status === "pending" ? "\u56DE\u58F0\u5DF2\u7ECF\u9001\u8FBE\uFF0C\u7ED9\u5BF9\u65B9\u4E00\u70B9\u65F6\u95F4\u3002" : "\u8FD9\u6BB5\u56DE\u58F0\u5DF2\u7ECF\u7ED3\u675F\u3002"
            );
          if (!t) {
            t = {
              id: randomUUID(),
              a,
              b,
              requester: u.id,
              status: "pending",
              at: Date.now()
            };
            db.prepare("INSERT INTO threads VALUES(?,?,?,?,?,?)").run(
              t.id,
              a,
              b,
              u.id,
              t.status,
              t.at
            );
          }
          db.prepare("INSERT INTO messages VALUES(?,?,?,?,?)").run(
            randomUUID(),
            t.id,
            u.id,
            text,
            Date.now()
          );
          return t.id;
        });
        send({ id });
        return;
      }
      const match = /^\/threads\/([^/]+)(?:\/(accept|decline|messages|block))?$/.exec(path);
      if (match) {
        const u = required(req);
        const t = member(match[1], u.id);
        const action = match[2];
        if (!action && method === "GET") {
          const messages = db.prepare(
            "SELECT id,sender,body,at FROM messages WHERE thread_id=? ORDER BY at DESC,rowid DESC LIMIT 500"
          ).all(t.id).reverse();
          send({ messages, status: t.status });
          return;
        }
        if ((action === "accept" || action === "decline") && method === "POST") {
          if (t.requester === u.id || t.status !== "pending")
            throw new ApiError(403, "\u7B49\u5BF9\u65B9\u63A5\u4F4F\u8FD9\u53E5\u56DE\u58F0\u3002");
          db.prepare("UPDATE threads SET status=? WHERE id=?").run(
            action === "accept" ? "accepted" : "closed",
            t.id
          );
          send({ ok: true });
          return;
        }
        if (action === "messages" && method === "POST") {
          if (t.status !== "accepted")
            throw new ApiError(403, "\u7B49\u5BF9\u65B9\u4E5F\u613F\u610F\u804A\u804A\u3002");
          limited(`message:${u.id}`, 25);
          const body = await readJson(req);
          const text = clean(body.body, 1e3);
          const at = Date.now();
          transaction(() => {
            db.prepare("INSERT INTO messages VALUES(?,?,?,?,?)").run(
              randomUUID(),
              t.id,
              u.id,
              text,
              at
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
            other
          );
          send({ ok: true });
          return;
        }
      }
      throw new ApiError(404, "\u627E\u4E0D\u5230\u8FD9\u6761\u8DEF\u3002");
    } catch (error) {
      res.statusCode = error instanceof ApiError ? error.status : 500;
      send({
        error: error instanceof ApiError ? error.message : "\u6682\u65F6\u6CA1\u8FDE\u4E0A\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002"
      });
    }
  }
  return { handle, close: () => db.close() };
}
function clientAddress(req) {
  const direct = req.socket.remoteAddress || "";
  const local = direct === "127.0.0.1" || direct === "::1" || direct === "::ffff:127.0.0.1";
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const fromProxy = raw?.split(",")[0]?.trim();
  if (local && fromProxy) return fromProxy;
  return direct || "unknown";
}
function numberIn(value, min, max) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new ApiError(400, "\u51FA\u751F\u8BB0\u5F55\u8BFB\u4E0D\u4E86\u3002");
  return number;
}
function clampScore(value) {
  const number = typeof value === "number" ? value : 0;
  return Math.min(100, Math.max(0, Math.round(number)));
}
var BOND_KEYS = ["happiness", "sadness", "anger", "anxiety", "affection", "intimacy", "trust", "energy", "missLevel", "patience", "lastInteraction", "conversationStreak"];
function parseBond(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const bond = JSON.parse(value);
    if (!bond || typeof bond !== "object") return null;
    if (!BOND_KEYS.every((key) => typeof bond[key] === "number")) return null;
    if (typeof bond.currentMood !== "string") return null;
    return bond;
  } catch {
    return null;
  }
}
function bondText(value) {
  if (!value || typeof value !== "object") return null;
  const bond = value;
  if (!BOND_KEYS.every((key) => typeof bond[key] === "number")) return null;
  if (typeof bond.currentMood !== "string" || bond.currentMood.length > 12) return null;
  return JSON.stringify(bond);
}
function hashPassword(secret) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(secret, salt, 32).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}
function checkPassword(secret, stored) {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const next = scryptSync(secret, salt, 32);
  const prev = Buffer.from(hash, "base64url");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}
function clean(value, max) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max || /[\u0000-\u0008]/.test(text))
    throw new ApiError(400, `\u8BF7\u5199 1\u2013${max} \u4E2A\u5B57\u3002`);
  return text;
}
function choice(value, allowed) {
  if (typeof value !== "string" || !allowed.includes(value))
    throw new ApiError(400, "\u518D\u9009\u4E00\u6B21\u3002");
  return value;
}
async function readJson(req, max = 8e3) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new ApiError(413, "\u8FD9\u6BB5\u5185\u5BB9\u592A\u957F\u4E86\u3002");
    chunks.push(Buffer.from(chunk));
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw 0;
    return parsed;
  } catch {
    throw new ApiError(400, "\u8BF7\u6C42\u683C\u5F0F\u4E0D\u6B63\u786E\u3002");
  }
}

// server/community-host.ts
var port = Number(process.env.PORT || 4174);
var service = createCommunity(process.env.COMMUNITY_DB);
var server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://local");
  const prefix = "/api/community";
  if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
    url.pathname = url.pathname.slice(prefix.length) || "/";
    req.url = `${url.pathname}${url.search}`;
  }
  void service.handle(req, res);
});
server.listen(port, "127.0.0.1");
