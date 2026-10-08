export const ROUND_TURNS = 2;

export const MIRROR_AT = 7;

// Daily progression follows the mainland China calendar, even on a device abroad.
export function starDay(at: number): string {
  return new Date(at + 8 * 3600000).toISOString().slice(0, 10);
}

export function dailyRoundTurns(
  messages: { role: string; at?: number }[],
  roundTurns: number,
  now = Date.now(),
): number {
  if (roundTurns <= 0) return 0;
  return messages
    .filter((message) => message.role === "user")
    .slice(-roundTurns)
    .filter((message) => message.at && starDay(message.at) === starDay(now))
    .length;
}

export function starProgress(
  stars: LitStar[],
  roundTurns: number,
  now = Date.now(),
) {
  const rounds = stars.filter((star) => star.kind === "round");
  const latest = Math.max(0, ...rounds.map((star) => star.litAt));
  const complete = rounds.length >= MIRROR_AT;
  const litToday = latest > 0 && starDay(latest) >= starDay(now);
  return {
    complete,
    litToday,
    allowed: !complete && !litToday && roundTurns >= ROUND_TURNS,
    remaining: Math.max(0, MIRROR_AT - rounds.length),
  };
}

export function starPosition(index: number) {
  // Stable locations: existing stars never move when the next one lights up.
  const positions = [
    [34, 25],
    [72, 34],
    [77, 65],
    [56, 79],
    [26, 69],
    [19, 43],
    [54, 17],
  ];
  const [x, y] = positions[index % positions.length];
  return { x, y };
}

export type LitStar = {
  id: string;
  kind: "core" | "round";
  title: string;
  note: string;
  echo: string;
  god: string;
  litAt: number;
};

export type CardPlace = { name: string; longitude: number; latitude: number };

export type StarLink = {
  id: string;
  name: string;
  mbti: string | null;
  pillar: string;
  stars: number;
  place: CardPlace | null;
  exchanges: number[];
  at: number;
};

export type PlanMark = { id: string; text: string; at: number };

export type GalaxyCard = {
  v: 1;
  id: string;
  name: string;
  mbti: string | null;
  pillar: string;
  stars: number;
  place?: CardPlace;
};

export function encodeGalaxy(card: GalaxyCard): string {
  const bytes = new TextEncoder().encode(JSON.stringify(card));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `SJ1.${b64}`;
}

export function decodeGalaxy(raw: string): GalaxyCard | null {
  const text = raw.trim();
  const body = text.startsWith("SJ1.") ? text.slice(4) : text;
  try {
    const padded =
      body.replace(/-/g, "+").replace(/_/g, "/") +
      "===".slice((body.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as GalaxyCard;
    if (
      data.v !== 1 ||
      typeof data.id !== "string" ||
      typeof data.name !== "string"
    )
      return null;
    if (data.place && !isCardPlace(data.place)) delete data.place;
    return data;
  } catch {
    return null;
  }
}

export function isCardPlace(value: unknown): value is CardPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as CardPlace;
  return (
    typeof place.name === "string" &&
    typeof place.longitude === "number" &&
    typeof place.latitude === "number"
  );
}

export function coreStar(title = "本命"): LitStar {
  return {
    id: crypto.randomUUID(),
    kind: "core",
    title,
    note: "",
    echo: "",
    god: "",
    litAt: Date.now(),
  };
}

export function roundStar(
  title: string,
  sensed: { god: string; echo: string },
): LitStar {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 18) || "这一轮";
  return {
    id: crypto.randomUUID(),
    kind: "round",
    title: clean,
    note: "",
    echo: sensed.echo,
    god: sensed.god,
    litAt: Date.now(),
  };
}

export function formed(star: LitStar): boolean {
  return (
    star.kind === "round" &&
    star.note.trim().length > 0 &&
    star.echo.trim().length > 0
  );
}

export function mirrorLine(stars: LitStar[]): string {
  const counts = new Map<string, number>();
  for (const star of stars) {
    if (star.kind !== "round" || !star.god) continue;
    counts.set(star.god, (counts.get(star.god) ?? 0) + 1);
  }
  let top = "";
  let best = 0;
  for (const [god, count] of counts) {
    if (count > best) {
      top = god;
      best = count;
    }
  }
  return top && best >= 2
    ? `这几轮你一直回到${top}。`
    : "这几轮你一直回到你自己写下的那些句子。";
}

export function lineStrength(exchanges: number[], now = Date.now()): number {
  if (exchanges.length === 0) return 0.12;
  const last = Math.max(...exchanges);
  const days = Math.max(0, (now - last) / 86400000);
  const recency = Math.exp(-days / 21);
  const count = Math.min(1, exchanges.length / 6);
  return 0.12 + 0.82 * (count * 0.55 + recency * 0.45);
}
