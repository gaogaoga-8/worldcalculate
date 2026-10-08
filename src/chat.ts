import type { Chart } from "./bazi/chart";
import { BRANCHES, STEMS, TEN_GOD_DEF, elementChar } from "./bazi/ganzhi";
import { matchCharts } from "./bazi/match";
import { knowledgePack } from "./knowledge/pack";
import type { Person } from "./types";

export type ChatContext = {
  chart: Chart;
  mbti: string | null;
  people: Person[];
  charts: { person: Person; chart: Chart; mbti: string | null }[];
};

const HOOKS: { re: RegExp; god: string; ask: string }[] = [
  {
    re: /压力|规则|责任|考核|上司|管我|期待/,
    god: "正官",
    ask: "这种压力来自规则本身，还是来自某一个人的期待？",
  },
  {
    re: /竞争|不服|被逼|危机|硬扛/,
    god: "七杀",
    ask: "你碰到这种时候，是顶上去，还是先撤开？",
  },
  {
    re: /学习|读书|证书|保护|想太多|靠山/,
    god: "正印",
    ask: "你是靠自己想通，还是得有人先接住你？",
  },
  {
    re: /灵感|钻牛角尖|冷门|自学|孤独/,
    god: "偏印",
    ask: "这股劲是让你更清楚，还是让你更孤？",
  },
  {
    re: /表达|创作|作品|玩耍|输出|说话/,
    god: "食神",
    ask: "你做这件事，是为了自己舒坦，还是为了被看见？",
  },
  {
    re: /反驳|挑剔|才华|不服管|批判|挑刺/,
    god: "伤官",
    ask: "你是想推翻它，还是只是受不了它含糊？",
  },
  {
    re: /钱|薪水|结果|项目|现实|稳定/,
    god: "正财",
    ask: "你在意的是结果本身，还是结果后面那个人？",
  },
  {
    re: /机会|投资|意外|人脉|横财/,
    god: "偏财",
    ask: "这种机会你通常接得很快，还是会先怀疑？",
  },
  {
    re: /朋友|同辈|比较|合伙|并肩/,
    god: "比肩",
    ask: "你是想跟他并肩，还是其实有点较劲？",
  },
  {
    re: /抢|争夺|兄弟|分走|吃亏/,
    god: "劫财",
    ask: "你更怕被拿走，还是更怕欠着别人？",
  },
];

export function senseRound(text: string): { god: string; echo: string } {
  for (const hook of HOOKS) {
    if (hook.re.test(text))
      return { god: hook.god, echo: `这一轮碰到的是${hook.god}。${hook.ask}` };
  }
  const clip = text.replace(/\s+/g, " ").trim().slice(0, 18);
  return {
    god: "",
    echo: clip ? `这一轮先记下：${clip}` : "这一轮先记下你说的这件事。",
  };
}

export function opening(chart: Chart, mbti: string | null): string {
  return `${chart.person.name}，你好。我是你的本命星。\n\n你可以说说最近在意的事，也可以一起看看你的命盘。${mbti ? `你的人格探索结果是 ${mbti}，也可以从这里聊起。` : ""}\n\n今天，想从哪里开始？`;
}

export function reply(input: string, ctx: ChatContext): string {
  const text = input.trim();
  if (!text) return "说一句你想看的，或者直接讲一件事。";
  const chart = ctx.chart;
  if (/四柱|八字|命盘|排盘/.test(text)) return pillarsReply(chart);
  if (/日主|日干|我是什么/.test(text)) return dayMasterReply(chart);
  if (/五行|旺|弱/.test(text)) return elementReply(chart);
  if (/十神/.test(text)) return tenGodReply(chart);
  if (/大运|运势|现在走/.test(text)) return dayunReply(chart);
  if (/纳音/.test(text)) return nayinReply(chart);
  if (/空亡|旬空/.test(text)) return voidReply(chart);
  if (/真太阳|时辰|校正/.test(text)) return solarReply(chart);
  if (/mbti|人格|性格类型|类型/i.test(text)) return mbtiReply(ctx.mbti);
  if (/相合|合不合|匹配|适合/.test(text)) return matchReply(text, ctx);
  if (/吉凶|发财|何时|寿命|灾难|婚配|正缘/.test(text)) {
    return "吉凶、年限、婚配这些断语还没有写进知识库。盘面结构可以现在看：四柱、五行、十神、大运，都是按生辰算出来的。你想先看哪一块？";
  }
  const figure = knowledgePack.figures.find((item) => text.includes(item.name));
  if (figure) {
    return figure.note
      ? `${figure.name}。${figure.note}`
      : `${figure.name}已经在人物库里，诠释还没写上。连上对方的星系之后，可以在对话里对照。`;
  }
  for (const hook of HOOKS) {
    if (hook.re.test(text)) return hookReply(chart, hook.god, hook.ask);
  }
  return defaultReply(chart);
}

export function promptsFor(ctx: ChatContext): string[] {
  const base = ["最近有一件事一直在意", "我想更了解自己", "看看我的命盘"];
  if (ctx.mbti) base.push(`聊聊我的 ${ctx.mbti}`);
  if (ctx.people[0]) base.push(`和${ctx.people[0].name}相合吗`);
  return base.slice(0, 6);
}

function pillarsReply(chart: Chart): string {
  const rows = chart.pillars
    .map((p) =>
      p.missing
        ? "时柱：未记"
        : `${p.label} ${p.text}，天干为${p.stemGod}，纳音${p.nayin}`,
    )
    .join("\n");
  return `四柱如下。\n${rows}\n\n日主是${STEMS[chart.dayMaster]}，月令${chart.monthLabel}。年柱以立春为界，月柱以节令为界。`;
}

function dayMasterReply(chart: Chart): string {
  const stem = STEMS[chart.dayMaster];
  const extra = knowledgePack.stems[stem];
  const base = `日主是${stem}，${chart.dayMasterLabel}。四柱里其他干支都从这个位置往外看：同我、生我、我生、我克、克我。`;
  return extra ? `${base}\n\n${extra}` : base;
}

function elementReply(chart: Chart): string {
  const bars = chart.elements
    .map((item) => `${item.name} ${item.value.toFixed(1)}`)
    .join("  ");
  return `五行权重是结构估算，不是定论。天干计 1，藏干本气 1、中气 0.6、余气 0.3，月令藏干再乘 1.5。\n${bars}\n同党 ${chart.strength.self.toFixed(1)}，异党 ${chart.strength.other.toFixed(1)}，估算${chart.strength.label}。同党指日主五行和生它的那一行。`;
}

function tenGodReply(chart: Chart): string {
  if (chart.tenGodCounts.length === 0)
    return "时辰未知时，十神会少一柱。现在能数到的还很少。";
  const lines = chart.tenGodCounts
    .map((item) => {
      const extra = knowledgePack.tenGods[item.name];
      const def = TEN_GOD_DEF[item.name] ?? "";
      return `${item.name} ×${item.count}。${def}${extra ? extra : ""}`;
    })
    .join("\n");
  return `十神按日主来定，不含日主本身。\n${lines}`;
}

function dayunReply(chart: Chart): string {
  const dir = chart.dayun.forward ? "顺排" : "逆排";
  const why = `${chart.dayun.yangYear ? "阳年" : "阴年"} · ${chart.person.gender === "male" ? "男" : "女"} · ${dir}`;
  const start = `约 ${chart.dayun.startYears} 岁 ${chart.dayun.startMonths} 个月起运`;
  const steps = chart.dayun.steps
    .map((step) => `${step.text}（${step.startYear}）`)
    .join("  ");
  return `${why}，${start}。交运按出生时刻到相邻节令折算，三天折一岁。\n${steps}\n流年是 ${chart.flowYear}。`;
}

function nayinReply(chart: Chart): string {
  const lines = chart.pillars
    .filter((p) => !p.missing)
    .map((p) => {
      const extra = knowledgePack.nayin[p.nayin];
      return `${p.text} ${p.nayin}${extra ? `。${extra}` : ""}`;
    })
    .join("\n");
  return `纳音是干支的另一套命名。\n${lines}`;
}

function voidReply(chart: Chart): string {
  const [a, b] = chart.voidBranch;
  return `日柱所在这一旬，空亡在${BRANCHES[a]}、${BRANCHES[b]}。这是旬空的位置，不是缺失本身的含义。含义要等诠释库写上再谈。`;
}

function solarReply(chart: Chart): string {
  if (chart.person.hourUnknown || !chart.solar.trueLabel)
    return "时辰没有记，所以没有做真太阳时校正，时柱空着。";
  const sign = chart.solar.correctionMinutes >= 0 ? "+" : "−";
  const mins = Math.abs(chart.solar.correctionMinutes).toFixed(1);
  const shift = chart.solar.shifted
    ? "真太阳时落在二十三点后，日柱按早子时进了一日。"
    : "日界没有被校正推过二十三点。";
  return `钟表时间之外，按出生地经度做了真太阳时校正，幅度 ${sign}${mins} 分。校正后的时辰是 ${chart.solar.trueLabel}。${shift}`;
}

function mbtiReply(mbti: string | null): string {
  if (!mbti) return "人格还没从对话里读出来。它和八字分开记，不互相换算。";
  return `你的类型是 ${mbti}。它来自你刚才的选择，不是从生辰推出来的。八字和 MBTI 在这里并列，方便你对照，不互相换算。`;
}

function matchReply(text: string, ctx: ChatContext): string {
  const named = ctx.charts.find(
    (item) =>
      item.person.id !== ctx.chart.person.id && text.includes(item.person.name),
  );
  if (!named && ctx.people.length === 0 && knowledgePack.figures.length === 0) {
    return "还没有第二个人。在星系里连上对方的码，再回来问。";
  }
  if (!named) {
    const names = ctx.charts
      .filter((item) => item.person.id !== ctx.chart.person.id)
      .map((item) => item.person.name);
    return names.length
      ? `你想对照谁？现在有 ${names.join("、")}。`
      : "还没有第二张盘。";
  }
  return matchCharts(ctx.chart, named.chart, ctx.mbti, named.mbti).summary;
}

function hookReply(chart: Chart, god: string, ask: string): string {
  const found = chart.tenGodCounts.find((item) => item.name === god);
  const count = found?.count ?? 0;
  const presence =
    count >= 2
      ? "这一路在盘里比较显"
      : count === 1
        ? "这一路在盘里有一点"
        : "这一路在盘里并不显";
  const extra = knowledgePack.tenGods[god];
  const def = TEN_GOD_DEF[god] ?? "";
  return `你说的这件事，结构上靠近${god}。${def}${presence}。${extra ? extra + "。" : ""}\n${ask}`;
}

function defaultReply(chart: Chart): string {
  return `我先不把这句话套进某一种性格。你的日主是${STEMS[chart.dayMaster]}${elementChar(chart.dayMaster)}，月令在${BRANCHES[chart.monthBranch]}月。这句话里最耗你的，是人，是事，还是你自己停不下来？`;
}
