import type { Chart } from "../bazi/chart";
import { PALACES, type PalaceId } from "../galaxy";
import { askOracle } from "./client";
import { palaceMessages, plainReading } from "./prompt";
import { getState, updateState } from "../store";

/**
 * 六颗宫位星的长文一次要几十秒。用户在看重播动画、还没有点开任何一颗星时，
 * 就先在后台把这些内容算好存进本机，点开时直接用，不再干等。
 */
type Job = { promise: Promise<string> };

const jobs = new Map<string, Job>();
let signature = "";
let running = 0;
const waiting: (() => void)[] = [];
const LIMIT = 2;

function chartKey(chart: Chart) {
  const p = chart.person;
  return [
    p.name,
    p.gender,
    p.time.year,
    p.time.month,
    p.time.day,
    p.time.hour ?? "x",
    p.time.minute ?? "x",
    p.place.name,
    p.mbti ?? "",
  ].join("|");
}

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      running += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          running -= 1;
          waiting.shift()?.();
        });
    };
    if (running < LIMIT) start();
    else waiting.push(start);
  });
}

function saved(palace: PalaceId): string {
  return getState().stars.find((star) => star.palace === palace)?.reading || "";
}

function start(chart: Chart, palace: PalaceId): Job {
  const job: Job = {
    promise: schedule(() => askOracle(palaceMessages(chart, palace)))
      .then((text) => {
        const clean = plainReading(text);
        if (clean)
          updateState((prev) => ({
            ...prev,
            stars: prev.stars.map((star) =>
              star.palace === palace ? { ...star, reading: clean } : star,
            ),
          }));
        return clean;
      })
      .catch((error) => {
        jobs.delete(`${signature}:${palace}`);
        throw error;
      }),
  };
  jobs.set(`${signature}:${palace}`, job);
  return job;
}

/** 已经有的直接返回，没有就排进后台队列，多次请求共用同一次计算。 */
export function readPalace(chart: Chart, palace: PalaceId): Promise<string> {
  const key = chartKey(chart);
  if (key !== signature) {
    signature = key;
    jobs.clear();
  }
  const ready = saved(palace);
  if (ready) return Promise.resolve(ready);
  const existing = jobs.get(`${key}:${palace}`);
  if (existing) return existing.promise;
  return start(chart, palace).promise;
}

/** 用户还在看清河动画时调用，把还没算的宫位星一次排好。 */
export function prefetchPalaces(chart: Chart) {
  const key = chartKey(chart);
  if (key !== signature) {
    signature = key;
    jobs.clear();
  }
  for (const { id } of PALACES) {
    if (saved(id) || jobs.has(`${key}:${id}`)) continue;
    start(chart, id).promise.catch(() => {});
  }
}

export function palaceProgress(): { done: number; total: number } {
  const stars = getState().stars;
  const total = PALACES.length;
  const done = PALACES.filter(
    (palace) => stars.find((star) => star.palace === palace.id)?.reading,
  ).length;
  return { done, total };
}
