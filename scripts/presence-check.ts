import assert from "node:assert/strict";
import {
  REST_MOOD,
  hearMood,
  memoryCue,
  reachLine,
  recall,
  remember,
  settleMood,
  type MemoryNote,
  type Mood,
} from "../src/presence";

function at(day: number, hour: number, minute = 0): number {
  return Date.UTC(2026, 9, day, hour - 8, minute, 0);
}

const morning = at(14, 7);
const afternoon = at(14, 15);
const night = at(14, 22);
const late = at(14, 20, 30);

const kept = remember([], "哈哈", afternoon, "a");
assert.equal(kept.length, 0, "A laugh is not a memory");
const work = remember([], "最近项目要延期，我有点扛不住", afternoon, "b");
assert.equal(work.length, 1);
assert.equal(work[0].text.includes("项目要延期"), true);
const again = remember(work, "最近项目要延期，老板又催了", afternoon + 1000, "c");
assert.equal(again.length, 1, "A repeated fact replaces the old note");
assert.equal(recall(again, "项目延期怎么办").length, 1);
assert.equal(recall(again, "今天天气不错").length, 0);
assert.equal(memoryCue(recall(again, "项目延期")).includes("项目"), true);

const stung = hearMood(REST_MOOD, "别烦我", afternoon);
assert.ok(stung.sting >= 48, "Being brushed off cools the star");
const soothed = hearMood(stung, "对不起，我刚才太冲了", afternoon + 1000);
assert.ok(soothed.sting < stung.sting);
const worried = hearMood(REST_MOOD, "我最近睡不着，心累", afternoon);
assert.ok(worried.worry >= 42);
const faded = settleMood({ ...stung, at: afternoon - 10 * 3600000 }, afternoon);
assert.ok(faded.sting < stung.sting, "A grudge fades if left alone");

const mood: Mood = { ...REST_MOOD, at: morning - 86400000 };
const hello = reachLine({ now: morning, messages: [], memories: [], mood, reachedAt: null });
assert.ok(hello && /早|今天先别急/.test(hello.text));
assert.equal(
  reachLine({
    now: morning + 10 * 60 * 1000,
    messages: [{ role: "guide", text: hello!.text, at: morning, reach: true }],
    memories: [],
    mood,
    reachedAt: morning,
  }),
  null,
  "It does not greet twice",
);

const prior = [
  { role: "user", text: "最近项目要延期", at: afternoon - 5 * 3600000 },
  { role: "guide", text: "那你先撑着。", at: afternoon - 5 * 3600000 + 1000 },
];
const quiet = reachLine({
  now: afternoon,
  messages: prior,
  memories: again,
  mood,
  reachedAt: null,
});
assert.equal(quiet?.text, `你之前说的「${again[0].text.slice(0, 12)}」，后来呢。`);
assert.equal(
  reachLine({ now: late, messages: prior, memories: again, mood, reachedAt: null }),
  null,
  "After eight it does not ask what they are doing",
);
const goodnight = reachLine({
  now: night,
  messages: [
    { role: "user", text: "今天先这样", at: afternoon },
    { role: "guide", text: "嗯。", at: afternoon + 1000 },
  ],
  memories: [],
  mood,
  reachedAt: afternoon,
});
assert.ok(goodnight && /睡|先到这/.test(goodnight.text));
assert.equal(
  reachLine({
    now: night,
    messages: [
      { role: "user", text: "别烦我", at: afternoon - 86400000 },
      { role: "guide", text: "好。", at: afternoon - 86400000 + 1000 },
    ],
    memories: [],
    mood: stung,
    reachedAt: null,
  }),
  null,
  "It stays quiet when it is still put out",
);

const notes: MemoryNote[] = again;
assert.equal(notes[0].id, "b");
console.log("Memory, mood and the star speaking first: passed.");
