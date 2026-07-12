import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const sourcePath = resolve("app/dj-rotation.ts");
const source = await readFile(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
}).outputText;
const rotation = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

const expectedPerformers = ["black", "gold", "red", "silver", "violet"];
const scenarios = [
  { label: "rock", song: { bpm: 142, mood: "rock" } },
  { label: "ballad", song: { bpm: 92, mood: "ballad" } },
  { label: "fast-tech", song: { bpm: 132, mood: "tech" } },
  { label: "mid-tech", song: { bpm: 120, mood: "tech" } },
  { label: "soft-tech", song: { bpm: 108, mood: "tech" } },
];

console.log("DJ rotation coverage check");

for (const { label, song } of scenarios) {
  const order = rotation.getDjRotationOrder(song);
  assert.deepEqual([...order].sort(), expectedPerformers, `${label}: roster must contain all five performers`);

  for (let activeIndex = 0; activeIndex < order.length; activeIndex += 1) {
    const appearances = Array.from({ length: order.length }, (_, slotIndex) =>
      rotation.getDjRotationPlan(
        order,
        activeIndex,
        slotIndex * rotation.DJ_ROTATION_SECONDS + 0.1,
      ).mainPerformer,
    );
    assert.deepEqual(
      [...new Set(appearances)].sort(),
      expectedPerformers,
      `${label} track ${activeIndex}: every performer must appear once per cycle`,
    );
  }

  console.log(`- ${label}: ${order.join(" -> ")} -> PASS`);
}

const boundaryOrder = rotation.getDjRotationOrder({ bpm: 128, mood: "tech" });
const beforeHandoff = rotation.getDjRotationPlan(boundaryOrder, 0, rotation.DJ_ROTATION_SECONDS - 0.01);
const afterHandoff = rotation.getDjRotationPlan(boundaryOrder, 0, rotation.DJ_ROTATION_SECONDS);
assert.equal(beforeHandoff.mainPerformer, boundaryOrder[0], "performer must stay on deck before the boundary");
assert.equal(afterHandoff.mainPerformer, boundaryOrder[1], "next performer must take over at the boundary");
assert.equal(afterHandoff.slotElapsed, 0, "new slot must start from zero");

const partialRoster = ["gold", "silver", "black"];
const partialAppearances = Array.from({ length: partialRoster.length }, (_, slotIndex) =>
  rotation.getDjRotationPlan(partialRoster, 0, slotIndex * rotation.DJ_ROTATION_SECONDS).mainPerformer,
);
assert.deepEqual(partialAppearances, partialRoster, "available performers must rotate without gaps");

const expectedMinimumVideoSeconds = 29;
assert.ok(
  rotation.DJ_ROTATION_SECONDS * rotation.DJ_MAIN_MAX_PLAYBACK_RATE < expectedMinimumVideoSeconds,
  "main video must hand off before a generated clip can loop",
);

console.log(`- ${rotation.DJ_ROTATION_SECONDS}s boundary handoff -> PASS`);
console.log("- video loop safety margin -> PASS");
console.log("- missing-media fallback roster -> PASS");
console.log("All DJ performers are scheduled and reachable.");
