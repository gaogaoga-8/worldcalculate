// Fantasy Orchestral Theme by Joth, CC0.
// https://opengameart.org/content/fantasy-orchestral-theme

const SRC = "/bgm/fantasy-orchestral-theme.mp3";
const MUSIC_KEY = "shijie-suanfa/music";

let ctx: AudioContext | null = null;
let audio: HTMLAudioElement | null = null;
let gain: GainNode | null = null;
let mode: "idle" | "opening" | "receding" | "igniting" = "idle";
let enabled = readEnabled();
let recedeTimer = 0;
const listeners = new Set<(on: boolean) => void>();

function readEnabled() {
  try {
    return localStorage.getItem(MUSIC_KEY) !== "0";
  } catch {
    return true;
  }
}

function remember(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(MUSIC_KEY, on ? "1" : "0");
  } catch {
    // 记不住开关时，这一次仍然照做。
  }
  listeners.forEach((listener) => listener(on));
}

export function musicOn() {
  return enabled;
}

export function subscribeMusic(listener: (on: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function ensure() {
  if (audio && ctx && gain) return;
  audio = new Audio(SRC);
  audio.preload = "auto";
  const context = new AudioContext();
  const source = context.createMediaElementSource(audio);
  const level = context.createGain();
  level.gain.value = 0;
  source.connect(level);
  level.connect(context.destination);
  ctx = context;
  gain = level;
}

async function playFromStart(loop: boolean, level: number) {
  ensure();
  if (!ctx || !audio || !gain) return false;
  window.clearTimeout(recedeTimer);
  await ctx.resume();
  const now = ctx.currentTime;
  audio.loop = loop;
  audio.currentTime = 0;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(level, now + 0.6);
  await audio.play();
  return true;
}

export async function beginOpening() {
  if (!enabled || mode === "opening" || mode === "igniting") return;
  mode = "opening";
  try {
    await playFromStart(true, 0.72);
  } catch {
    mode = "idle";
  }
}

export function recedeOpening() {
  if (!ctx || !gain || !audio || (mode !== "opening" && mode !== "igniting")) return;
  mode = "receding";
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + 2.8);
  recedeTimer = window.setTimeout(() => {
    if (mode !== "receding" || !audio) return;
    audio.pause();
    mode = "idle";
  }, 3000);
}

export async function igniteFate() {
  if (!enabled) return;
  mode = "igniting";
  try {
    await playFromStart(false, 0.5);
    if (!ctx || !gain) return;
    const now = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(1, now + 48);
  } catch {
    mode = "idle";
  }
}

export function noteConjunction(before: number, after: number, total = 7) {
  if (before < total && after >= total) void igniteFate();
}

export async function toggleMusic() {
  if (enabled) {
    remember(false);
    if (!ctx || !gain || !audio || mode === "idle") return;
    mode = "receding";
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.45);
    recedeTimer = window.setTimeout(() => {
      if (!audio) return;
      audio.pause();
      mode = "idle";
    }, 500);
    return;
  }
  remember(true);
  mode = "idle";
  await beginOpening();
}
