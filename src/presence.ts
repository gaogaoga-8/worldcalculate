import { starDay } from "./galaxy";

export type MemoryNote = { id: string; text: string; at: number };

export type Mood = {
  near: number;
  sting: number;
  worry: number;
  lift: number;
  at: number;
};

export const REST_MOOD: Mood = { near: 42, sting: 0, worry: 0, lift: 8, at: 0 };

const QUIET_AFTER = 3.5 * 3600000;
const REACH_GAP = 4 * 3600000;
const LIVE_GAP = 30 * 60 * 1000;
const STOP = new Set(["的了", "了一", "是不", "不是", "我的", "你的", "啊啊", "哈哈", "嗯嗯", "这个", "那个"]);

export function beijingHour(at: number): number {
  return new Date(at + 8 * 3600000).getUTCHours();
}

export function settleMood(mood: Mood, now: number): Mood {
  const elapsed = Math.max(0, now - (mood.at || now));
  if (elapsed < 60_000) return mood;
  const hours = elapsed / 3600000;
  const fade = (value: number, keep: number) => clamp(value * Math.pow(keep, hours));
  return {
    near: Math.round(clamp(mood.near + (42 - mood.near) * (1 - Math.pow(0.5, hours)))),
    sting: Math.round(fade(mood.sting, 0.72)),
    worry: Math.round(fade(mood.worry, 0.82)),
    lift: Math.round(fade(mood.lift, 0.75)),
    at: now,
  };
}

export function hearMood(mood: Mood, text: string, now: number): Mood {
  const heard = settleMood(mood, now);
  const base = heard === mood ? { ...mood } : heard;
  const line = text.replace(/\s+/g, "");
  let { near, sting, worry, lift } = base;
  if (/滚|闭嘴|别烦|烦死|有病|讨厌你|不想跟你|走开/.test(line)) {
    sting += 52;
    near -= 8;
    lift -= 10;
  } else if (/对不起|不好意思|我错了|别生气|开玩笑的/.test(line)) {
    sting -= 30;
    near += 6;
    worry -= 4;
  } else if (/难过|好累|睡不着|失眠|崩溃|分手|失业|被骂|委屈|想哭|心累|撑不住/.test(line)) {
    worry += 46;
    near += 4;
    lift -= 12;
    sting -= 6;
  } else if (/哈哈|嘿嘿|开心|太好了|好耶|谢谢|喜欢你|搞定了|终于/.test(line)) {
    lift += 22;
    sting -= 12;
    worry -= 8;
    near += 6;
  } else {
    near += line.length > 24 ? 3 : 1;
    sting -= 4;
    worry -= 2;
    lift -= 2;
  }
  return { near: clamp(near), sting: clamp(sting), worry: clamp(worry), lift: clamp(lift), at: now };
}

export function moodCue(mood: Mood): string {
  if (mood.sting >= 48) return "你现在有点别扭。话短，凉一点，但不甩开。对方软下来，你就松。不要解释你在生气。";
  if (mood.worry >= 42) return "你有点挂着对方的事。接住眼前这句，别追问，别讲道理，也别突然高兴。";
  if (mood.lift >= 42) return "你现在比较松，接得轻一点。仍是平时说话，不要撒娇。";
  if (mood.near >= 62) return "你们已经熟一点。话可以更短、更随便，像认识一阵的人。";
  return "你就是平常在听，不冷也不热。";
}

export function remember(notes: MemoryNote[], text: string, now: number, id: string): MemoryNote[] {
  const clip = clipFact(text);
  if (!clip) return notes;
  const dup = notes.findIndex((note) => similar(note.text, clip));
  if (dup >= 0) {
    const next = notes.slice();
    next[dup] = { ...next[dup], text: clip, at: now };
    return next;
  }
  return [...notes, { id, text: clip, at: now }].slice(-18);
}

export function rememberAll(
  notes: MemoryNote[],
  lines: { role: string; text: string; at?: number; id?: string }[],
): MemoryNote[] {
  return lines.reduce(
    (next, line, index) =>
      line.role === "user" && line.text
        ? remember(next, line.text, line.at || index, line.id || `m-${index}`)
        : next,
    notes,
  );
}

export function recall(notes: MemoryNote[], query: string, limit = 3): MemoryNote[] {
  return notes
    .map((note) => ({ note, score: overlap(query, note.text) }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score || b.note.at - a.note.at)
    .slice(0, limit)
    .map((item) => item.note);
}

export function memoryCue(notes: MemoryNote[]): string {
  return notes.map((note) => note.text).join("；");
}

export function reachLine(input: {
  now: number;
  messages: { role: string; text: string; at?: number; reach?: boolean }[];
  memories: MemoryNote[];
  mood: Mood;
  reachedAt: number | null;
}): { text: string } | null {
  const { now, messages, memories, mood, reachedAt } = input;
  const last = messages.at(-1);
  if (last?.at && now - last.at < LIVE_GAP) return null;
  if (last?.role === "user") return null;
  if (reachedAt && now - reachedAt < REACH_GAP) return null;
  if (last?.reach && last.at && now - last.at < REACH_GAP) return null;

  const hour = beijingHour(now);
  const today = starDay(now);
  const talkedToday = messages.some((message) => message.role === "user" && message.at && starDay(message.at) === today);
  const everTalked = messages.some((message) => message.role === "user");

  if (hour >= 5 && hour < 11 && !talkedToday && mood.sting < 48) {
    return { text: pick(["早。睡得怎么样。", "今天先别急。"], today) };
  }

  const reachedTonight = messages.some(
    (message) => message.reach && message.at && starDay(message.at) === today && beijingHour(message.at) >= 21,
  );
  if (hour >= 21 && hour < 24 && everTalked && !reachedTonight && mood.sting < 48) {
    return { text: pick(["不早了。先去睡吧。", "今天先到这。"], today) };
  }

  const lastUser = [...messages].reverse().find((message) => message.role === "user" && message.at);
  if (
    hour >= 8 &&
    hour < 20 &&
    lastUser?.at &&
    now - lastUser.at >= QUIET_AFTER &&
    mood.sting < 48
  ) {
    if (mood.worry >= 42) return { text: pick(["那件事，不用现在说。", "先放着也行。我在。"], today) };
    const latest = [...memories].sort((a, b) => b.at - a.at)[0];
    if (latest && now - latest.at < 6 * 86400000) {
      const clip = spokenClip(latest.text);
      if (clip) return { text: `你之前说的「${clip}」，后来呢。` };
    }
    if (mood.near >= 64) return { text: "有一会儿没见你说话。" };
    return { text: pick(["你安静了一阵。", "在忙吗。"], today) };
  }
  return null;
}

function clipFact(text: string): string {
  const sentence = (text.replace(/\s+/g, " ").trim().split(/[。！？!?；;\n]/)[0] ?? "").trim();
  const body = sentence.replace(/^(就是|然后|其实|那个|嗯|啊|哎)+/, "").trim();
  if (body.length < 4 || body.length > 48) return "";
  if (/^(哈+|呵+|嗯+|哦+|噢+|好+|行+|早|早安|晚安|在吗|你好|嗨|hi|hello|666)+$/i.test(body)) return "";
  if (!/[\u4e00-\u9fff]{2}/.test(body)) return "";
  return body.slice(0, 28);
}

function spokenClip(text: string): string {
  const clip = text.replace(/[「」"'']/g, "").slice(0, 12);
  return clip.length >= 4 ? clip : "";
}

function similar(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true;
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  if (prefix >= 6) return true;
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.size || !right.size) return false;
  let shared = 0;
  for (const item of left) if (right.has(item)) shared += 1;
  return shared / Math.min(left.size, right.size) >= 0.45;
}

function overlap(query: string, note: string): number {
  const left = bigrams(query);
  const right = bigrams(note);
  let score = 0;
  for (const item of left) {
    if (STOP.has(item)) continue;
    if (right.has(item)) score += 1;
  }
  return score;
}

function bigrams(text: string): Set<string> {
  const chars = text.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < chars.length - 1; i += 1) out.add(chars.slice(i, i + 2));
  return out;
}

function pick(lines: string[], day: string): string {
  const n = [...day].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return lines[n % lines.length];
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}
