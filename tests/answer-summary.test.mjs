import assert from "node:assert/strict";
import test from "node:test";
import { answerLabel, answerSummary, answerVerdict, confidenceWord, questionNumbers } from "@/features/learning/core/answer-summary";

const quiz = (over = {}) => ({
  kind: "quiz", tool: "quiz", questionType: "check", questionText: "Solve 5 − 2x = 17.",
  options: [{ index: 1, label: "x = 11" }, { index: 2, label: "x = −6" }, { index: 3, label: "x = 6" }],
  dontKnow: false, answers: [{ label: "x = −6", value: "x = −6", index: 2 }], correct: true, correctIndices: [2],
  confidence: 70, answeredAt: "2026-10-29T00:00:00Z", ...over,
});

test("a correct quiz answer summarizes as the pick and the confidence word", () => {
  assert.equal(answerSummary(quiz()), "x = −6 · fairly sure");
  assert.equal(answerVerdict(quiz()), "correct");
});

test("a missed quiz answer names the right answer", () => {
  const missed = quiz({ answers: [{ label: "x = 6", value: "x = 6", index: 3 }], correct: false, confidence: 90 });
  assert.equal(answerSummary(missed), "x = 6 · answer: x = −6 · certain");
  assert.equal(answerVerdict(missed), "incorrect");
});

test("don't-know and skipped answers read as such", () => {
  assert.equal(answerSummary(quiz({ dontKnow: true, answers: [], confidence: undefined })), "Didn't know");
  assert.equal(answerVerdict(quiz({ dontKnow: true })), "unknown");
  assert.equal(answerSummary(quiz({ dismissed: true })), "Skipped");
});

test("ask and explain answers show their text, truncated", () => {
  const ask = { kind: "ask", questionText: "Pick", dontKnow: false, answers: [], other: "my own", answeredAt: "" };
  assert.equal(answerSummary(ask), "my own");
  assert.equal(answerVerdict(ask), null);
  const explain = { kind: "explain", questionText: "Explain", dontKnow: false, answers: [], text: "a".repeat(200), answeredAt: "" };
  assert.equal(answerSummary(explain, 10), "aaaaaaaaa…");
});

test("every question carries one label; skipped ones get no verdict", () => {
  assert.equal(answerLabel(quiz({ tool: "probe" })), "Question");
  assert.equal(answerLabel(quiz({ questionType: "predict" })), "Question");
  assert.equal(answerLabel({ kind: "ask", questionText: "q", dontKnow: false, answers: [], answeredAt: "" }), "Question");
  assert.equal(answerVerdict(quiz({ dismissed: true })), null);
  assert.equal(confidenceWord(30), "guessing");
  assert.equal(confidenceWord(50), "unsure");
  assert.equal(confidenceWord(100), "certain");
});

test("questions are numbered in the order they were asked, skipping retried errors", () => {
  const numbers = questionNumbers([
    { parts: [{ type: "text" }, { type: "tool-plan_init", toolCallId: "p" }, { type: "tool-probe", toolCallId: "a", state: "output-available" }] },
    { parts: [{ type: "tool-quiz", toolCallId: "bad", state: "output-error" }, { type: "tool-quiz", toolCallId: "b", state: "output-available" }] },
    { parts: [{ type: "tool-explain", toolCallId: "c", state: "input-available" }] },
  ]);
  assert.deepEqual([...numbers], [["a", 1], ["b", 2], ["c", 3]]);
});
