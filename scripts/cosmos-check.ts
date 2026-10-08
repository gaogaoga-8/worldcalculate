import assert from "node:assert/strict";
import { dustPosition, formationPose, FORMATION_MS } from "../src/cosmos";

const dimensions = [
  [1280, 658],
  [390, 790],
  [844, 336],
];
for (const [width, height] of dimensions) {
  const settled = formationPose(1, width, height);
  assert.equal(settled.x, 0);
  assert.equal(Math.abs(settled.y), 0);
  assert.equal(settled.size, 8);
  assert.equal(settled.label, 1);
  assert.equal(settled.opacity, 1);
  assert.ok(
    formationPose(0.45, width, height).x > 0,
    "The selected star travels out of the dust before becoming the core",
  );
  for (let index = 0; index < 60; index++) {
    const star = {
      radius: index / 60,
      angle: index * 0.8,
      scatterX: Math.sin(index),
      scatterY: Math.cos(index),
      phase: index * 0.5,
      depth: 0.6,
    };
    const last = dustPosition(
      star,
      1 - 1e-6,
      FORMATION_MS / 1000,
      width,
      height,
    );
    const first = dustPosition(star, 1, FORMATION_MS / 1000, width, height);
    assert.ok(
      Math.hypot(last.x - first.x, last.y - first.y) < 1e-8,
      "Dust is in exactly the same position when interaction begins",
    );
    assert.equal(last.release, 1);
  }
  const almost = formationPose(0.999, width, height);
  assert.deepEqual(
    almost,
    settled,
    "Core is already at rest before the controls appear",
  );
}
console.log(
  "Star release, core identity and settled-frame continuity on desktop, mobile and landscape: passed.",
);
