import { community } from "./community";
import type { Bond } from "./moli/emotion";
import type { Mood } from "./presence";
import { getState, hydrate, isPerson, onSave, quietly, replaceState, type AppState } from "./store";
import type { Person } from "./types";

const RESTORE = "shijie-suanfa/restore";
const SAVED = "shijie-suanfa/saved-at";
const DIRTY = "shijie-suanfa/dirty";
const OPENED = "shijie-suanfa/opened";

type SessionUser = { id: string; name: string; birth: boolean; updatedAt: number };

type Sky = {
  updatedAt: number;
  galaxyId: string;
  roundTurns: number;
  conjunctionAt: number | null;
  conjunctionAsked: boolean;
  ziHour: "early" | "late";
  person: Person;
  stars: AppState["stars"];
  messages: AppState["messages"];
  memories: AppState["memories"];
  mood: Mood | null;
  bond: Bond | null;
  reachedAt: number | null;
};

let started = false;
let flight: Promise<void> | null = null;

export function startAccountSync() {
  if (!started) {
    started = true;
    onSave(() => schedulePush());
  }
  if (!flight) {
    flight = reconcile().finally(() => {
      flight = null;
    });
  }
  return flight;
}

export async function saveAccount(person: Person, kind?: "open" | "edit" | "import") {
  const state = getState();
  const saved = await community<{ user: SessionUser | null; restoreKey?: string; updatedAt: number }>(
    "/account",
    "PUT",
    {
      person,
      galaxyId: state.galaxyId,
      kind,
    },
  );
  if (saved.restoreKey) localStorage.setItem(RESTORE, saved.restoreKey);
  if (kind === "open" || kind === "edit" || kind === "import") markOpened();
  localStorage.setItem(SAVED, String(saved.updatedAt || Date.now()));
  return saved;
}

export async function restoreAccount(restoreKey: string) {
  const saved = await community<{ user: SessionUser; updatedAt: number }>("/restore", "POST", { restoreKey });
  localStorage.setItem(RESTORE, restoreKey);
  localStorage.setItem(SAVED, String(saved.updatedAt || 0));
  return saved;
}

let timer = 0;
function schedulePush() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void pushSky().catch(() => window.setTimeout(() => void pushSky().catch(() => {}), 5000)), 800);
}

async function pushSky() {
  const state = getState();
  if (!state.self) return;
  await saveAccount(state.self);
  const saved = await community<{ updatedAt: number }>("/sky", "PUT", skyBody(state));
  localStorage.setItem(SAVED, String(saved.updatedAt));
  localStorage.setItem(DIRTY, "0");
}

async function reconcile() {
  const local = getState();
  let session: { user: SessionUser | null };
  try {
    session = await community<{ user: SessionUser | null }>("/session");
  } catch {
    return;
  }
  if (!session.user && local.self) {
    await saveAccount(local.self, "open").catch(() => {});
    await pushSky().catch(() => {});
    return;
  }
  if (!session.user) return;
  if (!session.user.birth && local.self) {
    await saveAccount(local.self, "open").catch(() => {});
    await pushSky().catch(() => {});
    return;
  }
  if (session.user.birth && !local.self) {
    await pullSky();
    await noteOpen();
    return;
  }
  if (localStorage.getItem(DIRTY) === "1" && local.self) {
    await pushSky().catch(() => {});
    await noteOpen();
    return;
  }
  const savedAt = Number(localStorage.getItem(SAVED) || 0);
  if (session.user.birth && session.user.updatedAt > savedAt) await pullSky();
  await noteOpen();
}

async function pullSky() {
  const sky = await community<Sky>("/sky");
  if (!isPerson(sky.person)) return;
  const local = getState();
  quietly(() => {
    replaceState(
      hydrate({
        ...local,
        self: sky.person,
        galaxyId: sky.galaxyId || local.galaxyId,
        stars: sky.stars,
        messages: sky.messages,
        memories: sky.memories,
        mood: sky.mood || local.mood,
        bond: sky.bond || local.bond,
        reachedAt: sky.reachedAt,
        roundTurns: sky.roundTurns,
        conjunctionAt: sky.conjunctionAt,
        conjunctionAsked: sky.conjunctionAsked,
        settings: { ...local.settings, ziHour: sky.ziHour },
      }),
    );
  });
  localStorage.setItem(SAVED, String(sky.updatedAt || 0));
  localStorage.setItem(DIRTY, "0");
}

async function noteOpen() {
  try {
    if (sessionStorage.getItem(OPENED) === "1") return;
    sessionStorage.setItem(OPENED, "1");
  } catch {
    return;
  }
  await community("/events", "POST", { kind: "open" }).catch(() => {});
}

function markOpened() {
  try {
    sessionStorage.setItem(OPENED, "1");
  } catch {
    // 记不住这次打开也没关系，下次进来还会记。
  }
}

function skyBody(state: AppState) {
  return {
    galaxyId: state.galaxyId,
    roundTurns: state.roundTurns,
    conjunctionAt: state.conjunctionAt,
    conjunctionAsked: state.conjunctionAsked,
    ziHour: state.settings.ziHour,
    stars: state.stars,
    messages: state.messages.slice(-300),
    memories: state.memories,
    mood: state.mood,
    bond: state.bond,
    reachedAt: state.reachedAt,
  };
}

export function restoreKey() {
  return localStorage.getItem(RESTORE);
}
