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
