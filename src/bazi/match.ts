import type { Chart } from "./chart";
import { BRANCHES, ELEMENTS, stemElement } from "./ganzhi";
import { clamp } from "./math";

export type MatchBand = {
  id: string;
  label: string;
  score: number | null;
  detail: string;
};

export type MatchReport = {
  score: number | null;
  summary: string;
  bands: MatchBand[];
  tags: string[];
};

const LIUHE: [number, number][] = [
  [0, 1],
  [2, 11],
  [3, 10],
  [4, 9],
  [5, 8],
  [6, 7],
];
const CHONG: [number, number][] = [
  [0, 6],
  [1, 7],
  [2, 8],
  [3, 9],
  [4, 10],
  [5, 11],
];
const HAI: [number, number][] = [
  [0, 7],
  [1, 6],
  [2, 5],
  [3, 4],
  [8, 11],
  [9, 10],
];
const SANHE: number[][] = [
  [8, 0, 4],
  [2, 6, 10],
  [11, 3, 7],
  [5, 9, 1],
];
const XING: number[][] = [
  [2, 5, 8],
  [1, 10, 7],
  [0, 3],
];
const SELF_XING = new Set([4, 6, 9, 11]);

const WEIGHT: Record<string, number> = { year: 1, month: 1.3, day: 2.2, hour: 1.15 };

export function matchCharts(a: Chart, b: Chart, mbtiA: string | null, mbtiB: string | null): MatchReport {
  const element = elementBand(a, b);
  const branch = branchBand(a, b);
  const persona = mbtiBand(mbtiA, mbtiB);
  const bands = [element, branch, persona];
  const weights: Record<string, number> = { element: 0.42, branch: 0.28, mbti: 0.3 };
  let acc = 0;
  let w = 0;
  for (const band of bands) {
    if (band.score == null) continue;
    acc += band.score * weights[band.id];
    w += weights[band.id];
  }
  const score = w === 0 ? null : Math.round(acc / w);
  const tags = branch.tags ?? [];
  const summary = buildSummary(a, b, element, tags, mbtiA, mbtiB, score);
  return { score, summary, bands, tags };
}

function elementBand(a: Chart, b: Chart): MatchBand & { relation: string } {
  const ea = stemElement(a.dayMaster);
  const eb = stemElement(b.dayMaster);
  const nameA = ELEMENTS[ea];
  const nameB = ELEMENTS[eb];
  let score = 70;
  let relation = "比和";
  let detail = `两边日主都是${nameA}。同频，容易懂，也容易在同一件事上较劲。`;
  if (ea === eb) {
    score = 76;
  } else if ((ea + 1) % 5 === eb) {
    relation = "我生";
    score = 80;
    detail = `你的${nameA}生对方的${nameB}。你这边更常输出，对方更常承接。`;
  } else if ((eb + 1) % 5 === ea) {
    relation = "生我";
    score = 84;
    detail = `对方的${nameB}生你的${nameA}。对方的节奏容易托住你。`;
  } else if ((ea + 2) % 5 === eb) {
    relation = "我克";
    score = 62;
    detail = `你的${nameA}克对方的${nameB}。结构上你更容易定调，对方更容易感到被推动。`;
  } else {
    relation = "克我";
    score = 60;
    detail = `对方的${nameB}克你的${nameA}。对方更容易定调，你更容易感到被要求。`;
  }
  return { id: "element", label: "日主五行", score, detail, relation };
}

type BranchBand = MatchBand & { tags: string[] };

function branchBand(a: Chart, b: Chart): BranchBand {
  const tags: string[] = [];
  let raw = 0;
  let pairs = 0;
  for (const pa of a.pillars) {
    if (pa.missing) continue;
    for (const pb of b.pillars) {
      if (pb.missing) continue;
      const weight = ((WEIGHT[pa.key] ?? 1) + (WEIGHT[pb.key] ?? 1)) / 2;
      const rel = relationOf(pa.branch, pb.branch);
      if (!rel) continue;
      pairs += 1;
      raw += rel.point * weight;
      const where = `${pa.label.slice(0, 1)}支${rel.name}${pb.label.slice(0, 1)}支`;
      if (pa.key === "day" || pb.key === "day") tags.push(`${BRANCHES[pa.branch]}${BRANCHES[pb.branch]}${rel.name}`);
      else if (tags.length < 6) tags.push(where);
    }
  }
  const unique = [...new Set(tags)].slice(0, 6);
  const score = clamp(Math.round(70 + raw), 36, 96);
  const detail =
    pairs === 0
      ? "四柱地支之间没有明显的合、冲、刑、害。相处少了现成的剧本，也少了现成的摩擦。"
      : `地支上能对上的关系有 ${unique.join("、") || "若干处"}。合是靠近，冲是张力，都不是结论。`;
  return { id: "branch", label: "地支关系", score, detail, tags: unique };
}

function relationOf(a: number, b: number): { name: string; point: number } | null {
  if (pairHas(LIUHE, a, b)) return { name: "六合", point: 8 };
  if (sameTrio(SANHE, a, b)) return { name: "半合", point: 5 };
  if (pairHas(CHONG, a, b)) return { name: "相冲", point: -5 };
  if (pairHas(HAI, a, b)) return { name: "六害", point: -3 };
  if (xing(a, b)) return { name: "相刑", point: -3 };
  return null;
}

function pairHas(list: [number, number][], a: number, b: number): boolean {
  return list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function sameTrio(list: number[][], a: number, b: number): boolean {
  if (a === b) return false;
  return list.some((group) => group.includes(a) && group.includes(b));
}

function xing(a: number, b: number): boolean {
  if (a === b && SELF_XING.has(a)) return true;
  return XING.some((group) => group.includes(a) && group.includes(b) && a !== b);
}

function mbtiBand(a: string | null, b: string | null): MatchBand {
  if (!a || !b) {
    return {
      id: "mbti",
      label: "人格类型",
      score: null,
      detail: "有一边还没有 MBTI。这一项先空着，总分只用八字结构。",
    };
  }
  let score = 58;
  const notes: string[] = [];
  if (a === b) {
    score = 84;
    notes.push("同一个类型，容易懂对方的默认设置，也容易放大同一种盲点。");
  }
  if (a[0] === b[0]) {
    score += 6;
    notes.push(a[0] === "E" ? "都偏向外走，在一起不容易冷场。" : "都偏向先收回来，安静相处比较容易。");
  } else {
    score += 7;
    notes.push("一个外放，一个内收，常常刚好补上对方不愿做的那一半。");
  }
  if (a[1] === b[1]) {
    score += 14;
    notes.push(a[1] === "N" ? "都习惯谈可能，聊天不容易掉在细节里。" : "都盯着具体的事，比较容易把话说实。");
  } else {
    score -= 6;
    notes.push("一个看眼前，一个看可能。要相处，得互相翻译。");
  }
  if (a[2] === b[2]) {
    score += 6;
    notes.push(a[2] === "T" ? "做决定时都先看是否站得住。" : "做决定时都会先感到人。");
  } else {
    score += 2;
    notes.push("一个先讲道理，一个先讲感受。摩擦通常出在这里，也往往补在这里。");
  }
  if (a[3] === b[3]) {
    score += 8;
    notes.push(a[3] === "J" ? "都想把事情定下来。" : "都想给事情留余地。");
  } else {
    score -= 2;
    notes.push("一个要安排，一个要敞开。日程是最容易碰的地方。");
  }
  return {
    id: "mbti",
    label: "人格类型",
    score: clamp(Math.round(score), 34, 96),
    detail: `${a} 与 ${b}。${notes.slice(0, 3).join("")}`,
  };
}

function buildSummary(
  a: Chart,
  b: Chart,
  element: { relation: string; detail: string },
  tags: string[],
  mbtiA: string | null,
  mbtiB: string | null,
  score: number | null,
): string {
  const who = `${a.person.name}与${b.person.name}`;
  const head = score == null ? who : `${who}，结构分 ${score}`;
  const tag = tags[0] ? `地支上最显的是${tags[0]}。` : "";
  const type = mbtiA && mbtiB ? `人格是 ${mbtiA} 对 ${mbtiB}。` : "";
  return `${head}。日主是${element.relation}。${element.detail}${tag}${type}`;
}
