import assert from "node:assert/strict";
import test from "node:test";
import { SKILLS, challengeQuestions, grade, publicQuestion, trainingQuestion } from "../src/domains/challenges/domain/linear-equations.ts";

function evaluate(expression, x) {
  const compact = expression.replaceAll("−", "-").replaceAll(" ", "");
  const grouped = compact.match(/^(\d+)\(x([+-]\d+)\)$/);
  if (grouped) return Number(grouped[1]) * (x + Number(grouped[2]));
  const linear = compact.match(/^(\d*)x([+-]\d+)?$/);
  if (linear) return Number(linear[1] || 1) * x + Number(linear[2] || 0);
  return Number(compact);
}

test("challenge forms keep answer keys private and algebraically correct", () => {
  for (let seed = 1; seed <= 250; seed++) {
    const questions = challengeQuestions(seed);
    assert.equal(questions.length, 10);
    assert.equal(new Set(questions.map(question => question.id)).size, 10);
    assert.equal(questions.filter(question => question.mode === "recall").length, 4);
    for (const question of questions) {
      const publicView = publicQuestion(question);
      assert.equal("answer" in publicView, false);
      assert.equal("explanation" in publicView, false);
      assert.equal(grade(question, question.answer), true);
      if (question.mode === "recall") {
        assert.equal(question.responseKind, "integer");
        assert.equal(question.options, undefined);
      } else {
        const equation = question.prompt.match(/\*\*(.*?)\*\*/)?.[1];
        assert.ok(equation);
        const [left, right] = equation.split(" = ");
        const x = Number(question.answer);
        assert.equal(evaluate(left, x), evaluate(right, x), equation);
        assert.notEqual(evaluate(left, x + 1), evaluate(right, x + 1), equation);
      }
    }
  }
});

test("training uses free recall, method discrimination, application, and delayed recall", () => {
  for (const skill of SKILLS) {
    for (const stage of ["recall", "discrimination", "application", "delayed-recall"]) {
      const question = trainingQuestion(skill.id, stage, 42, `${skill.id}-${stage}`);
      assert.equal(question.stage, stage);
      assert.equal(grade(question, question.answer), true);
      assert.equal(grade(question, "not an answer"), false);
      if (stage === "discrimination") {
        assert.equal(question.responseKind, "choice");
        assert.ok(question.options.some(option => option.value === question.answer));
      } else if (stage === "recall" || stage === "delayed-recall") {
        assert.equal(question.responseKind, "integer");
        assert.equal(question.options, undefined);
      }
    }
  }
});
