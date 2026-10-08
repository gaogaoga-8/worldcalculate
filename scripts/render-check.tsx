import { oracleMessages } from "../src/oracle/prompt";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BirthFields,
  LocationFields,
  emptyBirth,
} from "../src/components/BirthFields";
import { IntakeChat } from "../src/components/IntakeChat";
import { SelfSky } from "../src/components/SelfSky";
import { buildChart } from "../src/bazi/chart";
import { coreStar, roundStar } from "../src/galaxy";
import { hydrate, replaceState } from "../src/store";
import type { Person } from "../src/types";

const storage = new Map<string, string>();
// tsx's standalone test loader uses the classic JSX runtime; Vite uses automatic JSX.
Object.defineProperty(globalThis, "React", {
  value: React,
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: {
    setItem: (key: string, value: string) => storage.set(key, value),
    getItem: (key: string) => storage.get(key) ?? null,
  },
  configurable: true,
});
const noop = () => {};
const intake = renderToStaticMarkup(<IntakeChat onDone={noop} />);
assert.ok(intake.includes('aria-label="出生年份"'));
assert.ok(intake.includes('aria-label="出生小时"'));
assert.ok(intake.includes('aria-label="出生分钟"'));
assert.ok(!intake.includes('type="date"'));
assert.ok(
  !intake.includes('class="choice"'),
  "Personality quiz must not block onboarding",
);
const february = renderToStaticMarkup(
  <BirthFields
    value={{ ...emptyBirth, year: "2001", month: "2" }}
    onChange={noop}
  />,
);
assert.ok(february.includes('value="28"'));
assert.ok(!february.includes('value="29">29 日'));
const country = renderToStaticMarkup(
  <LocationFields
    value={{ country: "", province: "", city: "" }}
    onChange={noop}
  />,
);
assert.ok(country.includes('aria-label="出生国家"'));
assert.ok(!country.includes('aria-label="出生省份"'));
const province = renderToStaticMarkup(
  <LocationFields
    value={{ country: "CN", province: "", city: "" }}
    onChange={noop}
  />,
);
assert.ok(province.includes('aria-label="出生省份"'));
assert.ok(!province.includes('aria-label="出生城市"'));
const beijing = renderToStaticMarkup(
  <LocationFields
    value={{ country: "CN", province: "110000", city: "" }}
    onChange={noop}
  />,
);
assert.ok(beijing.includes('aria-label="出生城市"'));
assert.ok(beijing.includes("北京市"));
const person: Person = {
  id: "self",
  name: "测试",
  gender: "male",
  time: { year: 2000, month: 1, day: 1, hour: 0, minute: 0 },
  place: { name: "北京市", longitude: 116.4, latitude: 39.9, timezone: 8 },
  hourUnknown: false,
  mbti: null,
};
const core = coreStar();
replaceState(hydrate({ self: person, stars: [core] }));
const chart = buildChart(person, { ziHour: "early" });
const sky = renderToStaticMarkup(<SelfSky chart={chart} onHome={noop} />);
const introduction = renderToStaticMarkup(<SelfSky chart={chart} onHome={noop} forming formationId={1} onSettled={noop} />);
assert.equal((introduction.match(/<canvas/g) ?? []).length, 1, "Introduction renders the same single sky canvas");
assert.equal((introduction.match(/cosmos-core/g) ?? []).length, 1, "The animated hero is the actual interactive core");
assert.ok(introduction.includes('aria-label="与本命星对话"'));
assert.ok(introduction.includes('aria-label="跳过生成动画"'));
assert.ok(introduction.includes("is-forming"));
assert.ok(!introduction.includes('class="galaxy '), "No separate fullscreen galaxy replaces the scene");
assert.equal((sky.match(/class="orb dormant"/g) ?? []).length, 7);
assert.equal((sky.match(/cosmos-core/g) ?? []).length, 1);
assert.ok(sky.includes('aria-label="与本命星对话"'));
assert.ok(!sky.includes('aria-label="与本命对话"'), "Dialogue is revealed only after selecting a star");
assert.ok(!sky.includes("<line "), "Stars must not have constellation links");
assert.ok(!sky.includes("star-tabs"), "No toolbar on the main star scene");
assert.ok(!sky.includes("cosmos-tools"));
assert.ok(!sky.includes("cosmos-rule"));
assert.ok(!intake.includes("onboarding-story"));
assert.ok(!intake.includes("step-description"));
assert.ok(!intake.includes("使用公历与出生地"));
assert.ok(!intake.includes('<input type="text"'));
const round = roundStar("今天的故事", { god: "", echo: "回声" });
replaceState(
  hydrate({
    self: person,
    stars: [core, round],
    messages: [{ id: "old", role: "user", text: "原记录", at: Date.now() }],
  }),
);
const later = renderToStaticMarkup(<SelfSky chart={chart} onHome={noop} />);
assert.equal((later.match(/class="orb dormant"/g) ?? []).length, 6);
assert.ok(later.includes("今天的故事"));
assert.equal(storage.get("shijie-suanfa/v1")?.includes("原记录"), true, "Records remain persisted while the default scene is quiet");
assert.ok(!later.includes("再完成"));
console.log(
  "Server-rendered onboarding, date options, progressive place selectors, one lit core, dormant stars, dialogue and retained records: passed.",
);

const prompt = oracleMessages({
  kind: "chat",
  question: "继续",
  chart,
  mbti: null,
  stars: [core],
  history: [
    { role: "user", text: "前一个问题" },
    { role: "guide", text: "之前的回答" },
  ],
});
assert.deepEqual(
  prompt.map((turn) => turn.role),
  ["system", "user", "assistant", "user"],
);
assert.equal(prompt[1].content, "前一个问题");
assert.equal(prompt[2].content, "之前的回答");
