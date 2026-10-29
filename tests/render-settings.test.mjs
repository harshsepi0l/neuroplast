import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RENDER_SETTINGS,
  EDGE_WIDTH_LADDER,
  NODE_SIZE_LADDER,
  sanitizeRenderSettings,
  snapToLadder,
} from "@/features/knowledge/core/render-settings";

test("ladder snapping picks the nearest entry and breaks ties low", () => {
  assert.equal(snapToLadder(2.4, [1, 2, 3]), 2);
  assert.equal(snapToLadder(2.5, [1, 2, 3]), 2);
  assert.equal(snapToLadder(-50, [1, 2, 3]), 1);
  assert.equal(snapToLadder(50, [1, 2, 3]), 3);
});

test("garbage input falls back to the defaults", () => {
  for (const raw of [null, undefined, "nope", 42, []]) {
    assert.deepEqual(sanitizeRenderSettings(raw), sanitizeRenderSettings(DEFAULT_RENDER_SETTINGS));
  }
});

test("sanitizing is idempotent", () => {
  const once = sanitizeRenderSettings({ sizeUnits: "world", nodeSize: 1e9, edgeWidth: -3, clusterLabels: "yes", physics: { linkStrength: 99 } });
  assert.deepEqual(sanitizeRenderSettings(once), once);
});

test("out-of-range values snap to the ladder and wrong types reset", () => {
  const out = sanitizeRenderSettings({ sizeUnits: "world", nodeSize: 1e9, edgeWidth: -3, clusterLabels: "yes" });
  assert.equal(out.nodeSize, NODE_SIZE_LADDER.at(-1));
  assert.equal(out.edgeWidth, EDGE_WIDTH_LADDER[0]);
  assert.equal(out.clusterLabels, DEFAULT_RENDER_SETTINGS.clusterLabels);
});

test("legacy screen-unit sizes reset instead of being reinterpreted", () => {
  const legacy = sanitizeRenderSettings({ nodeSize: NODE_SIZE_LADDER.at(-1) });
  assert.equal(legacy.sizeUnits, "world");
  assert.equal(legacy.nodeSize, DEFAULT_RENDER_SETTINGS.nodeSize);
});
