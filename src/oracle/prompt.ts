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

export function liurenMessages(summary: string, now: Date, chart: Chart): OracleTurn[] {
  const week = "日一二三四五六"[now.getDay()];
  const clock = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} 星期${week}`;
  return [
    {
      role: "user",
      content: `你是一个精通小六壬的玄学大师。用下面给出的设备当地时间起卦，不要换算时区。测算：${summary}\n现在设备当地时间是${clock}。\n${lockedChart(chart)}\n可以写时机和年限。用连贯正文写，不要用 Markdown，不要出现星号、井号或标题符号，也不要加“由模型生成”之类的落款。`,
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
  ming: "命宫星：详细描述五官面容、身材比例、气质类型、有无胎记或痣等明显体表特征。分析核心性格、行为模式、思维习惯、情绪反应机制。做命局核心分析：身弱身强以盘上已给的结论为准，再分析喜忌（用神和忌神）、十神关系、体用平衡。明确是否成格；若成格，写出具体格局（如正官格、七杀格、食神格），说明格局纯度与层次。然后提炼天赋潜能、核心竞争力、独特优势，结合格局综合来看。再指出格局缺陷与潜在风险，给出规避与转化建议。",
  health: "疾厄星：只写健康。体质特征、易患疾病类型、健康隐患、养生重点、作息与饮食建议。",
  career: "官禄星：事业运势起伏、财运走向、适合的职业类型、有利发展地域、离乡或出国的可能性、贵人特征与出现时机、事业吉凶年份及趋避建议。",
  wealth: "财帛星：财富获取方式、储蓄能力、投资运势、破财风险点、理财方向建议。",
  spouse: "夫妻星：配偶外貌特征、性格特质、职业类型、家庭背景、年龄差距（年长或年下）、相遇的时间地点与触发机制、婚姻模式与相处建议、前世羁绊的可能性。",
  child: "子女星：子女特质、子女数量、子女性别、天赋潜能、学习能力、和父母的关系。",
};

export function palaceMessages(chart: Chart, palace: PalaceId): OracleTurn[] {
  return [
    {
      role: "user",
      content: `请以专业命理师身份分析下面这张已经算好的盘。不要重排四柱、身强弱和十神。可以写时机、年限、正缘和相遇。只写下面这一颗星，写完整，不要写其他星。用连贯正文写，不要用 Markdown，不要出现星号、井号或标题符号，也不要加“由模型生成”之类的落款。\n${lockedChart(chart)}\n${PALACE_TASK[palace]}`,
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
