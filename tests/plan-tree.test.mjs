import assert from "node:assert/strict";
import test from "node:test";
import { PlanTreeError, createTree, emptyTree } from "@/features/learning/core/plan-tree";

const node = (id, title = id) => ({ id, title });

test("the empty seed tree is version 0", () => {
  assert.deepEqual(emptyTree(), { nodes: [], edges: [], version: 0 });
});

test("a valid DAG builds at version 1 without sharing its inputs", () => {
  const nodes = [node("a"), node("b"), node("c")];
  const edges = [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "a", to: "c" }];
  const tree = createTree(nodes, edges);
  assert.equal(tree.version, 1);
  assert.deepEqual(tree.edges, edges);
  assert.notEqual(tree.nodes[0], nodes[0]);
  tree.nodes[0].title = "changed";
  assert.equal(nodes[0].title, "a");
});

test("invalid trees are rejected with an agent-readable PlanTreeError", () => {
  const cases = [
    [[node("a"), node("a")], [], /Duplicate node id "a"/],
    [[node(""), node("b")], [], /non-empty `id`/],
    [[{ id: "a", title: " " }], [], /needs a non-empty `title`/],
    [[node("a")], [{ from: "a", to: "missing" }], /unknown node id "missing"/],
    [[node("a")], [{ from: "a", to: "a" }], /self-loop/],
    [[node("a"), node("b")], [{ from: "a", to: "b" }, { from: "a", to: "b" }], /already exists/],
    [[node("a"), node("b"), node("c")], [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "a" }], /would create a cycle/],
  ];
  for (const [nodes, edges, message] of cases) {
    assert.throws(() => createTree(nodes, edges), (error) => error instanceof PlanTreeError && message.test(error.message));
  }
});
