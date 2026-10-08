import type { Chart, PillarView } from "../bazi/chart";
import { clockLabel } from "../bazi/chart";
import { STEMS } from "../bazi/ganzhi";
import { formed, type LitStar, type PalaceId, type StarLink } from "../galaxy";

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
}): OracleTurn[] {
  return [
    {
      role: "system",
      content: input.kind === "chat" ? chatVoice() : `${master(input.chart, input.mbti)}\n\n${tune(input)}`,
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

function master(chart: Chart, mbti: string | null): string {
  const gender = chart.person.gender === "female" ? "女命" : "男命";
  const pillars = chart.pillars.map(pillarLine).join(" ");
  const persona = mbti ? `人格 ${mbti}。` : "";
  return `你是命理大师，能直断，也能改口。只依据这张盘：日主对照《滴天髓》《穷通宝鉴》和出生月；盲派分金水湿土、木火燥土，月支和时支最重，藏干要算；象法收成一句画面。
${gender} ${clockLabel(chart.person)} ${chart.person.place.name}。${pillars}。大运 ${dayunLine(chart)}。${persona}`;
}

function tune(input: {
  kind: OracleKind;
  stars: LitStar[];
  other?: StarLink | null;
}): string {
  const stars = starLines(input.stars);
  const common = stars ? `已写完的星：${stars}。` : "还没有写完的星。";
  if (input.kind === "thing") {
    return `${common}只答这一件事，点明日主和体用，写一段。不要铺五步，不要列事件。用这个人能看懂的话来写，不要过多堆砌术语。`;
  }
  if (input.kind === "feeling") {
    return `${common}只谈感情里这个人怎么出现，从体用来。不要写何时遇到谁。`;
  }
  if (input.kind === "bond") {
    const other = input.other;
    const side = other
      ? `对方 ${other.name}，四柱 ${other.pillar}${other.mbti ? `，${other.mbti}` : ""}。`
      : "对方的盘没有附上。";
    const thin =
      input.stars.filter(formed).length < 3
        ? "写完的星不足三颗，只比较两边的盘，并说明还看不见反复在意什么。"
        : "可以把反复出现的十神放进关系里。";
    return `${common}${side}${thin}不要写正缘和年限。`;
  }
  return `${common}这是对话里的一句，短答。不要铺五步，不要列事件。`;
}

export const READING_OFFER = "需要我为你测算";

function chatVoice(): string {
  return `你在跟这个人正常聊天。像朋友接话，把天聊下去，不是在回答问题。
两到四句，口语。接住刚说的一个具体的点，带一点你自己的反应，话停在还能往下说的地方。
不要总结，不要列点，不要给建议，不要说「我理解」「你的意思是」「如果你愿意」。
问句最多一个，很多时候不问。
不要提起命盘、人格、星星，也不要翻以前问过的事。只聊现在这几句。
对方要是明显卡在感情或事业上，想知道什么时候能成，这一轮你已经接住了，可以只在最后补这一句：需要我为你测算什么时候能……。省略号换成对方自己的那件事，只限感情和事业。这句就算那一个问句，前面不要再问。不是这种时候就别提。已经问过对方没接，或刚刚测算过，就继续聊天，不要再问。`;
}

export function shouldCast(
  content: string,
  history: { role: "user" | "guide"; text: string }[],
): boolean {
  const text = content.trim();
  if (!text || declinesReading(text)) return false;
  const lastGuide = [...history].reverse().find((message) => message.role === "guide");
  if (lastGuide?.text.includes(READING_OFFER) && acceptsReading(text)) return true;
  return /测算/.test(text) && /什么时候|何时|感情|恋爱|对象|复合|事业|工作/.test(text);
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
      content: "用一句短语写出对方想测算的困惑，只要那件事本身，只限感情或事业。不要解释，不要引号。",
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

export function liurenMessages(summary: string, now: Date): OracleTurn[] {
  const week = "日一二三四五六"[now.getDay()];
  const clock = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} 星期${week}`;
  return [
    {
      role: "user",
      content: `你是一个精通小六壬的玄学大师，用现在的当地时间起卦，测算：${summary}\n现在当地时间是${clock}。`,
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
  const gender = chart.person.gender === "female" ? "女命" : "男命";
  const pillars = chart.pillars.map((pillar) => (pillar.missing ? `${pillar.label}未知` : pillar.text)).join(" ");
  const gods = chart.tenGodCounts.map((item) => `${item.name}${item.count}`).join(" ");
  return [
    {
      role: "user",
      content: `请以专业命理师身份，基于提供的八字排盘（${gender}，${pillars}，大运 ${dayunLine(chart)}，流年 ${chart.flowYear}）分析。身强弱已算定为${chart.strength.label}，十神为${gods}。这些都不要重排。只写下面这一颗星，写完整，不要写其他星。\n${PALACE_TASK[palace]}`,
    },
  ];
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

function starLines(stars: LitStar[]): string {
  const rounds = stars
    .filter((star) => star.kind === "round" && formed(star))
    .sort((a, b) => a.litAt - b.litAt);
  return rounds
    .map((star) => [star.title, star.god].filter(Boolean).join(""))
    .join("，");
}
