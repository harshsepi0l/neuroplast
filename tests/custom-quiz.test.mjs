import assert from "node:assert/strict";
import test from "node:test";
import { parseCustomForm, sessionChallengeRequest } from "../src/features/challenges/core/custom-quiz.ts";
import { grade, publicQuestion } from "../src/features/challenges/core/linear-equations.ts";

function form() {
  const skills = Array.from({ length: 4 }, (_, index) => ({ name: `Skill ${index + 1}`, description: `Understand concept ${index + 1} in this subject.` }));
  const textItem = (skillIndex, label) => ({ skillIndex, prompt: `Which short term identifies ${label} in this topic?`, answer: `Term ${skillIndex + 1}`, acceptedAnswers: [`Alias ${skillIndex + 1}`], explanation: `The correct term is Term ${skillIndex + 1} because it matches ${label}.` });
  const choiceItem = (skillIndex, label) => ({ skillIndex, prompt: `Which option applies ${label} correctly in this topic?`, options: ["First", "Second", "Third", "Fourth"], answer: "Second", explanation: `Second applies ${label} correctly because of the stated rule.` });
  const questions = skills.flatMap((_, index) => [
    { ...textItem(index, `boss recall ${index}`), mode: "recall" },
    { ...choiceItem(index, `boss application ${index}`), mode: "application" },
  ]);
  questions.push({ ...choiceItem(2, "extra boss application 2"), mode: "application" }, { ...choiceItem(3, "extra boss application 3"), mode: "application" });
  const practice = skills.flatMap((_, index) => [
    { ...textItem(index, `practice recall ${index}`), stage: "recall" },
    { ...choiceItem(index, `practice discrimination ${index}`), stage: "discrimination" },
    { ...choiceItem(index, `practice application ${index}`), stage: "application" },
    { ...textItem(index, `practice delayed recall ${index}`), stage: "delayed-recall" },
  ]);
  return { title: "A custom science topic", description: "Four concepts in a learner-selected science subject.", skills, questions, practice };
}

test("custom quiz forms support typed recall, scored choices, and four training stages", () => {
  const result = parseCustomForm(form(), "topic_custom");
  assert.equal(result.topic.id, "topic_custom");
  assert.equal(result.questions.length, 10);
  assert.equal(result.practice.length, 16);
  assert.equal(result.skills.length, 4);
  const recall = result.questions[0];
  assert.equal(recall.responseKind, "text");
  assert.equal(grade(recall, " alias 1. "), true);
  assert.equal(grade(recall, "wrong"), false);
  assert.equal("answer" in publicQuestion(recall), false);
  assert.equal("acceptedAnswers" in publicQuestion(recall), false);
  const choice = result.questions[1];
  assert.equal(choice.responseKind, "choice");
  assert.equal(grade(choice, "Second"), true);
  assert.equal(grade(choice, "First"), false);
  for (const skill of result.skills) assert.deepEqual(result.practice.filter(item => item.skillId === skill.id).map(item => item.stage), ["recall", "discrimination", "application", "delayed-recall"]);
});

test("custom quiz validation rejects ungradeable choices and duplicate prompts", () => {
  const invalidChoice = form();
  invalidChoice.questions[1].answer = "missing";
  assert.throws(() => parseCustomForm(invalidChoice, "topic_custom"), /Choice questions/);
  const duplicate = form();
  duplicate.practice[0].prompt = duplicate.questions[0].prompt;
  assert.throws(() => parseCustomForm(duplicate, "topic_custom"), /repeats a question/);
});

test("a session challenge request names the topic and the plan, within 500 characters", () => {
  assert.equal(sessionChallengeRequest("Two-step equations", ["Undo in order", "Inverse operations"]),
    "Test me on Two-step equations. It covered: Undo in order; Inverse operations.");
  assert.equal(sessionChallengeRequest("Bayes", []), "Test me on Bayes.");
  const long = sessionChallengeRequest("Topic", Array.from({ length: 40 }, (_, i) => `A fairly long plan step number ${i}`));
  assert.ok(long.length <= 500);
  assert.ok(long.endsWith("."));
});
