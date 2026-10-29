import assert from "node:assert/strict";
import test from "node:test";
import { phaseTimeline } from "@/features/learning/core/phases";
import { currentStage, messageStages, stageLoading } from "@/features/learning/core/stage-sections";

const user = (text = "hi") => ({ role: "user", parts: [{ type: "text", text }] });
const probe = () => ({ role: "assistant", parts: [{ type: "tool-probe", state: "output-available", input: {}, output: {} }] });
const probeDone = () => ({ role: "assistant", parts: [{ type: "tool-probe_done", state: "output-available", input: {}, output: {} }, { type: "text", text: "Probe is done." }] });
const plan = () => ({ role: "assistant", parts: [{ type: "tool-plan_init", state: "output-available", input: {}, output: { tree: { nodes: [1, 2] } } }] });
const start = () => ({ role: "user", parts: [{ type: "data-stage", data: { action: "start-learning" } }] });
const lessonText = () => ({ role: "assistant", parts: [{ type: "text", text: "Conditioning means…" }] });
const quiz = () => ({ role: "assistant", parts: [{ type: "tool-quiz", state: "input-available", input: { nodeId: "n1" } }] });

function view(messages) {
	const phases = phaseTimeline(messages);
	const stages = messageStages(messages, phases);
	const current = currentStage(stages, phases.at(-1) ?? "probe");
	return { stages, current, loading: stageLoading(messages, stages, current) };
}

test("each message lands in the stage it began in", () => {
	const { stages } = view([user(), probe(), probeDone(), plan(), start(), lessonText(), quiz()]);
	assert.deepEqual(stages, ["warmup", "warmup", "warmup", "plan", "learn", "learn", "learn"]);
});

test("a lesson question opens Learn even without Start learning", () => {
	const { stages, current } = view([user(), probeDone(), plan(), user("go"), quiz()]);
	assert.deepEqual(stages, ["warmup", "warmup", "plan", "plan", "learn"]);
	assert.equal(current, "learn");
});

test("the first start shows the warm-up loading screen until the tutor speaks", () => {
	assert.deepEqual(view([user()]), { stages: ["warmup"], current: "warmup", loading: "warmup" });
	assert.equal(view([user(), probe()]).loading, null);
	assert.equal(view([]).loading, null);
});

test("between the warm-up and the written plan the Plan section is loading", () => {
	const waiting = view([user(), probe(), probeDone()]);
	assert.equal(waiting.current, "plan");
	assert.equal(waiting.loading, "plan");
	assert.equal(view([user(), probeDone(), plan()]).loading, null);
});

test("after Start learning the lesson is loading until the tutor speaks", () => {
	const started = view([user(), probeDone(), plan(), start()]);
	assert.equal(started.current, "learn");
	assert.equal(started.loading, "learn");
	assert.equal(view([user(), probeDone(), plan(), start(), lessonText()]).loading, null);
});
