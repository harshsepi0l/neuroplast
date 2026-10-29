import assert from "node:assert/strict";
import test from "node:test";
import { answerTally } from "@/features/learning/core/answer-tally";

const result = (details, extra = {}) => ({ role: "toolResult", toolName: "quiz", isError: false, details, timestamp: 1000, ...extra });

test("tallies answered, graded and correct questions", () => {
  const tally = answerTally([
    { role: "user" },
    result(null), // the "Question posed" placeholder
    result({ kind: "quiz", correct: true }),
    result({ kind: "quiz", correct: false }),
    result({ kind: "quiz", dontKnow: true }),
    result({ kind: "ask" }, { toolName: "ask_user_question" }),
    result({ kind: "quiz", dismissed: true }),
    result({ kind: "quiz", correct: true }, { isError: true }),
    result({ kind: "quiz", correct: true }, { toolName: "plan_init" }),
  ]);
  assert.deepEqual(tally, { answered: 4, graded: 2, correct: 1 });
});

test("since counts only answers at or after that time", () => {
  const tally = answerTally([result({ kind: "quiz", correct: true }, { timestamp: 5 }), result({ kind: "quiz", correct: true }, { timestamp: 50 })], 10);
  assert.deepEqual(tally, { answered: 1, graded: 1, correct: 1 });
});
