import assert from "node:assert/strict";
import test from "node:test";
import { deleteChatTraces } from "@/features/knowledge/core/graph-deletion";

const at = "2026-01-01T00:00:00.000Z";
const pt = (chatId) => ({ chatId, messageId: `${chatId}-m` });
const nodeLine = (id, chats, aliases = []) => ({ id, name: id, statement: `${id} is true`, aliases, createdAt: at, provenance: chats.map(pt) });
const chain = (id, premises, conclusion, chats) => ({ id, premises, conclusion, provenance: chats.map(pt), createdAt: at });

/** In-memory GraphStore: records every rewrite so tests can assert on it.
 *  Chat A minted n1 and n2; chat B linked n2 and minted n3. */
function store() {
  const s = {
    nodes: [nodeLine("n1", ["A"]), nodeLine("n2", ["A"], ["A's phrasing"]), nodeLine("n2", ["B"]), nodeLine("n3", ["B"])],
    chains: [chain("arg1", ["n1"], "n2", ["A"]), chain("arg2", ["n2"], "n3", ["B"])],
    coverage: [{ chatId: "A", fp: "1", tokens: 1, foldedAt: at }, { chatId: "B", fp: "2", tokens: 1, foldedAt: at }],
    checkpoints: [{ chatId: "A", foldedAt: at }],
    positions: { n1: { x: 0, y: 0 }, n2: { x: 1, y: 1 }, n3: { x: 2, y: 2 }, arg1: { x: 3, y: 3 } },
    rewrites: [],
  };
  return Object.assign(s, {
    readNodes: () => s.nodes,
    readChains: () => s.chains,
    readCoverage: () => s.coverage,
    readCheckpoints: () => s.checkpoints,
    readPositions: () => s.positions,
    writePositions: (next) => { s.positions = next; },
    rewriteLedgers: (next) => { s.rewrites.push(next); Object.assign(s, next); },
  });
}

test("delete-nodes removes the chat's orphans and keeps shared nodes' identity", () => {
  const s = store();
  const stats = deleteChatTraces(s, "A", "delete-nodes");
  assert.deepEqual(stats, { nodesRemoved: 1, chainsRemoved: 1, coverageRemoved: 1, checkpointsRemoved: 1 });
  // n1 (only A) dies; n2's create line survives without A's phrasings or points.
  assert.deepEqual(s.nodes, [
    { ...nodeLine("n2", []), aliases: [] },
    nodeLine("n2", ["B"]),
    nodeLine("n3", ["B"]),
  ]);
  // arg1 had a dead premise; arg2 is untouched.
  assert.deepEqual(s.chains.map((c) => c.id), ["arg2"]);
  assert.deepEqual(s.coverage.map((c) => c.chatId), ["B"]);
  assert.deepEqual(s.checkpoints, []);
  assert.deepEqual(Object.keys(s.positions).sort(), ["n2", "n3"]);
});

test("preserve-graph only drops the chat's extraction bookkeeping", () => {
  const s = store();
  const before = { nodes: s.nodes, chains: s.chains, positions: s.positions };
  const stats = deleteChatTraces(s, "A", "preserve-graph");
  assert.deepEqual(stats, { nodesRemoved: 0, chainsRemoved: 0, coverageRemoved: 1, checkpointsRemoved: 1 });
  assert.deepEqual(Object.keys(s.rewrites[0]).sort(), ["checkpoints", "coverage"]);
  assert.equal(s.nodes, before.nodes);
  assert.equal(s.chains, before.chains);
  assert.equal(s.positions, before.positions);
});

test("a chat that never touched the graph rewrites nothing", () => {
  const s = store();
  assert.deepEqual(deleteChatTraces(s, "C", "delete-nodes"), { nodesRemoved: 0, chainsRemoved: 0, coverageRemoved: 0, checkpointsRemoved: 0 });
  assert.deepEqual(s.rewrites, []);
});

test("deletion is idempotent", () => {
  const s = store();
  deleteChatTraces(s, "A", "delete-nodes");
  const snapshot = JSON.stringify({ nodes: s.nodes, chains: s.chains, positions: s.positions });
  assert.deepEqual(deleteChatTraces(s, "A", "delete-nodes"), { nodesRemoved: 0, chainsRemoved: 0, coverageRemoved: 0, checkpointsRemoved: 0 });
  assert.equal(JSON.stringify({ nodes: s.nodes, chains: s.chains, positions: s.positions }), snapshot);
});

test("an unknown mode is refused before anything is touched", () => {
  const s = store();
  assert.throws(() => deleteChatTraces(s, "A", "everything"), /Unknown deletion mode/);
  assert.deepEqual(s.rewrites, []);
});
