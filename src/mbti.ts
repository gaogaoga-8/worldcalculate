export type Pole = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
export type Dim = "EI" | "SN" | "TF" | "JP";

export type MbtiQuestion = {
  id: string;
  dim: Dim;
  prompt: string;
  a: { text: string; pole: Pole };
  b: { text: string; pole: Pole };
};

export const QUESTIONS: MbtiQuestion[] = [
  { id: "ei1", dim: "EI", prompt: "聚会散了以后，你通常？", a: { text: "还想再找人说两句", pole: "E" }, b: { text: "需要安静，把自己收回来", pole: "I" } },
  { id: "ei2", dim: "EI", prompt: "一个新想法，你更习惯？", a: { text: "一边说一边成形", pole: "E" }, b: { text: "先在心里想清楚再开口", pole: "I" } },
  { id: "ei3", dim: "EI", prompt: "一天里你更有精神的是？", a: { text: "和人来回讨论", pole: "E" }, b: { text: "独自把一件事做深", pole: "I" } },
  { id: "ei4", dim: "EI", prompt: "认识新的人时？", a: { text: "常常是你先开口", pole: "E" }, b: { text: "常常是你先观察", pole: "I" } },
  { id: "ei5", dim: "EI", prompt: "临时的电话或来访？", a: { text: "多半觉得刚好", pole: "E" }, b: { text: "多半觉得被打断", pole: "I" } },
  { id: "sn1", dim: "SN", prompt: "听别人讲一件事，你先抓住？", a: { text: "具体发生了什么", pole: "S" }, b: { text: "它可能意味着什么", pole: "N" } },
  { id: "sn2", dim: "SN", prompt: "做事时你更依赖？", a: { text: "已经验证过的步骤", pole: "S" }, b: { text: "一个还没落地的想法", pole: "N" } },
  { id: "sn3", dim: "SN", prompt: "你记得更牢的是？", a: { text: "细节、原话、场景", pole: "S" }, b: { text: "气氛、模式、联想", pole: "N" } },
  { id: "sn4", dim: "SN", prompt: "向别人说明一件事时？", a: { text: "按实际过程讲", pole: "S" }, b: { text: "先讲结论和可能", pole: "N" } },
  { id: "sn5", dim: "SN", prompt: "面对「以后」？", a: { text: "先把眼前这一步做好", pole: "S" }, b: { text: "会不自觉想到很远", pole: "N" } },
  { id: "tf1", dim: "TF", prompt: "做决定时，你最后更看？", a: { text: "是否站得住、公不公平", pole: "T" }, b: { text: "谁会受影响、关不关心", pole: "F" } },
  { id: "tf2", dim: "TF", prompt: "朋友来诉苦，你更自然的是？", a: { text: "帮他看问题出在哪", pole: "T" }, b: { text: "先让他觉得被懂", pole: "F" } },
  { id: "tf3", dim: "TF", prompt: "被人指出问题时，你更在意？", a: { text: "这话说得有没有道理", pole: "T" }, b: { text: "语气，以及关系有没有受损", pole: "F" } },
  { id: "tf4", dim: "TF", prompt: "看一个方案，你先看？", a: { text: "逻辑和效果", pole: "T" }, b: { text: "人能否接受、是否合乎心意", pole: "F" } },
  { id: "tf5", dim: "TF", prompt: "你更希望别人说你？", a: { text: "清楚、公正", pole: "T" }, b: { text: "体贴、真诚", pole: "F" } },
  { id: "jp1", dim: "JP", prompt: "出门或接手一件任务？", a: { text: "先有安排才安心", pole: "J" }, b: { text: "留有余地才自在", pole: "P" } },
  { id: "jp2", dim: "JP", prompt: "期限临近时？", a: { text: "你通常早就做完了", pole: "J" }, b: { text: "你常常到最后一段才进入状态", pole: "P" } },
  { id: "jp3", dim: "JP", prompt: "计划和房间？", a: { text: "定下来就舒服", pole: "J" }, b: { text: "随时改也可以", pole: "P" } },
  { id: "jp4", dim: "JP", prompt: "一个还没排满的周末？", a: { text: "想知道接下来做什么", pole: "J" }, b: { text: "想看看发生什么再说", pole: "P" } },
  { id: "jp5", dim: "JP", prompt: "规则和清单？", a: { text: "让你省心", pole: "J" }, b: { text: "让你有点被绑住", pole: "P" } },
];

export const TYPE_BLURB: Record<string, string> = {
  INTJ: "你习惯先看见结构，再决定要不要进入。人多的时候你不一定沉默，但真正做决定时，你信自己的模型多过信场面。",
  INTP: "你用拆解来理解世界。一件事要是说不通，你很难为了气氛假装它已经通了。",
  ENTJ: "你看见目标之后，会想把人和步骤排进去。推进让你踏实，含糊会让你不耐烦。",
  ENTP: "你喜欢把一个想法翻过来看。争论对你常常是探索，不一定是要赢。",
  INFJ: "你很容易感到别人没说出口的部分。你给的判断常常很慢，但一旦形成，就不轻易改。",
  INFP: "你在意一件事值不值得。外在可以妥协，内在的那条线不太能让。",
  ENFJ: "你能感到房间里的人各自在哪。你常常主动把关系照料好，有时会忘了自己也在里面。",
  ENFP: "你被可能性点着。人、想法、计划，你都愿意先打开，再决定留下哪一个。",
  ISTJ: "你信已经证明过的做法。答应了的事你会记住，也希望别人同样记住。",
  ISFJ: "你用具体的照料表达在意。你记得别人随口说过的需要，自己的需要往往排在后面。",
  ESTJ: "你想让事情有个清楚的秩序。责任一旦落到你身上，你会把它做完。",
  ESFJ: "你在意人是否被安顿好。和谐对你不是表面，是事情能不能继续下去的条件。",
  ISTP: "你靠动手和临场把事情弄明白。解释可以以后再说，先让它运转。",
  ISFP: "你用感觉挑选要靠近的东西。不喜欢被催着定义自己，但对自己真正喜欢的很坚定。",
  ESTP: "你在现场里最清醒。变化不是干扰，反而是你读局面的材料。",
  ESFP: "你把气氛带起来，也真的享受当下。你不想为了某个遥远的计划，错过眼前这一下。",
};

export type QuizAnswers = Record<string, "a" | "b">;

export type MbtiScore = {
  type: string;
  letters: { dim: Dim; left: Pole; right: Pole; leftN: number; rightN: number; chosen: Pole }[];
};

const DIMS: { dim: Dim; left: Pole; right: Pole }[] = [
  { dim: "EI", left: "E", right: "I" },
  { dim: "SN", left: "S", right: "N" },
  { dim: "TF", left: "T", right: "F" },
  { dim: "JP", left: "J", right: "P" },
];

export function mbtiComplete(answers: QuizAnswers | null): boolean {
  if (!answers) return false;
  return QUESTIONS.every((q) => answers[q.id]);
}

export function scoreQuiz(answers: QuizAnswers | null): MbtiScore | null {
  if (!mbtiComplete(answers) || !answers) return null;
  const letters = DIMS.map(({ dim, left, right }) => {
    const related = QUESTIONS.filter((q) => q.dim === dim);
    let leftN = 0;
    let rightN = 0;
    for (const q of related) {
      const pole = answers[q.id] === "a" ? q.a.pole : q.b.pole;
      if (pole === left) leftN += 1;
      else rightN += 1;
    }
    return { dim, left, right, leftN, rightN, chosen: (leftN >= rightN ? left : right) as Pole };
  });
  return { type: letters.map((item) => item.chosen).join(""), letters };
}

export const MBTI_TYPES = Object.keys(TYPE_BLURB);

export const POLE_LABEL: Record<Pole, string> = {
  E: "外倾",
  I: "内倾",
  S: "实感",
  N: "直觉",
  T: "思考",
  F: "情感",
  J: "判断",
  P: "感知",
};
