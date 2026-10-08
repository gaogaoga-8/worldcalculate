import { mod } from "./math";

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
export const ELEMENTS = ["木", "火", "土", "金", "水"] as const;

export const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
export const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

/** 藏干：本气、中气、余气 */
export const HIDDEN: readonly (readonly number[])[] = [
  [9],
  [5, 9, 7],
  [0, 2, 4],
  [1],
  [4, 1, 9],
  [2, 6, 4],
  [3, 5],
  [5, 3, 1],
  [6, 8, 4],
  [7],
  [4, 7, 3],
  [8, 0],
];

export const HIDDEN_WEIGHT = [1, 0.6, 0.3];

export const NAYIN = [
  "海中金", "炉中火", "大林木", "路旁土", "剑锋金", "山头火",
  "涧下水", "城头土", "白蜡金", "杨柳木", "泉中水", "屋上土",
  "霹雳火", "松柏木", "长流水", "砂石金", "山下火", "平地木",
  "壁上土", "金箔金", "覆灯火", "天河水", "大驿土", "钗钏金",
  "桑柘木", "大溪水", "沙中土", "天上火", "石榴木", "大海水",
] as const;

const STAGES = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"] as const;
const STAGE_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];

export const TEN_GOD_DEF: Record<string, string> = {
  比肩: "与日主同五行、同阴阳。同一种力量再来一份。",
  劫财: "与日主同五行、阴阳不同。同类，但步调不完全一样。",
  食神: "日主所生，阴阳相同。日主向外输出的一路。",
  伤官: "日主所生，阴阳不同。同样是输出，棱角更明显。",
  偏财: "日主所克，阴阳相同。日主去掌握的外部资源。",
  正财: "日主所克，阴阳不同。日主去经营的外部资源。",
  七杀: "克日主，阴阳相同。外来的压力与裁断。",
  正官: "克日主，阴阳不同。外来的规则与职责。",
  偏印: "生日主，阴阳相同。滋养日主的一路，来路比较偏。",
  正印: "生日主，阴阳不同。滋养日主的一路，来路比较正。",
};

export function stemElement(stem: number): number {
  return STEM_ELEMENT[stem];
}

export function elementChar(stem: number): string {
  return ELEMENTS[STEM_ELEMENT[stem]];
}

export function yangStem(stem: number): boolean {
  return stem % 2 === 0;
}

export function pillarText(stem: number, branch: number): string {
  return STEMS[stem] + BRANCHES[branch];
}

export function pillarIndex(stem: number, branch: number): number {
  if (stem % 2 !== branch % 2) {
    throw new Error(`干支阴阳不合: ${STEMS[stem]}${BRANCHES[branch]}`);
  }
  let i = stem;
  while (i % 12 !== branch) i += 10;
  return i;
}

export function nayinOf(index: number): string {
  return NAYIN[Math.floor(index / 2)];
}

export function yearIndex(year: number): number {
  return mod(year - 4, 60);
}

export function splitIndex(index: number): { stem: number; branch: number } {
  return { stem: mod(index, 10), branch: mod(index, 12) };
}

/** 五虎遁：年干定寅月天干，再推到月支。 */
export function monthStem(yearStem: number, monthBranch: number): number {
  const yin = mod(yearStem % 5 * 2 + 2, 10);
  const offset = mod(monthBranch - 2, 12);
  return mod(yin + offset, 10);
}

/** 五鼠遁：日干定子时天干。 */
export function hourStem(dayStem: number, hourBranch: number): number {
  const zi = mod(dayStem % 5 * 2, 10);
  return mod(zi + hourBranch, 10);
}

export function hourBranchFromClock(hour: number, minute: number): number {
  const h = hour + minute / 60;
  if (h >= 23 || h < 1) return 0;
  return Math.floor((h + 1) / 2) % 12;
}

export function tenGod(dayStem: number, other: number): string {
  const de = STEM_ELEMENT[dayStem];
  const oe = STEM_ELEMENT[other];
  const same = dayStem % 2 === other % 2;
  if (de === oe) return same ? "比肩" : "劫财";
  if ((de + 1) % 5 === oe) return same ? "食神" : "伤官";
  if ((oe + 1) % 5 === de) return same ? "偏印" : "正印";
  if ((de + 2) % 5 === oe) return same ? "偏财" : "正财";
  return same ? "七杀" : "正官";
}

export function lifeStage(stem: number, branch: number): string {
  const start = STAGE_START[stem];
  const offset = yangStem(stem) ? mod(branch - start, 12) : mod(start - branch, 12);
  return STAGES[offset];
}

/** 日柱所在旬的空亡。 */
export function voidBranches(dayIndex: number): [number, number] {
  const xun = dayIndex - (dayIndex % 10);
  const branch = xun % 12;
  return [mod(branch + 10, 12), mod(branch + 11, 12)];
}

export function dayIndexFromDate(year: number, month: number, day: number): number {
  const jd = julianNoon(year, month, day);
  return mod(Math.round(jd - 2451545) + 54, 60);
}

function julianNoon(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + 0.5 + B - 1524.5;
}
