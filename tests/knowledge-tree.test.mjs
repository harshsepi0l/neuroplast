import assert from "node:assert/strict";
import test from "node:test";
import { buildKnowledgeTree } from "../src/features/challenges/core/knowledge-tree.ts";
import { SKILLS } from "../src/features/challenges/core/linear-equations.ts";

function result(correctBySkill, points, goalMet = false) {
  return {
    points, goalMet,
    items: SKILLS.flatMap(skill => ["recall", "application"].map((mode, index) => ({
      questionId: `${skill.id}-${mode}`, skillId: skill.id, mode,
      correct: Boolean(correctBySkill[skill.id]?.[index]), response: "", answer: "", explanation: "",
    }))),
  };
}

test("empty tree shows only real, unassessed skills", () => {
  const tree = buildKnowledgeTree([]);
  assert.equal(tree.topic.id, "linear-equations");
  assert.equal(tree.skills.length, 4);
  assert.equal(tree.attempts, 0);
  assert.equal(tree.readySkills, 0);
  assert.ok(tree.skills.every(skill => skill.state === "unassessed" && skill.training.answered === 0));
});

test("tree separates latest assessment from completed training history", () => {
  const first = {
    id: "first", createdAt: "2026-01-01T00:00:00Z", submittedAt: "2026-01-01T00:10:00Z",
    result: result({ "one-step": [false, true] }, 13),
    training: { startedAt: "2026-01-01T01:00:00Z", tasks: [
      ...["recall", "discrimination", "application", "delayed-recall"].map((stage, index) => ({ skillId: "one-step", stage, response: "1", correct: true, answeredAt: `2026-01-01T01:0${index}:00Z` })),
      { skillId: "one-step", stage: "recall", response: "wrong", correct: false, answeredAt: "2026-01-01T01:05:00Z" },
    ] },
  };
  const second = {
    id: "second", createdAt: "2026-01-02T00:00:00Z", submittedAt: "2026-01-02T00:10:00Z",
    result: result({ "one-step": [true, true], "two-step": [false, true] }, 38),
    training: { startedAt: "2026-01-02T01:00:00Z", tasks: [
      { skillId: "two-step", stage: "recall", response: "2", correct: true, answeredAt: "2026-01-02T01:01:00Z" },
    ] },
  };
  const beforeRetake = buildKnowledgeTree([first]).skills[0];
  assert.equal(beforeRetake.state, "trained");
  assert.equal(beforeRetake.training.completed, 4);
  const draft = { id: "draft", createdAt: "2026-01-03T00:00:00Z", result: null };
  const tree = buildKnowledgeTree([first, draft, second]);
  assert.equal(tree.activeChallengeId, "draft");
  assert.equal(tree.latestChallengeId, "second");
  assert.equal(tree.attempts, 2);
  assert.equal(tree.bestScore, 38);
  const oneStep = tree.skills[0];
  assert.equal(oneStep.state, "strong");
  assert.deepEqual(oneStep.latest.recall, { correct: 1, total: 1 });
  assert.equal(oneStep.training.completed, 0);
  assert.equal(oneStep.training.cycles, 1);
  assert.equal(oneStep.training.answered, 5);
  assert.equal(oneStep.training.correct, 4);
  const twoStep = tree.skills[1];
  assert.equal(twoStep.state, "practicing");
  assert.equal(twoStep.training.completed, 1);
  assert.equal(twoStep.training.lastPracticedAt, "2026-01-02T01:01:00Z");
});
