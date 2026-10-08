import type { Chart } from "./bazi/chart";
import { BRANCHES, STEMS, tenGod } from "./bazi/ganzhi";
import { formed, lineStrength, type LitStar, type StarLink } from "./galaxy";
import { senseRound } from "./chat";

const FEELING: Record<string, string> = {
  正官: "你在亲近里容易先感到期待和分寸。",
  七杀: "你在亲近里容易先顶上去，或先想撤开。",
  正印: "你在亲近里想被接住，也想自己先想通。",
  偏印: "你在亲近里会往独处和钻研里收。",
  食神: "你在亲近里想舒坦，也在意有没有被看见。",
  伤官: "你在亲近里受不了含糊，会想把话说清楚。",
  正财: "你在亲近里看重事情落不落地。",
  偏财: "你在亲近里对突然靠近的人会先看一眼再信。",
  比肩: "你在亲近里想并肩，有时也会较劲。",
  劫财: "你在亲近里在意会不会被分走。",
};

const HE: [number, number][] = [
  [0, 1],
  [2, 11],
  [3, 10],
  [4, 9],
  [5, 8],
  [6, 7],
];

export function askThing(text: string, stars: LitStar[]): { text: string; ids: string[] } {
  const done = stars.filter(formed);
  if (done.length < 1) return { text: "先给一颗星补上你的那句。你的一句和界面的一句都在，才能问这件事。", ids: [] };
  const god = senseRound(text).god || done[done.length - 1].god;
  const matched = god ? stars.filter((star) => star.kind === "round" && star.god === god) : [];
  const hits = matched.length ? matched : [done[done.length - 1]];
  const ids = hits.map((star) => star.id);
  if (!god) return { text: "这件事还没对上十神。先点亮你刚写完的这一轮。", ids };
  if (hits.length <= 1) return { text: `这件事碰到的是${god}。现在只点亮这一轮。`, ids };
  return { text: `这件事碰到的是${god}，和这几轮是同一处：${hits.map((star) => star.title).join("、")}。`, ids };
}

export function askFeeling(text: string, stars: LitStar[], chart: Chart, links: StarLink[]): { text: string; ids: string[] } {
  const done = stars.filter(formed);
  if (done.length < 3) return { text: "写完三颗星之后可以问感情。写完，是你的一句和界面的一句都在。", ids: [] };
  const god = dominantGod(done);
  const ids = done.filter((star) => !god || star.god === god).map((star) => star.id);
  const body = god ? FEELING[god] ?? `你在亲近里反复碰到的是${god}。` : "这三颗星还没落到同一个十神上。";
  const named = links.find((link) => text.includes(link.name));
  const side = named ? relate(chart, named) : "";
  return { text: side ? `${body}${side}` : body, ids };
}

export function askBond(text: string, stars: LitStar[], chart: Chart, links: StarLink[]): { text: string; ids: string[] } {
  const named = links.find((link) => text.includes(link.name));
  if (!named) {
    const names = links.map((link) => link.name);
    return { text: names.length ? `说的是哪一个已经互换的好友？现在有 ${names.join("、")}。` : "还没有互换过的好友。到地球上连一个人，再问你们的关系。", ids: [] };
  }
  const done = stars.filter(formed);
  const structure = relate(chart, named);
  const traffic = trafficLine(named);
  if (done.length < 3) {
    return { text: `${structure}${traffic}还看不见你反复在意什么。`, ids: [] };
  }
  const god = dominantGod(done);
  const ids = done.filter((star) => !god || star.god === god).map((star) => star.id);
  const theme = god ? `你反复在意的是${god}。` : "你写下的星还没聚成同一个十神。";
  return { text: `${traffic}${structure}${theme}`, ids };
}

function dominantGod(stars: LitStar[]): string {
  const counts = new Map<string, number>();
  for (const star of stars) {
    if (!star.god) continue;
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
  return top;
}

function trafficLine(link: StarLink): string {
  const times = link.exchanges.length ? link.exchanges : [link.at];
  const last = Math.max(...times);
  const days = Math.round((Date.now() - last) / 86400000);
  const hot = lineStrength(times) >= 0.55;
  if (hot) return "你们最近来往密，从最近一次互换说起。";
  if (days >= 45) return `这条线已经暗了，距上次互换大约 ${days} 天。`;
  return `你们互换过 ${times.length} 次。`;
}

function relate(chart: Chart, link: StarLink): string {
  const parts = link.pillar.split(/\s+/).filter(Boolean);
  const day = parts[2] ?? "";
  const stem = STEMS.findIndex((item) => item === day[0]);
  const branch = BRANCHES.findIndex((item) => item === day[1]);
  if (stem < 0) return `${link.name}的四柱读不全。`;
  const god = tenGod(chart.dayMaster, stem);
  const selfDay = chart.pillars.find((pillar) => pillar.key === "day");
  const selfBranch = selfDay?.text ? BRANCHES.findIndex((item) => item === selfDay.text[1]) : -1;
  const branchText = selfBranch >= 0 && branch >= 0 ? branchPhrase(selfBranch, branch) : "";
  const persona = chart.person.mbti && link.mbti ? `人格 ${chart.person.mbti} 与 ${link.mbti}。` : "";
  return `${link.name}的日主对你是${god}。${branchText}${persona}`;
}

function branchPhrase(a: number, b: number): string {
  if (a === b) return "日支相同。";
  if (HE.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return "日支相合。";
  if (Math.abs(a - b) === 6) return "日支相冲。";
  return "日支各走各的。";
}
