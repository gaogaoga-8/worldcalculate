import { useSyncExternalStore } from "react";
import { coreStar, ensurePalaces, isCardPlace, type LitStar, type PlanMark, type StarLink } from "./galaxy";
import { newId } from "./id";
import type { QuizAnswers } from "./mbti";
import { REST_BOND, isBond, type Bond } from "./moli/emotion";
import { REST_MOOD, rememberAll, type MemoryNote, type Mood } from "./presence";
import type { Person } from "./types";

export type ChatMessage = { id: string; role: "user" | "guide"; text: string; at?: number; reach?: boolean };

export type AskRecord = {
  id: string;
  kind: "thing" | "feeling" | "bond";
  question: string;
  answer: string;
  at: number;
  whose: "self" | "named";
  subjectName: string;
};

export type Settings = { ziHour: "early" | "late" };

export type AppState = {
  self: Person | null;
  galaxyId: string;
  stars: LitStar[];
  links: StarLink[];
  roundTurns: number;
  people: Person[];
  quiz: QuizAnswers | null;
  personaSource: "typed" | "quiz" | null;
  messages: ChatMessage[];
  asks: AskRecord[];
  branchMessages: ChatMessage[];
  mirror: string | null;
  plans: PlanMark[];
  settings: Settings;
  conjunctionAt: number | null;
  conjunctionAsked: boolean;
  memories: MemoryNote[];
  mood: Mood;
  bond: Bond;
  reachedAt: number | null;
};

const KEY = "shijie-suanfa/v1";
const RESET_BACKUP_KEY = "shijie-suanfa/before-reset";
const CHAT_EPOCH = "2";
const CHAT_EPOCH_KEY = "shijie-suanfa/chat-epoch";

const initial: AppState = {
  self: null,
  galaxyId: "",
  stars: [],
  links: [],
  roundTurns: 0,
  people: [],
  quiz: null,
  personaSource: null,
  messages: [],
  asks: [],
  branchMessages: [],
  mirror: null,
  plans: [],
  settings: { ziHour: "early" },
  conjunctionAt: null,
  conjunctionAsked: false,
  memories: [],
  mood: { ...REST_MOOD },
  bond: { ...REST_BOND },
  reachedAt: null,
};

let state = load();
const listeners = new Set<() => void>();

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const data = JSON.parse(raw) as { version?: number; state?: AppState };
    if (data.version !== 1 || !data.state) return initial;
    const savedPalaces = Array.isArray(data.state.stars)
      ? data.state.stars.filter((star) => star?.kind === "palace").length
      : 0;
    const next = hydrate(data.state);
    let dirty = next.stars.filter((star) => star.kind === "palace").length !== savedPalaces;
    if (localStorage.getItem(CHAT_EPOCH_KEY) !== CHAT_EPOCH) {
      next.messages = [];
      localStorage.setItem(CHAT_EPOCH_KEY, CHAT_EPOCH);
      dirty = true;
    }
    if (dirty) localStorage.setItem(KEY, JSON.stringify({ version: 1, state: next }));
    return next;
  } catch {
    return initial;
  }
}

const savers = new Set<(next: AppState) => void>();
let quiet = false;

export function onSave(listener: (next: AppState) => void) {
  savers.add(listener);
  return () => savers.delete(listener);
}

export function quietly(run: () => void) {
  quiet = true;
  try {
    run();
  } finally {
    quiet = false;
  }
}

function emit() {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, state }));
  if (!quiet) {
    localStorage.setItem("shijie-suanfa/dirty", "1");
    savers.forEach((listener) => listener(state));
  }
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
  const stars: LitStar[] = (Array.isArray(raw.stars) ? raw.stars.filter(isStar) : []).map((star) => ({
    ...star,
    note: star.note ?? "",
    echo: star.echo ?? "",
    god: star.god ?? "",
    litAt: star.litAt || Date.now(),
    reading: star.reading ?? "",
  }));
  if (self && stars.length === 0) stars.push(coreStar("本命"));
  const sky = self ? withPalaces(stars) : stars;
  const links = (Array.isArray(raw.links) ? raw.links.filter(isLink) : []).map(normalizeLink);
  return {
    ...initial,
    ...raw,
    self,
    galaxyId: typeof raw.galaxyId === "string" && raw.galaxyId ? raw.galaxyId : self ? newId() : "",
    stars: sky,
    links,
    roundTurns: typeof raw.roundTurns === "number" ? raw.roundTurns : 0,
    people: Array.isArray(raw.people) ? raw.people.filter(isPerson) : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    asks: Array.isArray(raw.asks) ? raw.asks.filter(isAsk).slice(-40) : [],
    branchMessages: Array.isArray(raw.branchMessages) ? raw.branchMessages : [],
    mirror: typeof raw.mirror === "string" ? raw.mirror : null,
    plans: Array.isArray(raw.plans) ? raw.plans.filter(isPlan) : [],
    personaSource: raw.personaSource === "typed" || raw.personaSource === "quiz" ? raw.personaSource : null,
    settings: { ...initial.settings, ...raw.settings },
    conjunctionAt: typeof raw.conjunctionAt === "number" ? raw.conjunctionAt : null,
    conjunctionAsked: raw.conjunctionAsked === true,
    memories: Array.isArray(raw.memories)
      ? raw.memories.filter(isMemory).slice(-18)
      : rememberAll([], Array.isArray(raw.messages) ? raw.messages : []),
    mood: isMood(raw.mood) ? raw.mood : { ...REST_MOOD },
    bond: isBond(raw.bond) ? raw.bond : { ...REST_BOND },
    reachedAt: typeof raw.reachedAt === "number" ? raw.reachedAt : null,
  };
}

export function resetState() {
  const hasRecords = state.self || state.stars.length || state.messages.length || state.links.length || state.people.length || state.quiz || state.plans.length || state.branchMessages.length || state.memories.length;
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

function withPalaces(stars: LitStar[]): LitStar[] {
  return ensurePalaces(stars);
}

function isStar(value: unknown): value is LitStar {
  if (!value || typeof value !== "object") return false;
  const star = value as LitStar;
  return typeof star.id === "string" && (star.kind === "core" || star.kind === "round" || star.kind === "palace") && typeof star.title === "string";
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

function isMemory(value: unknown): value is MemoryNote {
  if (!value || typeof value !== "object") return false;
  const note = value as MemoryNote;
  return typeof note.id === "string" && typeof note.text === "string" && typeof note.at === "number";
}

function isMood(value: unknown): value is Mood {
  if (!value || typeof value !== "object") return false;
  const mood = value as Mood;
  return [mood.near, mood.sting, mood.worry, mood.lift, mood.at].every((item) => typeof item === "number");
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

function isAsk(value: unknown): value is AskRecord {
  if (!value || typeof value !== "object") return false;
  const ask = value as AskRecord;
  return typeof ask.id === "string"
    && (ask.kind === "thing" || ask.kind === "feeling" || ask.kind === "bond")
    && typeof ask.question === "string"
    && typeof ask.answer === "string"
    && typeof ask.at === "number";
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
