import { buildChart, type Chart } from "./chart";
import { pillarText, tenGod } from "./ganzhi";
import { equationOfTimeMinutes, julianDayUT, solarTermUtc } from "./solar";
import type { Person } from "../types";

const failures: string[] = [];

function expect(name: string, actual: string, expected: string) {
  if (actual !== expected) failures.push(`${name}\n  实际 ${actual}\n  期望 ${expected}`);
  else console.log(`ok  ${name}  ${actual}`);
}

function person(partial: Partial<Person> & Pick<Person, "time" | "gender">): Person {
  return {
    id: "t",
    name: "测",
    hourUnknown: partial.time.hour == null,
    place: partial.place ?? { name: "东经120", longitude: 120, latitude: 30, timezone: 8 },
    mbti: null,
    ...partial,
  };
}

function line(chart: Chart): string {
  return chart.pillars.map((p) => (p.missing ? "未知" : p.text)).join(" ");
}

function term(year: number, lon: number, label: string, expectUtc8: string) {
  const utc = solarTermUtc(year, lon);
  const d = new Date(utc + 8 * 3600000);
  const actual = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
  const target = Date.parse(expectUtc8.replace(" ", "T") + "+08:00");
  const deltaSec = Math.round((utc - target) / 1000);
  console.log(`term ${label}  ${actual}  Δ ${deltaSec}s`);
  if (Math.abs(deltaSec) > 600) failures.push(`${label} 误差 ${deltaSec}s，超出 600s`);
}

const noon = person({
  gender: "male",
  time: { year: 2000, month: 1, day: 1, hour: 12, minute: 0 },
});
const chartNoon = buildChart(noon, { ziHour: "early", now: new Date("2000-06-01T00:00:00Z") });
expect("2000-01-01 12:00", line(chartNoon), "己卯 丙子 戊午 戊午");
expect("年干十神", chartNoon.pillars[0].stemGod, "劫财");
expect("月干十神", chartNoon.pillars[1].stemGod, "偏印");
expect("日柱纳音", chartNoon.pillars[2].nayin, "天上火");
expect("日子星运", chartNoon.pillars[2].stage, "帝旺");
expect("男命首运", chartNoon.dayun.steps[0].text, "乙亥");
expect("男命逆排", chartNoon.dayun.forward ? "顺" : "逆", "逆");

const female = buildChart({ ...noon, gender: "female" }, { ziHour: "early" });
expect("女命首运", female.dayun.steps[0].text, "丁丑");
expect("女命顺排", female.dayun.forward ? "顺" : "逆", "顺");

expect(
  "小寒前仍为子月",
  line(buildChart(person({ gender: "male", time: { year: 2000, month: 1, day: 6, hour: 8, minute: 0 } }), { ziHour: "early" })),
  "己卯 丙子 癸亥 丙辰",
);
expect(
  "小寒后进入丑月",
  line(buildChart(person({ gender: "male", time: { year: 2000, month: 1, day: 6, hour: 12, minute: 0 } }), { ziHour: "early" })),
  "己卯 丁丑 癸亥 戊午",
);
expect(
  "立春前仍为己卯",
  line(buildChart(person({ gender: "male", time: { year: 2000, month: 2, day: 4, hour: 18, minute: 0 } }), { ziHour: "early" })),
  "己卯 丁丑 壬辰 己酉",
);
expect(
  "立春后为庚辰",
  line(buildChart(person({ gender: "male", time: { year: 2000, month: 2, day: 4, hour: 22, minute: 30 } }), { ziHour: "early" })),
  "庚辰 戊寅 壬辰 辛亥",
);

const early = buildChart(
  person({ gender: "male", time: { year: 2000, month: 1, day: 1, hour: 23, minute: 40 } }),
  { ziHour: "early" },
);
expect("早子时日柱进一日", line(early), "己卯 丙子 己未 甲子");
expect("早子时标记", early.solar.shifted ? "yes" : "no", "yes");

const late = buildChart(
  person({ gender: "male", time: { year: 2000, month: 1, day: 1, hour: 23, minute: 40 } }),
  { ziHour: "late" },
);
expect("晚子时日柱不进", line(late), "己卯 丙子 戊午 壬子");

const eot = equationOfTimeMinutes(julianDayUT(Date.UTC(2000, 0, 1, 4, 0, 0)));
console.log(`eot 2000-01-01  ${eot.toFixed(2)} min`);
if (eot < -8 || eot > 0) failures.push(`均时差符号或幅度异常: ${eot}`);

term(2000, 285, "小寒2000", "2000-01-06 09:00:42");
term(2000, 315, "立春2000", "2000-02-04 20:40:24");
term(1999, 270, "冬至1999", "1999-12-22 15:43:48");

const hidden = chartNoon.pillars[2].hidden.map((h) => `${pillarText(h.stem, 0).slice(0, 1)}${h.god}`).join("");
expect("午藏干", hidden, "丁正印己劫财");
expect("乙对戊", tenGod(4, 1), "正官");

if (failures.length) {
  console.error("\n" + failures.join("\n"));
  throw new Error("bazi self-check failed");
}
console.log("\nbazi self-check ok");
