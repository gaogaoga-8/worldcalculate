import assert from "node:assert/strict";
import { coreStar } from "../src/galaxy";
import { getState, hydrate, replaceState, restartFromLink, hasResetBackup, restoreResetBackup, resetState } from "../src/store";

const data = new Map<string, string>();
let failBackup = false;
Object.defineProperty(globalThis, "localStorage", { value: {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failBackup && key.includes("before-reset")) throw new Error("Storage full"); data.set(key, value); },
}, configurable: true });
const original = hydrate({ self: { id: "self", name: "Original", gender: "male", time: { year: 2000, month: 1, day: 1, hour: 12, minute: 0 }, place: { name: "Beijing", longitude: 116.4, latitude: 39.9, timezone: 8 }, hourUnknown: false }, stars: [coreStar()], messages: [{ id: "1", role: "user", text: "saved conversation" }], roundTurns: 2 });
replaceState(original);
data.set("shijie-suanfa/model", "unchanged-model-config");
assert.equal(restartFromLink("http://127.0.0.1:5174/?other=ok"), null);
assert.equal(getState().self?.name, "Original");
assert.equal(restartFromLink("http://127.0.0.1:5174/?restart=1&other=ok#top"), "/?other=ok#top");
assert.equal(getState().self, null);
assert.equal(getState().stars.length, 0);
assert.equal(getState().messages.length, 0);
assert.equal(getState().roundTurns, 0);
assert.ok(hasResetBackup());
assert.equal(data.get("shijie-suanfa/model"), "unchanged-model-config");
const backup = data.get("shijie-suanfa/before-reset");
resetState();
assert.equal(data.get("shijie-suanfa/before-reset"), backup, "Empty reset cannot overwrite recovery data");
assert.equal(restoreResetBackup(), true);
assert.equal(getState().self?.name, "Original");
assert.equal(getState().messages[0].text, "saved conversation");
failBackup = true;
assert.throws(resetState);
assert.equal(getState().self?.name, "Original", "Backup failure leaves records intact");
console.log("One-click reset, URL cleanup, recovery, model preservation and backup failure handling: passed.");
