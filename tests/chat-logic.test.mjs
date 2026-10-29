import assert from "node:assert/strict";
import test from "node:test";
import { ProviderKeyMissingError } from "@/features/settings/core/settings";
import {
  escAbortTarget,
  initialPromptOwed,
  parseModelsRefusal,
  parseProviderKeyRefusal,
} from "@/features/learning/ui/session/chat-logic";

const idle = { abortAsk: false, mermaidFocus: false, planOpen: false, setupOpen: false, pending: false, problem: false, busy: false };

test("Esc closes the topmost layer first", () => {
  assert.equal(escAbortTarget(idle), null);
  assert.equal(escAbortTarget({ ...idle, busy: true }), "turn");
  assert.equal(escAbortTarget({ ...idle, busy: true, problem: true }), "problem");
  assert.equal(escAbortTarget({ ...idle, busy: true, pending: true }), "question");
  assert.equal(escAbortTarget({ ...idle, pending: true, setupOpen: true }), "setup");
  assert.equal(escAbortTarget({ ...idle, pending: true, planOpen: true }), "plan");
  assert.equal(escAbortTarget({ ...idle, planOpen: true, mermaidFocus: true }), "mermaid");
  // The abort confirm handles its own Esc.
  assert.equal(escAbortTarget({ ...idle, abortAsk: true, mermaidFocus: true, busy: true }), null);
});

test("the opening prompt is owed until a real user or assistant message exists", () => {
  assert.equal(initialPromptOwed([], "topic"), true);
  assert.equal(initialPromptOwed([{ role: "custom" }], "topic"), true);
  assert.equal(initialPromptOwed([{ role: "custom" }, { role: "user" }], "topic"), false);
  assert.equal(initialPromptOwed([], undefined), false);
});

test("models-not-configured refusals are read from the transport error text", () => {
  assert.deepEqual(parseModelsRefusal(JSON.stringify({ code: "models_not_configured", missing: ["conversation"] })), ["conversation"]);
  assert.equal(parseModelsRefusal(JSON.stringify({ code: "models_not_configured", missing: [1] })), null);
  assert.equal(parseModelsRefusal("Internal Server Error"), null);
  assert.equal(parseModelsRefusal(undefined), null);
});

test("provider-key refusals match only the real envelope", () => {
  const envelope = new ProviderKeyMissingError("anthropic", ["conversation"]).envelope;
  assert.equal(parseProviderKeyRefusal(JSON.stringify(envelope)), true);
  assert.equal(parseProviderKeyRefusal(JSON.stringify({ ...envelope, error: "something else" })), false);
  assert.equal(parseProviderKeyRefusal("provider_key_missing"), false);
});


test("a re-sent message shows once; different messages both show", async () => {
  const { repeatedUserMessage } = await import("@/features/learning/ui/session/chat-logic");
  const u = (text) => ({ role: "user", parts: [{ type: "text", text }] });
  const msgs = [u("bayes"), u("bayes"), { role: "assistant", parts: [] }, u("bayes"), u("other")];
  assert.deepEqual(msgs.map((_, i) => repeatedUserMessage(msgs, i)), [false, true, false, false, false]);
});

test("the warm-up counts answered probe questions and right answers", async () => {
  const { warmupSummary, workingLabel, lastPartIsReasoning } = await import("@/features/learning/ui/session/chat-logic");
  const w = warmupSummary([{ role: "assistant", parts: [
    { type: "tool-probe", toolCallId: "a", state: "output-available", output: { correct: true } },
    { type: "tool-recall", toolCallId: "b", state: "output-available", output: {} },
    { type: "tool-probe", toolCallId: "c", state: "input-available" },
    { type: "tool-quiz", toolCallId: "d", state: "output-available", output: { correct: true } },
  ] }]);
  assert.deepEqual([w.first, w.answered, w.correct, [...w.ids]], ["a", 2, 1, ["a", "b"]]);
  assert.equal(workingLabel("probe", "teach"), "Picking your next question…");
  assert.equal(workingLabel("teach", "teach"), "Writing the next step…");
  assert.equal(lastPartIsReasoning([{ role: "assistant", parts: [{ type: "text" }, { type: "reasoning" }] }]), true);
});

test("leaked question-tool JSON is removed from lesson text; other JSON stays", async () => {
  const { stripLeakedToolArgs } = await import("@/features/learning/ui/session/chat-logic");
  const leaked = '{ "type": "predict", "question": "Sick or false positive?", "options": [ { "label": "Sick" } ], "correctAnswer": "false" }';
  assert.equal(stripLeakedToolArgs(`Before.\n\n${leaked}\n\nAfter.`), "Before.\n\nAfter.");
  assert.equal(stripLeakedToolArgs('Data: {"a": 1}'), 'Data: {"a": 1}');
  assert.equal(stripLeakedToolArgs('{"a": 1}'), '{"a": 1}');
});
