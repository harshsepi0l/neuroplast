import assert from "node:assert/strict";
import test from "node:test";
import {
  coerceCorrectAnswer,
  isCorrect,
  normalizeOptions,
  normalizeQuizType,
  parseOptionsIfString,
} from "@/features/learning/core/question-core";

test("quiz type heals copy-syntax debris and rejects anything else", () => {
  assert.equal(normalizeQuizType("predict"), "predict");
  assert.equal(normalizeQuizType('"predict"'), "predict");
  assert.equal(normalizeQuizType(" :check "), "check");
  assert.equal(normalizeQuizType("explain"), undefined);
  assert.equal(normalizeQuizType(undefined), undefined);
  assert.equal(normalizeQuizType(3), undefined);
});

test("string-encoded options are parsed; anything else passes through", () => {
  assert.deepEqual(parseOptionsIfString('[{"label":"A"}]'), [{ label: "A" }]);
  assert.equal(parseOptionsIfString("not json"), "not json");
  assert.equal(parseOptionsIfString('{"label":"A"}'), '{"label":"A"}');
  const list = [{ label: "A" }];
  assert.equal(parseOptionsIfString(list), list);
});

test("options are trimmed, default their value to the label, and drop empty labels", () => {
  assert.deepEqual(
    normalizeOptions([
      { label: "  Alpha  " },
      { label: "Beta", value: " b ", description: "  second  " },
      { label: "   " },
    ]),
    [
      { label: "Alpha", value: "Alpha", description: undefined },
      { label: "Beta", value: "b", description: "second" },
    ],
  );
  assert.deepEqual(normalizeOptions('[{"label":"A"}]'), [{ label: "A", value: "A", description: undefined }]);
  assert.deepEqual(normalizeOptions(undefined), []);
});

test("duplicate option values are rejected", () => {
  assert.throws(() => normalizeOptions([{ label: "A" }, { label: "Other", value: "A" }]), /duplicate option value "A"/);
});

test("correct answers keep exact option keys and strip debris otherwise", () => {
  const options = ["parmenides", "heraclitus", "x."];
  assert.deepEqual(coerceCorrectAnswer(":parmenides", options), ["parmenides"]);
  assert.deepEqual(coerceCorrectAnswer('[":parmenides"]', options), ["parmenides"]);
  assert.deepEqual(coerceCorrectAnswer('["parmenides","heraclitus"]', options), ["parmenides", "heraclitus"]);
  assert.deepEqual(coerceCorrectAnswer(["`heraclitus`"], options), ["heraclitus"]);
  // A trailing period that is part of a real option value is content, not debris.
  assert.deepEqual(coerceCorrectAnswer("x.", options), ["x."]);
  // An option whose literal value looks like a JSON array stays intact.
  assert.deepEqual(coerceCorrectAnswer('["a"]', ['["a"]']), ['["a"]']);
});

test("grading is an exact, order-insensitive set match", () => {
  assert.equal(isCorrect([2, 0], [0, 2]), true);
  assert.equal(isCorrect([0], [0, 2]), false);
  assert.equal(isCorrect([0, 1], [0, 2]), false);
  assert.equal(isCorrect([], []), true);
});
