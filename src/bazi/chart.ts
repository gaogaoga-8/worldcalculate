import type { Person } from "../types";
import {
  BRANCHES,
  ELEMENTS,
  HIDDEN,
  HIDDEN_WEIGHT,
  STEMS,
  dayIndexFromDate,
  hourBranchFromClock,
  hourStem,
  lifeStage,
  monthStem,
  nayinOf,
  pillarIndex,
  pillarText,
  splitIndex,
  stemElement,
  tenGod,
  voidBranches,
  yangStem,
  yearIndex,
} from "./ganzhi";
import { pad } from "./math";
import {
  civilToUtc,
  jieAround,
  solarTermUtc,
  trueSolarCorrectionMinutes,
  utcToCivil,
} from "./solar";

export type HiddenView = { stem: number; god: string };

export type PillarView = {
  key: "year" | "month" | "day" | "hour";
  label: string;
  stem: number;
  branch: number;
  text: string;
  stemGod: string;
  hidden: HiddenView[];
  nayin: string;
  stage: string;
  missing?: boolean;
};

export type DayunStep = {
  stem: number;
  branch: number;
  text: string;
  startAgeMonths: number;
  startYear: number;
  startMonth: number;
};

export type Chart = {
  person: Person;
  pillars: PillarView[];
  dayMaster: number;
  dayMasterLabel: string;
  monthBranch: number;
  monthLabel: string;
  enteredTerm: string;
  solar: {
    correctionMinutes: number;
    trueLabel: string | null;
    shifted: boolean;
  };
  prevTerm: { name: string; utc: number };
  nextTerm: { name: string; utc: number };
  elements: { name: string; value: number; ratio: number }[];
  strength: { self: number; other: number; ratio: number; label: string };
  tenGodCounts: { name: string; count: number }[];
  voidBranch: [number, number];
  dayun: {
    forward: boolean;
    yangYear: boolean;
    startYears: number;
    startMonths: number;
    startDays: number;
    steps: DayunStep[];
  };
  flowYear: string;
};

export type ChartOptions = {
  ziHour: "early" | "late";
  now?: Date;
};

const PILLAR_LABEL: Record<PillarView["key"], string> = {
  year: "年柱",
  month: "月柱",
  day: "日柱",
  hour: "时柱",
};

export function buildChart(person: Person, options: ChartOptions): Chart {
  const tz = person.place.timezone;
  const civil = person.time;
  const hour = civil.hour ?? 12;
  const minute = civil.minute ?? 0;
  const birthUtc = civilToUtc(civil.year, civil.month, civil.day, person.hourUnknown ? 12 : hour, person.hourUnknown ? 0 : minute, tz);

  let correction = 0;
  let solarCivil = { year: civil.year, month: civil.month, day: civil.day, hour, minute };
  let shifted = false;
  if (!person.hourUnknown && civil.hour != null) {
    correction = trueSolarCorrectionMinutes(birthUtc, person.place.longitude, tz);
    const solarUtc = birthUtc + correction * 60000;
    solarCivil = utcToCivil(solarUtc, tz);
  }

  let dayY = person.hourUnknown ? civil.year : solarCivil.year;
  let dayM = person.hourUnknown ? civil.month : solarCivil.month;
  let dayD = person.hourUnknown ? civil.day : solarCivil.day;
  if (!person.hourUnknown && options.ziHour === "early" && solarCivil.hour >= 23) {
    const next = utcToCivil(Date.UTC(dayY, dayM - 1, dayD) + 86400000, 0);
    dayY = next.year;
    dayM = next.month;
    dayD = next.day;
    shifted = true;
  }

  const lichun = solarTermUtc(civil.year, 315);
  const yearNumber = birthUtc < lichun ? civil.year - 1 : civil.year;
  const yearPillar = splitIndex(yearIndex(yearNumber));

  const around = jieAround(birthUtc, civil.year);
  const monthBranch = around.prev.branch;
  const monthPillar = {
    stem: monthStem(yearPillar.stem, monthBranch),
    branch: monthBranch,
  };

  const dayIdx = dayIndexFromDate(dayY, dayM, dayD);
  const dayPillar = splitIndex(dayIdx);

  let hourPillar: { stem: number; branch: number } | null = null;
  if (!person.hourUnknown && civil.hour != null) {
    const branch = hourBranchFromClock(solarCivil.hour, solarCivil.minute);
    hourPillar = { stem: hourStem(dayPillar.stem, branch), branch };
  }

  const dayMaster = dayPillar.stem;
  const pillars = [
    present("year", yearPillar, dayMaster),
    present("month", monthPillar, dayMaster),
    present("day", dayPillar, dayMaster),
    hourPillar
      ? present("hour", hourPillar, dayMaster)
      : {
          key: "hour" as const,
          label: "时柱",
          stem: -1,
          branch: -1,
          text: "未知",
          stemGod: "—",
          hidden: [],
          nayin: "时辰未记",
          stage: "—",
          missing: true,
        },
  ];

  const elements = scoreElements(pillars, monthBranch);
  const selfEl = stemElement(dayMaster);
  const resource = (selfEl + 4) % 5;
  let selfScore = 0;
  let otherScore = 0;
  for (const item of elements) {
    const idx = ELEMENTS.indexOf(item.name as (typeof ELEMENTS)[number]);
    if (idx === selfEl || idx === resource) selfScore += item.value;
    else otherScore += item.value;
  }
  const total = selfScore + otherScore || 1;
  const ratio = selfScore / total;
  const strengthLabel = ratio >= 0.58 ? "偏旺" : ratio <= 0.42 ? "偏弱" : "中和";

  const counts = new Map<string, number>();
  for (const pillar of pillars) {
    if (pillar.missing) continue;
    if (pillar.key !== "day") bump(counts, pillar.stemGod);
    for (const hidden of pillar.hidden) bump(counts, hidden.god);
  }
  const tenGodCounts = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh"));

  const dayun = buildDayun(person, yearPillar.stem, monthPillar, around, birthUtc);
  const now = options.now ?? new Date();
  const flow = flowYearLabel(now);

  const trueLabel =
    person.hourUnknown || civil.hour == null
      ? null
      : `${pad(solarCivil.hour)}:${pad(solarCivil.minute)}`;

  return {
    person,
    pillars,
    dayMaster,
    dayMasterLabel: `${yangStem(dayMaster) ? "阳" : "阴"}${ELEMENTS[selfEl]}`,
    monthBranch,
    monthLabel: `${around.entered}之后 · ${BRANCHES[monthBranch]}月`,
    enteredTerm: around.entered,
    solar: {
      correctionMinutes: person.hourUnknown ? 0 : correction,
      trueLabel,
      shifted,
    },
    prevTerm: { name: around.prev.name, utc: around.prev.utc },
    nextTerm: { name: around.next.name, utc: around.next.utc },
    elements: elements.map((item) => ({ ...item, ratio: item.value / total })),
    strength: { self: selfScore, other: otherScore, ratio, label: strengthLabel },
    tenGodCounts,
    voidBranch: voidBranches(dayIdx),
    dayun,
    flowYear: flow,
  };
}

function present(key: PillarView["key"], pillar: { stem: number; branch: number }, dayMaster: number): PillarView {
  const index = pillarIndex(pillar.stem, pillar.branch);
  return {
    key,
    label: PILLAR_LABEL[key],
    stem: pillar.stem,
    branch: pillar.branch,
    text: pillarText(pillar.stem, pillar.branch),
    stemGod: key === "day" ? "日主" : tenGod(dayMaster, pillar.stem),
    hidden: HIDDEN[pillar.branch].map((stem) => ({ stem, god: tenGod(dayMaster, stem) })),
    nayin: nayinOf(index),
    stage: lifeStage(dayMaster, pillar.branch),
  };
}

function scoreElements(pillars: PillarView[], monthBranch: number) {
  const scores = [0, 0, 0, 0, 0];
  for (const pillar of pillars) {
    if (pillar.missing) continue;
    scores[stemElement(pillar.stem)] += 1;
    HIDDEN[pillar.branch].forEach((stem, i) => {
      let weight = HIDDEN_WEIGHT[i] ?? 0.3;
      if (pillar.branch === monthBranch && pillar.key === "month") weight *= 1.5;
      scores[stemElement(stem)] += weight;
    });
  }
  const list = ELEMENTS.map((name, i) => ({ name, value: scores[i] }));
  return list;
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildDayun(
  person: Person,
  yearStem: number,
  month: { stem: number; branch: number },
  around: { prev: { utc: number }; next: { utc: number } },
  birthUtc: number,
): Chart["dayun"] {
  const yangYear = yangStem(yearStem);
  const forward = person.gender === "male" ? yangYear : !yangYear;
  const target = forward ? around.next.utc : around.prev.utc;
  const diffDays = Math.abs(target - birthUtc) / 86400000;
  let years = Math.floor(diffDays / 3);
  let remain = diffDays - years * 3;
  let months = Math.floor(remain * 4);
  let days = Math.round((remain * 4 - months) * 30);
  if (days >= 30) {
    months += 1;
    days -= 30;
  }
  if (months >= 12) {
    years += Math.floor(months / 12);
    months = months % 12;
  }
  const startAgeMonths = years * 12 + months;
  const steps: DayunStep[] = [];
  let stem = month.stem;
  let branch = month.branch;
  for (let i = 0; i < 8; i++) {
    if (forward) {
      stem = (stem + 1) % 10;
      branch = (branch + 1) % 12;
    } else {
      stem = (stem + 9) % 10;
      branch = (branch + 11) % 12;
    }
    const ageMonths = startAgeMonths + i * 120;
    const start = addMonths(person.time.year, person.time.month, ageMonths);
    steps.push({
      stem,
      branch,
      text: pillarText(stem, branch),
      startAgeMonths: ageMonths,
      startYear: start.year,
      startMonth: start.month,
    });
  }
  return { forward, yangYear, startYears: years, startMonths: months, startDays: days, steps };
}

function addMonths(year: number, month: number, add: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + add;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function flowYearLabel(now: Date): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const tz = -now.getTimezoneOffset() / 60;
  const utc = civilToUtc(year, month, day, hour, minute, tz);
  const lichun = solarTermUtc(year, 315);
  const y = utc < lichun ? year - 1 : year;
  const idx = splitIndex(yearIndex(y));
  return pillarText(idx.stem, idx.branch);
}

export function formatWhen(utc: number, tz: number): string {
  const c = utcToCivil(utc, tz);
  return `${c.year}-${pad(c.month)}-${pad(c.day)} ${pad(c.hour)}:${pad(c.minute)}`;
}

export function clockLabel(person: Person): string {
  const t = person.time;
  const hm = person.hourUnknown || t.hour == null ? "时辰未知" : `${pad(t.hour)}:${pad(t.minute)}`;
  return `${t.year}-${pad(t.month)}-${pad(t.day)} ${hm}`;
}

export function ageMonths(person: Person, now: Date): number {
  let months = (now.getFullYear() - person.time.year) * 12 + (now.getMonth() + 1 - person.time.month);
  if (now.getDate() < person.time.day) months -= 1;
  return months;
}

export function elementChar(stem: number): string {
  return ELEMENTS[stemElement(stem)];
}

export { BRANCHES, ELEMENTS, STEMS };
