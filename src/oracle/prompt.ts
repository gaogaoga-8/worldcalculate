import type { Chart, PillarView } from "../bazi/chart";
import { clockLabel } from "../bazi/chart";
import { STEMS } from "../bazi/ganzhi";
import { formed, type LitStar, type StarLink } from "../galaxy";

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
      content: `${master(input.chart, input.mbti)}\n\n${tune(input)}`,
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
    return `${common}只答这一件事，点明日主和体用，写一段。不要铺五步，不要列事件。`;
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
