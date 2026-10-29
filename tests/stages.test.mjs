import assert from "node:assert/strict";
import test from "node:test";
import { MIN_WARMUP_QUESTIONS, planAwaitingStart, warmupBlocker, warmupProgress } from "@/features/learning/core/stages";
import { ChatInputError, inputAppends, parseChatInput } from "@/features/learning/core/input-events";
import { newStageMessage } from "@/features/learning/core/native-messages";
import { attachmentKind, splitAttachments, withAttachments } from "@/features/learning/core/attachments";
import { compactAnswerForModel } from "@/features/learning/core/question-core";

let n = 0;
const call = (name, args = {}) => ({ id: `a${++n}`, role: "assistant", content: [{ type: "toolCall", id: `c${n}`, name, arguments: args }] });
const result = (toolName, details, callId = `c${n}`) => ({ id: `r${++n}`, role: "toolResult", toolCallId: callId, toolName, isError: false, details, content: [] });
const answered = (tool) => [call(tool), result(tool, { kind: tool === "ask_user_question" ? "ask" : "quiz", answers: [], dontKnow: false })];
const user = (text) => ({ id: `u${++n}`, role: "user", content: [{ type: "text", text }] });
const planned = () => [call("plan_init", { mermaid: "graph TD\n a[A]" }), result("plan_init", { ok: true, tree: { nodes: [{ id: "a" }] } })];

test("the warm-up cannot end after three questions and no goal", () => {
  const messages = [user("teach me bayes"), ...answered("probe"), ...answered("probe"), ...answered("probe")];
  const blocker = warmupBlocker(messages);
  assert.match(blocker, /goal is not pinned down/);
  assert.match(blocker, /only 3 knowledge questions/);
});

test("the warm-up may end once the goal and enough questions are answered", () => {
  const messages = [user("x"), ...answered("ask_user_question")];
  for (let i = 0; i < MIN_WARMUP_QUESTIONS; i++) messages.push(...answered("probe"));
  assert.equal(warmupBlocker(messages), null);
});

test("dismissed questions do not count toward the warm-up", () => {
  const messages = [user("x"), call("ask_user_question"), result("ask_user_question", { kind: "ask", dismissed: true })];
  assert.equal(warmupProgress(messages).goalAnswered, false);
});

test("skipping lets the warm-up end at once", () => {
  assert.equal(warmupBlocker([user("x"), { ...newStageMessage("skip-warmup"), id: "s1" }]), null);
});

test("a fresh plan waits for the learner", () => {
  assert.equal(planAwaitingStart([user("x"), ...planned()], true), true);
});

test("a plan written in the running turn waits too", () => {
  assert.equal(planAwaitingStart([user("x")], true), true);
  assert.equal(planAwaitingStart([user("x")], false), false);
});

test("Start learning, a reply, or an answered ask opens the plan", () => {
  assert.equal(planAwaitingStart([...planned(), { ...newStageMessage("start-learning"), id: "s2" }], true), false);
  assert.equal(planAwaitingStart([...planned(), user("add more on priors")], true), false);
  assert.equal(planAwaitingStart([...planned(), ...answered("ask_user_question")], true), false);
});

test("a re-plan mid-lesson never re-gates", () => {
  const messages = [...planned(), user("go"), call("quiz", { nodeId: "a" }), ...planned()];
  assert.equal(planAwaitingStart(messages, true), false);
});

test("stage inputs parse and validate against the record", () => {
  assert.deepEqual(parseChatInput({ type: "stage", action: "skip-warmup" }), { type: "stage", action: "skip-warmup" });
  assert.throws(() => parseChatInput({ type: "stage", action: "nope" }), ChatInputError);
  const warmup = { messages: [user("x"), ...answered("probe")], kind: "teach" };
  const [marker] = inputAppends(warmup, { type: "stage", action: "skip-warmup" });
  assert.equal(marker.customType, "stage");
  assert.throws(() => inputAppends(warmup, { type: "stage", action: "start-learning" }), /no plan waiting/);
  assert.throws(() => inputAppends({ ...warmup, kind: "practice" }, { type: "stage", action: "skip-warmup" }), /Learn-session/);
  const done = { messages: [user("x"), call("probe_done"), result("probe_done", { ok: true }), ...planned()], kind: "teach", tree: { nodes: [{ id: "a" }] } };
  assert.throws(() => inputAppends(done, { type: "stage", action: "skip-warmup" }), /already over/);
  assert.equal(inputAppends(done, { type: "stage", action: "start-learning" })[0].details.action, "start-learning");
});

test("attachments ride the message as path lines and fold back out", () => {
  const files = [{ name: "syllabus.pdf", kind: "pdf", path: "/m/uploads/syllabus-1a2b3c.pdf" }, { name: "notes.md", kind: "text", path: "/m/uploads/notes.md" }];
  const message = withAttachments("here is my syllabus", files);
  assert.match(message, /read it with the pdf tool/);
  assert.deepEqual(splitAttachments(message), { text: "here is my syllabus", files: [{ name: "syllabus.pdf", kind: "pdf" }, { name: "notes.md", kind: "text" }] });
  assert.equal(attachmentKind("Week 1.PDF"), "pdf");
  assert.equal(attachmentKind("slides.pptx"), null);
});

test("files attached to an answer reach the tutor", () => {
  const out = compactAnswerForModel({ kind: "ask", answers: [], dontKnow: false, questionText: "q", answeredAt: "t", files: ["[Attached PDF: s.pdf — path: /x — read it with the pdf tool.]"] });
  assert.deepEqual(out.attached, ["[Attached PDF: s.pdf — path: /x — read it with the pdf tool.]"]);
});

test("a lesson question the plan gate refused does not start teaching", async () => {
  const { phaseAt3Lh } = await import("@/features/learning/core/phases");
  const done = [user("x"), call("probe_done"), result("probe_done", { ok: true })];
  const refusedQuiz = call("quiz", { nodeId: "a" });
  const refusal = { id: `r${++n}`, role: "toolResult", toolCallId: refusedQuiz.content[0].id, toolName: "quiz", isError: true, content: [] };
  const messages = [...done, ...planned(), refusedQuiz, refusal];
  assert.equal(planAwaitingStart(messages, true), true);
  assert.equal(phaseAt3Lh(messages), "plan");
  assert.equal(phaseAt3Lh([...messages, call("quiz", { nodeId: "a" })]), "teach");
});

test("the warm-up → plan handoff is never background work", async () => {
  const { lessonHandoffOnly } = await import("@/features/learning/core/stages");
  const handoff = { id: "h", role: "custom", customType: "probe-handoff", content: "", display: false, details: {}, timestamp: 0 };
  const jobResult = { ...handoff, id: "j", customType: "subagent-steer" };
  assert.equal(lessonHandoffOnly([handoff]), true);
  assert.equal(lessonHandoffOnly([handoff, jobResult]), false);
  assert.equal(lessonHandoffOnly([]), false);
});

test("Grok background use is on unless turned off", async () => {
  const { connectionView, emptyConnection } = await import("@/features/connections/core/connection");
  assert.equal(connectionView(emptyConnection("o"), true).allowBackgroundUse, true);
  assert.equal(connectionView({ ...emptyConnection("o"), allowBackgroundUse: false }, true).allowBackgroundUse, false);
});

test("read and grep refuse PDFs and binary files with a pointer to the pdf tool", async () => {
  const { notTextReason } = await import("@/features/learning/server/agent/tools/fs-shared");
  assert.match(notTextReason("/m/uploads/syllabus.pdf", Buffer.from("%PDF-1.7 ...")), /pdf tool \(path: \/m\/uploads\/syllabus.pdf\)/);
  assert.match(notTextReason("/m/x.bin", Buffer.from([1, 0, 2])), /binary/);
  assert.equal(notTextReason("/m/notes.md", Buffer.from("# Week 1")), null);
});

test("one-line question rows read LaTeX as plain text", async () => {
  const { plainLine } = await import("@/features/learning/core/answer-summary");
  assert.equal(plainLine("By definition, \\(P(A \\mid B)\\) equals?"), "By definition, P(A | B) equals?");
  assert.equal(plainLine("What is \\(P(\\text{even})\\)?"), "What is P(even)?");
  assert.equal(plainLine("$\\frac{1}{3}$ and **bold**"), "1/3 and bold");
});

test("skipped warm-up questions fold but do not count as answered", async () => {
  const { warmupSummary } = await import("@/features/learning/ui/session/chat-logic");
  const w = warmupSummary([{ role: "assistant", parts: [
    { type: "tool-probe", toolCallId: "a", state: "output-available", output: { correct: false } },
    { type: "tool-probe", toolCallId: "b", state: "output-available", output: { dismissed: true } },
  ] }]);
  assert.deepEqual([w.answered, [...w.ids]], [1, ["a", "b"]]);
});

test("a refused lesson question does not mark its plan step current", async () => {
  const { derivePlanStatusesLh } = await import("@/features/learning/core/plan");
  const tree = { nodes: [{ id: "a", title: "A" }, { id: "b", title: "B" }], edges: [] };
  const refusedQuiz = call("quiz", { nodeId: "b" });
  const refusal = { id: `r${++n}`, role: "toolResult", toolCallId: refusedQuiz.content[0].id, toolName: "quiz", isError: true, content: [] };
  assert.equal(derivePlanStatusesLh(tree, [refusedQuiz, refusal]).current, null);
  assert.equal(derivePlanStatusesLh(tree, [refusedQuiz, refusal, call("quiz", { nodeId: "a" })]).current, "a");
});
