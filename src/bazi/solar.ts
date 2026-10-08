import { mod } from "./math";

const DEG = Math.PI / 180;

/** 十二节令。月柱以节为界，不用中气。 */
export const JIE: { lon: number; name: string; branch: number }[] = [
  { lon: 315, name: "立春", branch: 2 },
  { lon: 345, name: "惊蛰", branch: 3 },
  { lon: 15, name: "清明", branch: 4 },
  { lon: 45, name: "立夏", branch: 5 },
  { lon: 75, name: "芒种", branch: 6 },
  { lon: 105, name: "小暑", branch: 7 },
  { lon: 135, name: "立秋", branch: 8 },
  { lon: 165, name: "白露", branch: 9 },
  { lon: 195, name: "寒露", branch: 10 },
  { lon: 225, name: "立冬", branch: 11 },
  { lon: 255, name: "大雪", branch: 0 },
  { lon: 285, name: "小寒", branch: 1 },
];

const TERM_NAMES = [
  "春分", "清明", "谷雨", "立夏", "小满", "芒种",
  "夏至", "小暑", "大暑", "立秋", "处暑", "白露",
  "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
  "冬至", "小寒", "大寒", "立春", "雨水", "惊蛰",
];

const APPROX_DAY: Record<number, [number, number]> = {
  0: [3, 21],
  15: [4, 5],
  30: [4, 20],
  45: [5, 6],
  60: [5, 21],
  75: [6, 6],
  90: [6, 21],
  105: [7, 7],
  120: [7, 23],
  135: [8, 7],
  150: [8, 23],
  165: [9, 8],
  180: [9, 23],
  195: [10, 8],
  210: [10, 23],
  225: [11, 7],
  240: [11, 22],
  255: [12, 7],
  270: [12, 22],
  285: [1, 6],
  300: [1, 20],
  315: [2, 4],
  330: [2, 19],
  345: [3, 6],
};

const termCache = new Map<string, number>();

function signed(deg: number): number {
  return mod(deg + 180, 360) - 180;
}

/** ΔT，秒。多项式取自 NASA 五十年分段（Espenak & Meeus）。 */
export function deltaTSeconds(year: number): number {
  const t = year - 2000;
  if (year >= 2005 && year < 2050) return 62.92 + 0.32217 * t + 0.005589 * t * t;
  if (year >= 1986 && year < 2005) {
    return (
      63.86 +
      0.3345 * t -
      0.060374 * t * t +
      0.0017275 * t ** 3 +
      0.000651814 * t ** 4 +
      0.00002373599 * t ** 5
    );
  }
  if (year >= 1961 && year < 1986) {
    const u = year - 1975;
    return 45.45 + 1.067 * u - (u * u) / 260 - u ** 3 / 718;
  }
  if (year >= 1941 && year < 1961) {
    const u = year - 1950;
    return 29.07 + 0.407 * u - (u * u) / 233 + u ** 3 / 2547;
  }
  if (year >= 1920 && year < 1941) {
    const u = year - 1920;
    return 21.2 + 0.84493 * u - 0.0761 * u * u + 0.0020936 * u ** 3;
  }
  if (year >= 1900 && year < 1920) {
    const u = year - 1900;
    return -2.79 + 1.494119 * u - 0.0598939 * u * u + 0.0061966 * u ** 3 - 0.000197 * u ** 4;
  }
  if (year >= 2050 && year <= 2150) {
    const u = (year - 1820) / 100;
    return -20 + 32 * u * u;
  }
  return 69;
}

/**
 * 太阳视黄经，度。Meeus《天文算法》第 25 章低精度公式，时间用 TT。
 * 1900–2100 年间，交节时刻通常落在数分钟内。
 */
export function apparentSolarLongitude(jdUT: number): number {
  const year = 2000 + (jdUT - 2451545) / 365.2425;
  const jdTT = jdUT + deltaTSeconds(year) / 86400;
  const T = (jdTT - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mr = M * DEG;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  return mod(lambda, 360);
}

/** 均时差，分钟。真太阳时 = 平太阳时 + 均时差。 */
export function equationOfTimeMinutes(jdUT: number): number {
  const T = (jdUT - 2451545.0) / 36525;
  const L0 = mod(280.46646 + 36000.76983 * T + 0.0003032 * T * T, 360);
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const eps = (23.439291 - 0.013004167 * T) * DEG;
  const y = Math.tan(eps / 2) ** 2;
  const Mr = M * DEG;
  const Lr = L0 * DEG;
  const E =
    y * Math.sin(2 * Lr) -
    2 * e * Math.sin(Mr) +
    4 * e * y * Math.sin(Mr) * Math.cos(2 * Lr) -
    0.5 * y * y * Math.sin(4 * Lr) -
    1.25 * e * e * Math.sin(2 * Mr);
  return ((E * 180) / Math.PI) * 4;
}

export function julianDayUT(utcMs: number): number {
  return utcMs / 86400000 + 2440587.5;
}

export function utcFromJulian(jd: number): number {
  return (jd - 2440587.5) * 86400000;
}

export function civilToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: number): number {
  return Date.UTC(year, month - 1, day, hour, minute) - tz * 3600000;
}

export function utcToCivil(utcMs: number, tz: number): { year: number; month: number; day: number; hour: number; minute: number } {
  const d = new Date(utcMs + tz * 3600000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** 某公历年、目标黄经的节气时刻，返回 UTC 毫秒。 */
export function solarTermUtc(year: number, longitude: number): number {
  const key = `${year}:${longitude}`;
  const cached = termCache.get(key);
  if (cached != null) return cached;
  const approx = APPROX_DAY[longitude];
  if (!approx) throw new Error(`未知黄经 ${longitude}`);
  let jd = julianDayUT(Date.UTC(year, approx[0] - 1, approx[1], 12, 0, 0));
  for (let i = 0; i < 30; i++) {
    const lon = apparentSolarLongitude(jd);
    const lon2 = apparentSolarLongitude(jd + 0.5);
    const deriv = signed(lon2 - lon) / 0.5;
    const step = signed(longitude - lon) / deriv;
    jd += step;
    if (Math.abs(step) < 1e-6) break;
  }
  const utc = utcFromJulian(jd);
  termCache.set(key, utc);
  return utc;
}

export function longitudeAt(utcMs: number): number {
  return apparentSolarLongitude(julianDayUT(utcMs));
}

export function monthBranchFromLongitude(lon: number): number {
  const shifted = mod(lon - 315, 360);
  const segment = Math.floor(shifted / 30) % 12;
  return mod(2 + segment, 12);
}

export function termNameFromLongitude(lon: number): string {
  return TERM_NAMES[Math.floor(mod(lon, 360) / 15)];
}

export type TermHit = { name: string; longitude: number; branch: number; utc: number };

export function jieAround(utcMs: number, civilYear: number): { prev: TermHit; next: TermHit; entered: string } {
  const hits: TermHit[] = [];
  for (const year of [civilYear - 1, civilYear, civilYear + 1]) {
    for (const jie of JIE) {
      hits.push({ name: jie.name, longitude: jie.lon, branch: jie.branch, utc: solarTermUtc(year, jie.lon) });
    }
  }
  hits.sort((a, b) => a.utc - b.utc);
  let prev = hits[0];
  let next = hits[hits.length - 1];
  for (let i = 0; i < hits.length; i++) {
    if (hits[i].utc <= utcMs) prev = hits[i];
    if (hits[i].utc > utcMs) {
      next = hits[i];
      break;
    }
  }
  return { prev, next, entered: termNameFromLongitude(longitudeAt(utcMs)) };
}

export function trueSolarCorrectionMinutes(utcMs: number, longitude: number, timezone: number): number {
  return 4 * (longitude - 15 * timezone) + equationOfTimeMinutes(julianDayUT(utcMs));
}
