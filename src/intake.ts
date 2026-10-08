import { CITIES } from "./places";
import type { Gender, Person, Place } from "./types";
import type { Pole } from "./mbti";

export type IntakeStep = "name" | "gender" | "birth" | "place" | "ei" | "sn" | "tf" | "jp" | "done";

export type IntakeDraft = {
  step: IntakeStep;
  name: string;
  gender: Gender | null;
  year: number | null;
  month: number | null;
  day: number | null;
  hour: number | null;
  minute: number;
  hourUnknown: boolean;
  place: Place | null;
  poles: Partial<Record<"E" | "I" | "S" | "N" | "T" | "F" | "J" | "P", boolean>>;
};

export type IntakeReply = {
  draft: IntakeDraft;
  text: string;
  chips: { label: string; value: string }[];
  done: boolean;
};

const SHICHEN: Record<string, number> = {
  子: 0,
  丑: 2,
  寅: 4,
  卯: 6,
  辰: 8,
  巳: 10,
  午: 12,
  未: 14,
  申: 16,
  酉: 18,
  戌: 20,
  亥: 22,
};

export function blankDraft(): IntakeDraft {
  return {
    step: "name",
    name: "",
    gender: null,
    year: null,
    month: null,
    day: null,
    hour: null,
    minute: 0,
    hourUnknown: false,
    place: null,
    poles: {},
  };
}

export function openingTurn(): IntakeReply {
  return {
    draft: blankDraft(),
    text: "从这里开始。你怎么称呼？",
    chips: [],
    done: false,
  };
}

export function answerIntake(draft: IntakeDraft, input: string): IntakeReply {
  const text = input.trim();
  const next = { ...draft, poles: { ...draft.poles } };
  if (!text) return { draft: next, text: "说一句就行。", chips: chipsFor(next.step), done: false };
  if (next.step === "name") {
    next.name = text.replace(/^(我叫|我是|名字是)/, "").trim().slice(0, 24) || "未名";
    next.step = "gender";
  } else if (next.step === "gender") {
    const gender = readGender(text);
    if (!gender) return ask(next, "说男或女。大运的顺逆要用到它。", genderChips());
    next.gender = gender;
    next.step = "birth";
  } else if (next.step === "birth") {
    readWhen(text, next);
    if (next.year == null) return ask(next, "写公历生日，比如 2000年1月1日。时辰可以一起说，不知道就说未知。");
    if (next.hour == null && !next.hourUnknown) return ask(next, "时辰呢？可以说 8点、午时，或者说未知。");
    next.step = "place";
  } else if (next.step === "place") {
    const place = readPlace(text) ?? next.place;
    if (!place) return ask(next, "没对上城市。说一个城市名，比如北京、成都。");
    next.place = place;
    next.step = "ei";
  } else if (next.step === "ei" || next.step === "sn" || next.step === "tf" || next.step === "jp") {
    const pole = readPole(next.step, text);
    if (!pole) return ask(next, promptFor(next.step), chipsFor(next.step));
    next.poles[pole] = true;
    next.step = nextStep(next.step);
  }
  if (next.step === "done") {
    return {
      draft: next,
      text: "生辰和这四句都齐了。八字和人格下面就能看。看完，生成你的星系。",
      chips: [],
      done: true,
    };
  }
  if (next.step === "place" && next.place) {
    return ask(next, `出生地是${next.place.name}吗？不是的话直接说城市。`, [{ label: next.place.name, value: next.place.name }]);
  }
  return ask(next, promptFor(next.step), chipsFor(next.step));
}

export function personFromDraft(draft: IntakeDraft, id = "self"): Person | null {
  if (!draft.gender || draft.year == null || draft.month == null || draft.day == null || !draft.place) return null;
  if (draft.hour == null && !draft.hourUnknown) return null;
  return {
    id,
    name: draft.name || "未名",
    gender: draft.gender,
    time: {
      year: draft.year,
      month: draft.month,
      day: draft.day,
      hour: draft.hourUnknown ? null : draft.hour,
      minute: draft.minute,
    },
    place: draft.place,
    hourUnknown: draft.hourUnknown,
    mbti: mbtiFromDraft(draft),
  };
}

export function mbtiFromDraft(draft: IntakeDraft): string | null {
  const e = draft.poles.E ? "E" : draft.poles.I ? "I" : "";
  const s = draft.poles.S ? "S" : draft.poles.N ? "N" : "";
  const t = draft.poles.T ? "T" : draft.poles.F ? "F" : "";
  const j = draft.poles.J ? "J" : draft.poles.P ? "P" : "";
  const type = `${e}${s}${t}${j}`;
  return type.length === 4 ? type : null;
}

function ask(draft: IntakeDraft, text: string, chips: { label: string; value: string }[] = []): IntakeReply {
  return { draft, text, chips, done: false };
}

function nextStep(step: IntakeStep): IntakeStep {
  if (step === "ei") return "sn";
  if (step === "sn") return "tf";
  if (step === "tf") return "jp";
  return "done";
}

function promptFor(step: IntakeStep): string {
  if (step === "gender") return "你是男还是女？";
  if (step === "birth") return "公历生日和时辰？不知道时辰可以说未知。";
  if (step === "place") return "出生在哪一座城市？";
  if (step === "ei") return "人多的时候，你更想接着说，还是先安静一下？";
  if (step === "sn") return "听一件事，你先抓住具体发生了什么，还是它可能意味着什么？";
  if (step === "tf") return "做决定时，你先看公不公平，还是谁会受影响？";
  if (step === "jp") return "你是先把事情定下来才安心，还是留着余地才自在？";
  return "";
}

function chipsFor(step: IntakeStep): { label: string; value: string }[] {
  if (step === "gender") return genderChips();
  if (step === "ei") return [{ label: "接着说", value: "接着说" }, { label: "先安静", value: "先安静" }];
  if (step === "sn") return [{ label: "具体的事", value: "具体发生了什么" }, { label: "可能的意思", value: "可能意味着什么" }];
  if (step === "tf") return [{ label: "公不公平", value: "先看公平" }, { label: "谁受影响", value: "谁会受影响" }];
  if (step === "jp") return [{ label: "先定下来", value: "先定下来" }, { label: "留着余地", value: "留着余地" }];
  return [];
}

function genderChips(): { label: string; value: string }[] {
  return [{ label: "男", value: "男" }, { label: "女", value: "女" }];
}

function readGender(text: string): Gender | null {
  const male = /男/.test(text);
  const female = /女/.test(text);
  if (male === female) return null;
  return male ? "male" : "female";
}

function readWhen(text: string, draft: IntakeDraft) {
  const date = text.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
  if (date) {
    const year = Number(date[1]);
    const month = Number(date[2]);
    const day = Number(date[3]);
    if (year >= 1901 && year <= 2099 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      draft.year = year;
      draft.month = month;
      draft.day = day;
    }
  }
  if (/未知|不清楚|不知道|记不得/.test(text)) draft.hourUnknown = true;
  const clock = text.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  const hourWord = text.match(/(\d{1,2})\s*(点|时)/);
  const shi = text.match(/([子丑寅卯辰巳午未申酉戌亥])时/);
  if (clock) {
    const hour = Number(clock[1]);
    const minute = Number(clock[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      draft.hour = hour;
      draft.minute = minute;
      draft.hourUnknown = false;
    }
  } else if (hourWord) {
    let hour = Number(hourWord[1]);
    if (/下午|晚上|傍晚/.test(text) && hour < 12) hour += 12;
    if (/中午/.test(text) && hour < 11) hour = 12;
    if (hour >= 0 && hour <= 23) {
      draft.hour = hour;
      draft.minute = 0;
      draft.hourUnknown = false;
    }
  } else if (shi && SHICHEN[shi[1]] != null) {
    draft.hour = SHICHEN[shi[1]];
    draft.minute = 0;
    draft.hourUnknown = false;
  }
  const place = readPlace(text);
  if (place) draft.place = place;
}

function readPlace(text: string): Place | null {
  const found = CITIES.find((city) => text.includes(city.name));
  return found ?? null;
}

function readPole(step: IntakeStep, text: string): Pole | null {
  if (step === "ei") {
    if (/安静|收回|一个人|内/.test(text)) return "I";
    if (/接着说|说话|外|聊/.test(text)) return "E";
  }
  if (step === "sn") {
    if (/可能|意味|以后|远/.test(text)) return "N";
    if (/具体|发生|眼前|细节/.test(text)) return "S";
  }
  if (step === "tf") {
    if (/影响|感受|在意人|心疼/.test(text)) return "F";
    if (/公平|道理|逻辑|公/.test(text)) return "T";
  }
  if (step === "jp") {
    if (/余地|以后再说|看情况|不定/.test(text)) return "P";
    if (/定下|安排|计划|先定/.test(text)) return "J";
  }
  return null;
}
