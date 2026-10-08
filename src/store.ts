import { useSyncExternalStore } from "react";
import { coreStar, isCardPlace, type LitStar, type PlanMark, type StarLink } from "./galaxy";
import type { QuizAnswers } from "./mbti";
import type { Person } from "./types";

export type ChatMessage = { id: string; role: "user" | "guide"; text: string; at?: number };

export type Settings = { ziHour: "early" | "late" };

export type AppState = {
  self: Person | null;
  galaxyId: string;
  stars: LitStar[];
  links: StarLink[];
  roundTurns: number;
  people: Person[];
  quiz: QuizAnswers | null;
  messages: ChatMessage[];
  branchMessages: ChatMessage[];
  mirror: string | null;
  plans: PlanMark[];
  settings: Settings;
};

const KEY = "shijie-suanfa/v1";
const RESET_BACKUP_KEY = "shijie-suanfa/before-reset";

const initial: AppState = {
  self: null,
  galaxyId: "",
  stars: [],
  links: [],
  roundTurns: 0,
  people: [],
  quiz: null,
  messages: [],
  branchMessages: [],
  mirror: null,
  plans: [],
  settings: { ziHour: "early" },
};

let state = load();
const listeners = new Set<() => void>();

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const data = JSON.parse(raw) as { version?: number; state?: AppState };
    if (data.version !== 1 || !data.state) return initial;
    return hydrate(data.state);
  } catch {
    return initial;
  }
}

function emit() {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, state }));
  listeners.forEach((listener) => listener());
}

export function getState(): AppState {
  return state;
}

export function updateState(patch: Partial<AppState> | ((prev: AppState) => AppState)) {
  state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
  emit();
}

export function replaceState(next: AppState) {
  state = next;
  emit();
}

export function hydrate(raw: Partial<AppState>): AppState {
  const self = raw.self ?? null;
  const stars = (Array.isArray(raw.stars) ? raw.stars.filter(isStar) : []).map((star) => ({
    ...star,
    note: star.note ?? "",
    echo: star.echo ?? "",
    god: star.god ?? "",
    litAt: star.litAt || Date.now(),
  }));
  if (self && stars.length === 0) stars.push(coreStar("本命"));
  const links = (Array.isArray(raw.links) ? raw.links.filter(isLink) : []).map(normalizeLink);
  return {
    ...initial,
    ...raw,
    self,
    galaxyId: typeof raw.galaxyId === "string" && raw.galaxyId ? raw.galaxyId : self ? crypto.randomUUID() : "",
    stars,
    links,
    roundTurns: typeof raw.roundTurns === "number" ? raw.roundTurns : 0,
    people: Array.isArray(raw.people) ? raw.people : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    branchMessages: Array.isArray(raw.branchMessages) ? raw.branchMessages : [],
    mirror: typeof raw.mirror === "string" ? raw.mirror : null,
    plans: Array.isArray(raw.plans) ? raw.plans.filter(isPlan) : [],
    settings: { ...initial.settings, ...raw.settings },
  };
}

export function resetState() {
  const hasRecords = state.self || state.stars.length || state.messages.length || state.links.length || state.people.length || state.quiz || state.plans.length || state.branchMessages.length;
  if (hasRecords) {
    // Save recovery data first. If storage is unavailable, keep the current records.
    localStorage.setItem(RESET_BACKUP_KEY, JSON.stringify({ version: 1, state, resetAt: Date.now() }));
  }
  const next = hydrate({});
  localStorage.setItem(KEY, JSON.stringify({ version: 1, state: next }));
  state = next;
  listeners.forEach((listener) => listener());
}

export function hasResetBackup(): boolean {
  try { return !!localStorage.getItem(RESET_BACKUP_KEY); } catch { return false; }
}

export function restoreResetBackup(): boolean {
  const raw = localStorage.getItem(RESET_BACKUP_KEY);
  if (!raw) return false;
  const data = JSON.parse(raw) as { version?: number; state?: AppState };
  if (data.version !== 1 || !data.state) return false;
  const next = hydrate(data.state);
  localStorage.setItem(KEY, JSON.stringify({ version: 1, state: next }));
  state = next;
  listeners.forEach((listener) => listener());
  return true;
}

export function restartFromLink(href: string): string | null {
  const url = new URL(href);
  if (url.searchParams.get("restart") !== "1") return null;
  resetState();
  url.searchParams.delete("restart");
  return url.pathname + url.search + url.hash;
}

function isStar(value: unknown): value is LitStar {
  if (!value || typeof value !== "object") return false;
  const star = value as LitStar;
  return typeof star.id === "string" && (star.kind === "core" || star.kind === "round") && typeof star.title === "string";
}

function isLink(value: unknown): value is StarLink {
  if (!value || typeof value !== "object") return false;
  const link = value as StarLink;
  return typeof link.id === "string" && typeof link.name === "string";
}

function normalizeLink(link: StarLink): StarLink {
  const exchanges = Array.isArray(link.exchanges) ? link.exchanges.filter((item) => typeof item === "number") : [];
  return {
    ...link,
    mbti: link.mbti ?? null,
    pillar: link.pillar ?? "",
    stars: typeof link.stars === "number" ? link.stars : 1,
    place: isCardPlace(link.place) ? link.place : null,
    exchanges: exchanges.length ? exchanges : [link.at || Date.now()],
    at: link.at || exchanges[0] || Date.now(),
  };
}

function isPlan(value: unknown): value is PlanMark {
  if (!value || typeof value !== "object") return false;
  const plan = value as PlanMark;
  return typeof plan.id === "string" && typeof plan.text === "string";
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState,
    getState,
  );
}

export function isPerson(value: unknown): value is Person {
  if (!value || typeof value !== "object") return false;
  const v = value as Person;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    (v.gender === "male" || v.gender === "female") &&
    !!v.time &&
    typeof v.time.year === "number" &&
    !!v.place &&
    typeof v.place.longitude === "number" &&
    typeof v.place.timezone === "number"
  );
}
