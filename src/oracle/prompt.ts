import type { Chart, PillarView } from "../bazi/chart";
import { clockLabel } from "../bazi/chart";
import { STEMS } from "../bazi/ganzhi";
import type { LitStar, PalaceId, StarLink } from "../galaxy";

export type OracleKind = "thing" | "feeling" | "bond" | "chat";

export type OracleTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function oracleMessages(input: {
  kind: OracleKind;
  question: string;
  chart: Chart;
  mbti: string | null;
  stars: LitStar[];
  other?: StarLink | null;
  history?: { role: "user" | "guide"; text: string }[];
  presence?: { mood: string; memories: string; voice?: string };
  whose?: "self" | "named";
}): OracleTurn[] {
  return [
    {
      role: "system",
      content: input.kind === "chat" ? input.presence?.voice || chatVoice(input.presence) : `${master(input.chart)}\n\n${tune(input.kind, input.whose ?? "self")}`,
    },
    ...(input.kind === "chat"
      ? (input.history ?? []).slice(-12).map(
          (message): OracleTurn => ({
            role: message.role === "guide" ? "assistant" : "user",
            content: message.text,
          }),
        )
      : []),
    { role: "user", content: input.question.trim() },
  ];
}

export function readingChart(text: string, self: Chart, others: Chart[]): Chart {
  const hits = others
    .map((item) => ({ item, name: item.person.name.trim() }))
    .filter((item) => item.name && item.name !== self.person.name && text.includes(item.name))
    .sort((a, b) => text.lastIndexOf(b.name) - text.lastIndexOf(a.name) || b.name.length - a.name.length);
  return hits[0]?.item ?? self;
}

function master(chart: Chart): string {
  return `你是命理师。只依据下面这张已经算好的盘解释，不要重排四柱，不要改身强弱，不要改十神。
${lockedChart(chart)}
日主对照《滴天髓》《穷通宝鉴》和出生月来写，不另算身强弱。象法可以收成一句画面。可以写时机、年限、正缘和相遇。`;
}

function tune(kind: OracleKind, whose: "self" | "named"): string {
  const who = whose === "named"
    ? "这张盘是对话里提到的那个人，不是提问者本人。"
    : "这张盘是提问者本人，用开始时填写的生辰算出。";
  const plain = "用连贯正文写，不要用 Markdown，不要出现星号、井号或标题符号，也不要加“由模型生成”之类的落款。";
  if (kind === "thing") return `${who}只答这一件事，点明日主和体用，写一段。用这个人能看懂的话，不要过多堆砌术语。可以写这件事的时机和年限。${plain}`;
  if (kind === "feeling") return `${who}谈感情里这个人怎么出现，从体用来。可以写何时遇到、正缘和年限。${plain}`;
  if (kind === "bond") return `${who}谈这段关系，从这张盘来。可以写正缘、年限和相遇。不要另造一张盘。${plain}`;
  return who;
}

function lockedChart(chart: Chart): string {
  const gender = chart.person.gender === "female" ? "女命" : "男命";
  const pillars = chart.pillars.map(pillarLine).join(" ");
  const gods = chart.tenGodCounts.map((item) => `${item.name}${item.count}`).join(" ") || "无";
  const hour = chart.person.hourUnknown
    ? "时柱未知，不要用时支做判断。"
    : "月支和时支最重，藏干按盘上已给的算。";
  return `${gender}，求测对象是${chart.person.name}。${clockLabel(chart.person)} ${chart.person.place.name}。${pillars}。大运 ${dayunLine(chart)}。流年 ${chart.flowYear}。身强弱是${chart.strength.label}，十神是${gods}。这些都不要重排。${hour}`;
}

export const READING_OFFER = "需要我为你测算";

function chatVoice(presence?: { mood: string; memories: string }): string {
  const mood = presence?.mood ? `\n${presence.mood}` : "";
  const memories = presence?.memories
    ? `\n你记得：${presence.memories}。只在对方这句话碰得上时，轻轻接其中一件，不要列出来，也不要没头没尾翻旧账。碰不上就当没这回事。`
    : "\n没有要翻的旧事。只聊现在这几句。";
  return `你在跟这个人正常聊天。像朋友接话，把天聊下去，不是在回答问题。
两到四句，口语。接住刚说的一个具体的点，带一点你自己的反应，话停在还能往下说的地方。
不要总结，不要列点，不要给建议，不要说「我理解」「你的意思是」「如果你愿意」。
问句最多一个，很多时候不问。
${CHAT_BOUNDARY}${mood}${memories}
${READING_NUDGE}`;
}

export const CHAT_BOUNDARY = "不主动提起命盘、人格、星星。对方明确问到，或上一轮刚刚测算过，可以顺着接。";

export const READING_NUDGE = "对方要是卡在一件事上，想知道什么时候能成，这一轮你已经接住了，可以只在最后补这一句：需要我为你测算什么时候能……。省略号换成对方自己的那件事。这句就算那一个问句，前面不要再问。不是这种时候就别提。已经问过对方没接，或刚刚测算过，就继续聊天，不要再问。";

export function shouldCast(
  content: string,
  history: { role: "user" | "guide"; text: string }[],
): boolean {
  const text = content.trim();
  if (!text || declinesReading(text)) return false;
  const lastGuide = [...history].reverse().find((message) => message.role === "guide");
  if (lastGuide?.text.includes(READING_OFFER) && acceptsReading(text)) return true;
  return /测算|起卦|算一下|算算|帮我算|你算|测一下/.test(text.replace(/\s/g, ""));
}

export function confusionMessages(
  history: { role: "user" | "guide"; text: string }[],
  latest: string,
): OracleTurn[] {
  const transcript = [...history, { role: "user" as const, text: latest }]
    .slice(-12)
    .map((message) => `${message.role === "user" ? "对方" : "我"}：${message.text}`)
    .join("\n");
  return [
    {
      role: "system",
      content: "用一句短语写出对方想测算的事，只要那件事本身。不要解释，不要引号。",
    },
    { role: "user", content: transcript },
  ];
}

export function cleanSummary(raw: string, fallback: string): string {
  const line = raw.replace(/\s+/g, " ").trim().replace(/^[「"']|[」"']$/g, "");
  const cut = (line.split(/[。！？]/)[0] || "").replace(/^测算[:：]/, "").trim();
  if (cut) return cut.slice(0, 40);
  return fallback.slice(0, 40) || "这件事什么时候能成";
}

export function offeredQuestion(
  history: { role: "user" | "guide"; text: string }[],
  latest: string,
): string {
  const lastGuide = [...history].reverse().find((message) => message.role === "guide");
  const offered = lastGuide?.text.match(/需要我为你测算([^。！？\n]*)/);
  const fromOffer = offered?.[1]?.replace(/[…·.]+/g, "").trim();
  if (fromOffer) return fromOffer.slice(0, 40);
  return latest.trim().slice(0, 40);
}

const PLAIN_VOICE = "写给这个人自己看。先说这件事对他意味着什么，再说依据。命理词可以留，但每个词后面马上用一句日常的话翻译，不要连着堆格局、十神和古籍原文。不要讲课，不要列一二三四，不要小标题。用几段连贯的话。用连贯正文写，不要用 Markdown，不要出现星号、井号或标题符号，也不要加“由模型生成”之类的落款。";

export function liurenMessages(summary: string, now: Date, chart: Chart): OracleTurn[] {
  const week = "日一二三四五六"[now.getDay()];
  const clock = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} 星期${week}`;
  return [
    {
      role: "user",
      content: `用小六壬起这一课。用下面给出的设备当地时间，不要换算时区。测算：${summary}
现在设备当地时间是${clock}。
${lockedChart(chart)}
课名保留。起完之后用白话告诉对方：这件事大概怎样、更可能在什么时候、眼下可以怎么做。掌诀只作依据，不要写成教程。可以写时机和年限。
${PLAIN_VOICE}`,
    },
  ];
}

function declinesReading(text: string): boolean {
  const compact = text.replace(/\s/g, "");
  if (/帮我测算|测算一下|测算什么时候|你测算/.test(compact)) return false;
  return /不(用|要|必|算)|别算|先别|算了|下次/.test(compact);
}

function acceptsReading(text: string): boolean {
  const compact = text.replace(/\s/g, "");
  if (/测算|起卦|算一下|算算|帮我算|你算|测一下|算吧/.test(compact)) return true;
  return compact.length <= 16 && /^(好|好的|好啊|好呀|要|要的|嗯|嗯嗯|行|可以|来|来吧|想|想知道|那就|那就这样|算)/.test(compact);
}

const PALACE_TASK: Record<PalaceId, string> = {
  ming: "命宫：先写这个人看起来是什么样，五官、身材、气质，有没有明显的痣或胎记。再写他平时怎么想、怎么反应、情绪来得快还是慢。然后用盘上已经给的身强身弱，说清他顺的是什么、忌的是什么，十神之间是帮他还是耗他。如果成格，说出格局名字，并马上说明这个格局在生活里是一种什么样的本事，层次高不高。接着写他最拿手的地方，以及容易栽的地方、可以怎么避开。",
  health: "疾厄：只写身体。什么体质，哪一类不舒服更容易找上门，平时该注意哪里，作息和吃上可以怎么照顾自己。",
  career: "官禄：事业会怎样起落，钱从哪里来，做什么工作更合适，去哪里更顺，会不会离开家乡或出国。贵人是什么样的人、大概什么时候出现。哪几年更顺、哪几年要收着，以及可以怎么躲。",
  wealth: "财帛：钱怎么进来，存不存得住，投资是顺还是险，钱容易从哪里漏走，理财上可以靠哪一头。",
  spouse: "夫妻：另一半看起来怎样、性格怎样、做什么的、家里大概什么样子、年龄是大一些还是小一些。大概在什么时候、什么场合遇见，相处是什么样，有什么要留心的。缘分深的话，用一句生活里的话带过，不要写成故事。",
  child: "子女：孩子大概是什么样的人，可能有几个、更像男孩还是女孩，擅长什么，学习怎么样，和父母亲不亲。",
};

export function fateMessages(chart: Chart, question: string): OracleTurn[] {
  return [
    {
      role: "user",
      content: `下面这张盘只供你心里对照，不要把命理词写进回答。不要出现四柱、十神、格局、大运、用神、身强身弱、正缘这些词。
${lockedChart(chart)}
问题：${question}
用这个人听得懂的话回答。分成三段，段与段之间空一行。第一段用两三句说这件事大概会怎样，第二段说一个大概的时间，第三段给一个现在就能做的小事。每段都短。不要用 Markdown，不要出现星号、井号或标题符号，也不要加落款。`,
    },
  ];
}

export function palaceMessages(chart: Chart, palace: PalaceId): OracleTurn[] {
  return [
    {
      role: "user",
      content: `你在给这个人讲下面这一颗星。盘已经算好，不要重排四柱、身强弱和十神。可以写时机、年限、正缘和相遇。只写这一颗，写完，不要带上别的星。\n${lockedChart(chart)}\n${PALACE_TASK[palace]}\n${PLAIN_VOICE}`,
    },
  ];
}

export function plainReading(raw: string): string {
  let text = raw.replace(/\r/g, "");
  text = text.replace(/[*]{1,3}([^*\n]+)[*]{1,3}/g, "$1");
  text = text.replace(/^#{1,6}\s*/gm, "");
  text = text.replace(/[*#]+/g, "");
  text = text.replace(/^[ \t]*[-—]{3,}[ \t]*$/gm, "");
  text = text.replace(/(?:^|\n)\s*[—\-·.。\s]*以上[\s\S]{0,80}$/u, (block) => (
    /生成|DeepSeek|deepseek|模型|人工智能|深度求索/i.test(block) ? "" : block
  ));
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function pillarLine(pillar: PillarView): string {
  if (pillar.missing) return `${pillar.label}未知`;
  const hidden = pillar.hidden.map((item) => STEMS[item.stem]).join("");
  return `${pillar.label}${pillar.text}藏${hidden}`;
}

function dayunLine(chart: Chart): string {
  const steps = chart.dayun.steps;
  if (!steps.length) return "未排";
  return steps
    .map((step, index) => {
      const end = steps[index + 1] ? String(steps[index + 1].startYear) : "今";
      return `${step.text}（${step.startYear}-${end}）`;
    })
    .join("、");
}
