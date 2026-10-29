import assert from "node:assert/strict";
import test from "node:test";
import { challengeTopic, checksByNode, layerDepths, learnTopic } from "@/features/knowledge/core/skill-trees";
import { buildKnowledgeTree } from "@/features/challenges/core/knowledge-tree";

const call = (id, nodeId, name = "quiz") => ({ id: `a-${id}`, role: "assistant", content: [{ type: "toolCall", id, name, arguments: { nodeId, question: "?" } }] });
const result = (id, details, extra = {}) => ({ id: `r-${id}`, role: "toolResult", toolCallId: id, toolName: "quiz", content: [], isError: false, details, ...extra });

test("layers follow the longest prerequisite chain, and survive cycles", () => {
  const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const d = layerDepths(nodes, [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "b", to: "d" }, { from: "c", to: "d" }, { from: "x", to: "a" }]);
  assert.deepEqual([...d].sort(), [["a", 0], ["b", 1], ["c", 1], ["d", 2]]);
  const cyc = layerDepths([{ id: "p" }, { id: "q" }], [{ from: "p", to: "q" }, { from: "q", to: "p" }]);
  assert.equal(cyc.size, 2);
});

test("checks are counted per plan step: asked, answered, graded, right", () => {
  const checks = checksByNode([
    call("1", "a"), result("1", { kind: "quiz", correct: true }),
    call("2", "a"), result("2", { kind: "quiz", correct: false }),
    call("3", "a"), result("3", { kind: "quiz", dontKnow: true }),
    call("4", "b", "explain"), result("4", { kind: "explain", text: "…" }),
    call("5", "b"), result("5", null, { isError: true }),
    call("6", "c"),
    { id: "x", role: "assistant", content: [{ type: "toolCall", id: "7", name: "probe", arguments: {} }] },
  ]);
  assert.deepEqual(checks.get("a"), { asked: 3, answered: 3, graded: 2, correct: 1 });
  assert.deepEqual(checks.get("b"), { asked: 1, answered: 1, graded: 0, correct: 0 });
  assert.deepEqual(checks.get("c"), { asked: 1, answered: 0, graded: 0, correct: 0 });
});

test("a branching Learn plan becomes a layered tree with step statuses", () => {
  const tree = { version: 1, nodes: [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }, { id: "d", title: "D" }],
    edges: [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "b", to: "d" }, { from: "c", to: "d" }] };
  const topic = learnTopic({ id: "chat_1", title: "Bayes", updatedAt: "2026-10-29", tree,
    messages: [call("1", "a"), result("1", { kind: "quiz", correct: true }), call("2", "b")] });
  assert.equal(topic.key, "learn:chat_1");
  assert.equal(topic.branching, true);
  assert.deepEqual(topic.nodes.map((n) => [n.id, n.depth, n.status]), [["a", 0, "solid"], ["b", 1, "learning"], ["c", 1, "ahead"], ["d", 2, "ahead"]]);
  assert.equal(topic.statusLine, "Learn · step 2 of 4");
  const fresh = learnTopic({ id: "chat_2", title: "X", updatedAt: "", tree, messages: [] });
  assert.equal(fresh.statusLine, "Learn · 4 steps planned");
});

test("a challenge topic is a path of its skills", () => {
  const knowledge = buildKnowledgeTree([]);
  const topic = challengeTopic(knowledge, true);
  assert.equal(topic.kind, "challenge");
  assert.equal(topic.branching, false);
  assert.equal(topic.statusLine, "Chapter · not started");
  assert.deepEqual(topic.nodes.map((n) => n.depth), [0, 1, 2, 3]);
  assert.equal(topic.edges.length, 3);
  assert.ok(topic.nodes.every((n) => n.status === "unassessed" && n.stages?.length === 4));
});
