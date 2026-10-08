import assert from "node:assert/strict";
import { hydrate } from "../src/store";
import { finishDailyRound } from "../src/progression";
import {
  dailyRoundTurns,
  coreStar,
  roundStar,
  starDay,
  starProgress,
  starPosition,
} from "../src/galaxy";
import {
  birthError,
  daysInMonth,
  selectedCity,
  emptyBirth,
} from "../src/components/BirthFields";
import { PROVINCES } from "../src/places";

const beforeMidnight = Date.parse("2026-10-06T23:59:59+08:00");
const midnight = Date.parse("2026-10-07T00:00:00+08:00");
const core = { ...coreStar(), litAt: beforeMidnight };
const round = {
  ...roundStar("今天", { god: "", echo: "回声" }),
  litAt: beforeMidnight,
};
assert.equal(starDay(beforeMidnight), "2026-10-06");
assert.equal(starDay(midnight), "2026-10-07");
assert.equal(
  starProgress([core], 1, beforeMidnight).allowed,
  false,
  "Incomplete dialogue cannot light a star",
);
assert.equal(
  starProgress([core], 2, beforeMidnight).allowed,
  true,
  "Core does not consume the daily allowance",
);
assert.equal(
  starProgress([core, round], 20, beforeMidnight).allowed,
  false,
  "Many conversations cannot bypass daily limit",
);
assert.equal(
  starProgress(JSON.parse(JSON.stringify([core, round])), 20, beforeMidnight)
    .litToday,
  true,
  "Persisted stars retain daily limit",
);
assert.equal(
  starProgress([core, round], 2, midnight).allowed,
  true,
  "China midnight resets allowance",
);
assert.equal(
  starProgress([core, round], 0, midnight).allowed,
  false,
  "Time alone never lights a star",
);
assert.equal(
  starProgress([core, { ...round, litAt: midnight }], 2, beforeMidnight)
    .allowed,
  false,
  "Backward clock does not grant allowance",
);
const seven = Array.from({ length: 7 }, (_, i) => ({
  ...round,
  id: String(i),
}));
assert.equal(starProgress([core, ...seven], 100, midnight).complete, true);
assert.equal(
  starProgress([core, ...seven], 100, midnight).allowed,
  false,
  "Cannot create an eighth round star",
);
assert.equal(
  new Set(Array.from({ length: 7 }, (_, i) => JSON.stringify(starPosition(i))))
    .size,
  7,
);
assert.equal(daysInMonth("2000", "2"), 29);
assert.equal(daysInMonth("1900", "2"), 28);
const valid = {
  ...emptyBirth,
  year: "2000",
  month: "2",
  day: "29",
  hour: "0",
  minute: "0",
};
assert.equal(birthError(valid), null, "00:00 is valid");
assert.ok(
  birthError({ ...valid, year: "2001" }),
  "Invalid leap day is rejected",
);
assert.ok(birthError({ ...valid, hour: "24" }));
assert.ok(birthError({ ...valid, minute: "60" }));
assert.equal(
  birthError({ ...valid, hour: "", minute: "", unknown: true }),
  null,
);
assert.ok(
  birthError(
    { ...valid, year: "2026", month: "10", day: "8" },
    new Date("2026-10-07T12:00:00+08:00"),
  ),
  "Future birthday is rejected",
);
assert.equal(PROVINCES.length, 31);
assert.ok(PROVINCES.every((p) => p.cities.length > 0));
assert.ok(
  PROVINCES.every(
    (p) => new Set(p.cities.map((c) => c.code)).size === p.cities.length,
  ),
);
for (const p of PROVINCES)
  for (const c of p.cities) {
    assert.ok(
      c.longitude >= 70 &&
        c.longitude <= 140 &&
        c.latitude >= 0 &&
        c.latitude <= 60,
    );
    assert.equal(
      selectedCity({ country: "CN", province: p.code, city: c.code })?.name,
      c.name,
    );
  }
assert.equal(
  selectedCity({ country: "CN", province: "110000", city: "440100" }),
  undefined,
  "Stale city cannot belong to new province",
);
assert.equal(
  selectedCity({ country: "", province: "110000", city: "110000" }),
  undefined,
);

assert.equal(
  dailyRoundTurns(
    [
      { role: "user", at: beforeMidnight },
      { role: "user", at: midnight },
    ],
    2,
    midnight,
  ),
  1,
  "Yesterday's messages do not count today",
);
assert.equal(
  dailyRoundTurns(
    [
      { role: "user", at: midnight },
      { role: "guide" },
      { role: "user", at: midnight },
    ],
    2,
    midnight,
  ),
  2,
);
assert.equal(
  dailyRoundTurns([{ role: "user", at: midnight }], 0, midnight),
  0,
  "Closed rounds cannot count twice",
);
assert.equal(
  dailyRoundTurns([{ role: "user" }], 1, midnight),
  0,
  "Undated legacy messages cannot bypass the limit",
);

console.log(
  "Progression, midnight boundary, persistence, daily conversations, date validation and all 31 province cascades: passed.",
);

const eligible = hydrate({
  stars: [core],
  roundTurns: 2,
  messages: [
    { id: "one", role: "user", text: "今天想休息", at: beforeMidnight },
    { id: "two", role: "user", text: "慢慢来", at: beforeMidnight },
  ],
});
const lit = finishDailyRound(eligible, beforeMidnight);
assert.equal(
  lit.stars.length,
  2,
  "Clicking the eligible next star creates one round star",
);
assert.equal(lit.roundTurns, 0);
assert.equal(lit.stars[1].litAt, beforeMidnight);
assert.equal(
  finishDailyRound(lit, beforeMidnight),
  lit,
  "Repeated clicks cannot light twice",
);
assert.equal(
  finishDailyRound(eligible, midnight),
  eligible,
  "Click at midnight rechecks today's conversations",
);
