import { useEffect, useRef } from "react";
import { CITIES, PROVINCES } from "../places";
import { birthError, type BirthSelection } from "./BirthFields";
import type { Gender, Person } from "../types";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseWhen(date: string, time: string): BirthSelection | null {
  const day = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const clock = time.match(/^(\d{2}):(\d{2})$/);
  if (!day || !clock) return null;
  return {
    year: day[1],
    month: String(Number(day[2])),
    day: String(Number(day[3])),
    hour: String(Number(clock[1])),
    minute: String(Number(clock[2])),
    unknown: false,
  };
}

export function personFromRiver(values: {
  origin?: { place?: string };
  birth?: { date?: string; time?: string };
  sign?: { name?: string; gender?: string };
}): Person | null {
  const city = locate(values.origin?.place || "");
  const when = parseWhen(values.birth?.date || "", values.birth?.time || "");
  const gender = values.sign?.gender === "male" || values.sign?.gender === "female" ? values.sign.gender : "";
  if (!city || !when || birthError(when) || !gender || !values.sign?.name?.trim()) return null;
  return {
    id: "self",
    name: values.sign.name.trim(),
    gender: gender as Gender,
    time: {
      year: Number(when.year),
      month: Number(when.month),
      day: Number(when.day),
      hour: Number(when.hour),
      minute: Number(when.minute),
    },
    place: { name: city.name, longitude: city.longitude, latitude: city.latitude, timezone: 8 },
    hourUnknown: false,
    mbti: null,
  };
}

function seedGalaxy(person: Person, force = false) {
  try {
    if (!force && localStorage.getItem("star-river:galaxy")) return;
    localStorage.setItem("star-river:galaxy", JSON.stringify({
      values: {
        origin: { place: person.place.name.replace(/市$/u, "") },
        birth: {
          date: `${person.time.year}-${pad(person.time.month)}-${pad(person.time.day)}`,
          time: `${pad(person.time.hour ?? 0)}:${pad(person.time.minute ?? 0)}`,
        },
        sign: { name: person.name, gender: person.gender },
      },
      chats: [],
    }));
  } catch {
    // 这台浏览器记不住星系时，星河会重新问三颗星。
  }
}

function locate(place: string) {
  const bare = place.replace(/市$/u, "");
  const known = CITIES.find((city) => city.name === place || city.name === bare);
  if (known) return { name: known.name, longitude: known.longitude, latitude: known.latitude, timezone: known.timezone || 8 };
  for (const province of PROVINCES) {
    const city = province.cities.find((item) => item.name === place || item.name.replace(/市$/u, "") === bare);
    if (city) return { name: city.name.replace(/市$/u, ""), longitude: city.longitude, latitude: city.latitude, timezone: 8 };
  }
  return null;
}

function cityPayload() {
  return PROVINCES.map((province) => ({
    name: province.name,
    cities: province.cities.map((city) => city.name),
  }));
}

function samePerson(current: Person | null, next: Person) {
  if (!current) return false;
  return current.name === next.name
    && current.gender === next.gender
    && current.place.name === next.place.name
    && current.time.year === next.time.year
    && current.time.month === next.time.month
    && current.time.day === next.time.day
    && current.time.hour === next.time.hour
    && current.time.minute === next.time.minute;
}

export function rememberGalaxy(person: Person) {
  seedGalaxy(person, true);
}

export function StarRiverHome({
  person,
  resetKey = 0,
  reset = false,
  history = false,
  cover = false,
  authed = false,
  rounds = [],
  guide = "done",
  onReady,
  onGuideAnchor,
  onRelightDone,
  onPlaced,
  onPick,
  onGuide,
  onClaim,
}: {
  person: Person | null;
  resetKey?: number;
  reset?: boolean;
  history?: boolean;
  cover?: boolean;
  authed?: boolean;
  rounds?: { id: string; title: string }[];
  guide?: string;
  onReady: (person: Person) => void;
  onGuideAnchor?: (step: string, point: { left: number; right: number; top: number; mid: number } | null) => void;
  onRelightDone?: () => void;
  onPlaced?: () => void;
  onPick?: (id: string, slow?: boolean) => void;
  onGuide?: (step: string) => void;
  onClaim?: (name: string, secret: string) => Promise<{ ok: boolean; restore?: boolean; guide?: boolean; message?: string }>;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const roundsRef = useRef(rounds);
  const authedRef = useRef(authed);
  const claimRef = useRef(onClaim);
  const guideRef = useRef(guide);
  roundsRef.current = rounds;
  authedRef.current = authed;
  claimRef.current = onClaim;
  guideRef.current = guide;
  if (history && person) seedGalaxy(person, true);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "star-river") return;
      if (data.event === "need-cities") {
        frame.current?.contentWindow?.postMessage({
          type: "worldcal",
          event: "cities",
          regions: cityPayload(),
        }, "*");
        frame.current?.contentWindow?.postMessage({ type: "worldcal", event: "auth", needed: !authedRef.current }, "*");
      }
      if (data.event === "relight-done") onRelightDone?.();
      if (data.event === "guide-anchor") {
        const point = data.point as { left: number; right: number; top: number; mid: number } | null;
        onGuideAnchor?.(String(data.step || ""), point);
      }
      if (data.event === "settled" || data.event === "relight-done") {
        frame.current?.contentWindow?.postMessage({ type: "worldcal", event: "guide", step: guideRef.current }, "*");
      }
      if (data.event === "settled") {
        const next = personFromRiver(data.values);
        if (next && !samePerson(person, next)) onReady(next);
        onPlaced?.();
      }
      if (data.event === "pick" && typeof data.id === "string") onPick?.(data.id, data.slow === true);
      if (data.event === "guide" && typeof data.step === "string") onGuide?.(data.step);
      if (data.event === "claim" && claimRef.current) {
        const name = String(data.name || "");
        const secret = String(data.secret || "");
        void claimRef.current(name, secret).then((result) => {
          frame.current?.contentWindow?.postMessage({ type: "worldcal", event: "claim-result", ...result }, "*");
        });
      }
    };
    const onChat = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      frame.current?.contentWindow?.postMessage({ type: "worldcal", event: "chat", text }, "*");
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("worldcal-chat", onChat);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("worldcal-chat", onChat);
    };
  }, [onReady, onGuideAnchor, onRelightDone, onPlaced, onPick, person]);
  const tellFrame = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    win.postMessage({
      type: "worldcal",
      event: "cities",
      regions: cityPayload(),
    }, "*");
    win.postMessage({ type: "worldcal", event: "rounds", stars: roundsRef.current }, "*");
    win.postMessage({ type: "worldcal", event: "auth", needed: !authedRef.current }, "*");
    win.postMessage({ type: "worldcal", event: "guide", step: guide }, "*");
    if (cover) win.postMessage({ type: "worldcal", event: "cover" }, "*");
  };
  const roundKey = rounds.map((star) => `${star.id}:${star.title}`).join("|");
  useEffect(() => { tellFrame(); }, [roundKey, authed, guide, resetKey]);
  useEffect(() => { if (cover) tellFrame(); }, [cover]);
  const query = history ? "history=1" : reset ? "reset=1" : "";
  return (
    <iframe
      key={resetKey}
      ref={frame}
      className="river-frame"
      src={`/star-river/index.html?v=sky32${query ? `&${query}` : ""}`}
      title="星河"
      onLoad={tellFrame}
    />
  );
}
