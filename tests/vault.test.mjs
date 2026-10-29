import assert from "node:assert/strict";
import test from "node:test";
import { learnTopic } from "@/features/knowledge/core/skill-trees";
import { challengeNote, END, fileName, GRAPH_COLOR_GROUPS, obsidianText, renderNote, START, userText, vaultNotes, withGraphColors } from "@/features/vault/core/notes";

const t = Date.parse("2026-10-29T12:00:00Z");
const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const asst = (id, content) => ({ id, role: "assistant", content, api: "openai-completions", provider: "openai", model: "gpt", usage, stopReason: "toolUse", timestamp: t });
const result = (id, toolCallId, toolName, details) => ({ id, role: "toolResult", toolCallId, toolName, content: [{ type: "text", text: "ok" }], details, isError: false, timestamp: t });
const answer = (question, picked, correct, extra = {}) => ({
	kind: "quiz", tool: "probe", questionText: question, options: [{ index: 1, label: "1/3" }, { index: 2, label: "1/2" }],
	dontKnow: false, answers: [{ label: picked, value: picked, index: 1 }], correct, correctIndices: [1], confidence: 70, answeredAt: new Date(t).toISOString(), ...extra,
});
const tree = { version: 1, nodes: [{ id: "space", title: "Sample spaces" }, { id: "cond", title: "Conditioning" }], edges: [{ from: "space", to: "cond" }] };

const messages = [
	{ id: "u1", role: "user", content: "Teach me probability\n\n[Attached PDF: Syllabus.pdf — path: /x/s.pdf — read it with the pdf tool.]", timestamp: t },
	asst("a1", [{ type: "text", text: "A game pays $10 on heads and $0 on tails." }, { type: "toolCall", id: "p1", name: "probe", arguments: { question: "A die shows an even number. What is \\(P(6)\\)?", options: [{ label: "1/3" }, { label: "1/2" }] } }]),
	result("r1", "p1", "probe", answer("A die shows an even number. What is P(6)?", "1/3", true)),
	asst("a2", [{ type: "toolCall", id: "d1", name: "probe_done", arguments: { assessment: { strands: [{ strand: "Counting outcomes", assessment: "You list single-die outcomes well." }] }, title: "Probability basics" } }]),
	result("r2", "d1", "probe_done", { ok: true }),
	{ id: "h1", role: "custom", customType: "probe-handoff", content: "handoff", display: true, details: { chatId: "chat_1" }, timestamp: t },
	asst("a3", [{ type: "text", text: "Here is your plan." }, { type: "toolCall", id: "pl", name: "plan_init", arguments: tree }]),
	result("r3", "pl", "plan_init", { tree }),
	{ id: "s1", role: "custom", customType: "stage", content: "start", display: true, details: { action: "start-learning" }, timestamp: t },
	asst("a4", [{ type: "text", text: "Sample spaces list equally likely outcomes." }, { type: "toolCall", id: "q1", name: "quiz", arguments: { question: "Two coins: P(at least one head)?", nodeId: "space", options: [{ label: "3/4" }, { label: "2/3" }] } }]),
	result("r4", "q1", "quiz", answer("Two coins: P(at least one head)?", "2/3", false, { tool: "quiz", questionType: "check" })),
];
const session = { id: "chat_1", title: "Probability basics", kind: "teach", createdAt: "2026-10-29T12:00:00Z", updatedAt: "2026-10-29T13:00:00Z", messages };

test("titles become file names Obsidian accepts", () => {
	assert.equal(fileName('Bayes: P(A|B) / "why"?'), "Bayes P(A B) why");
	assert.equal(fileName(".hidden"), "hidden");
	assert.equal(fileName("   "), "Untitled");
});

test("money stays a dollar and LaTeX delimiters become Obsidian math", () => {
	assert.equal(obsidianText("Pays $10 or $3.50."), "Pays \\$10 or \\$3.50.");
	assert.equal(obsidianText("Here \\(x^2\\) and"), "Here $x^2$ and");
	assert.equal(obsidianText("\\[\\frac{a}{b}\\]"), "$$\n\\frac{a}{b}\n$$");
	assert.equal(obsidianText("Already $x$ and \\$5"), "Already $x$ and \\$5");
});

test("a sync rewrites only the generated block and keeps the learner's notes", () => {
	const note = { key: "k", path: "Neuroplast/x.md", properties: { neuroplast: "step", order: 1 }, body: "# Old" };
	const first = renderNote(note);
	assert.ok(first.startsWith("---\nneuroplast: \"step\"\norder: 1\n---\n"));
	assert.ok(first.includes(`${START}\n# Old\n${END}`));
	const edited = `${first}My own note about this.\n`;
	const second = renderNote({ ...note, body: "# New" }, edited);
	assert.ok(second.includes("# New") && !second.includes("# Old"));
	assert.ok(second.endsWith("My own note about this.\n"));
	assert.equal(userText("---\na: 1\n---\nWritten by hand"), "Written by hand");
});

test("a session note has a section per stage, questions as callouts, and plain links", () => {
	const topic = learnTopic({ ...session, tree });
	const notes = vaultNotes({ sessions: [session], topics: [topic], challenges: [] });
	const note = notes.find((n) => n.key === "session:chat_1");
	assert.equal(note.path, "Neuroplast/Sessions/2026-10-29 Probability basics.md");
	assert.equal(note.properties.stage, "learn");
	const body = note.body;
	assert.ok(body.indexOf("## Warm-up") < body.indexOf("## Plan") && body.indexOf("## Plan") < body.indexOf("## Learn"), body);
	assert.ok(body.includes("**You:** Teach me probability") && body.includes("*Attached: Syllabus.pdf*"));
	assert.ok(body.includes("A game pays \\$10 on heads and \\$0 on tails."));
	assert.ok(body.includes("> [!success] Question 1 ✓\n> A die shows an even number. What is $P(6)$?"), body);
	assert.ok(body.includes("> [!summary] Where you stand") && body.includes("**Counting outcomes:**"));
	assert.ok(body.includes("*The plan was written: [[Neuroplast/Topics/Probability basics|Probability basics]]*"));
	assert.ok(body.includes("*→ Started learning*"));
	assert.ok(body.includes("> [!failure] Question 2 ✗"));
});

test("links follow the tree: the topic links where to start, each step what it builds on", () => {
	const topic = learnTopic({ ...session, tree });
	const notes = vaultNotes({ sessions: [session], topics: [topic], challenges: [] });
	const top = notes.find((n) => n.key === "topic:learn:chat_1");
	assert.ok(top.body.includes("```mermaid") && top.body.includes("n1 --> n2"));
	assert.ok(top.body.includes('n1["1 · Sample spaces"]'), "labels are not markdown lists");
	assert.ok(!/\["\d+\. /.test(top.body));
	assert.ok(top.body.includes("Start: [[Neuroplast/Topics/Probability basics/01 Sample spaces|Sample spaces]]"));
	assert.ok(top.body.includes("2. Conditioning:") && !top.body.includes("[[Neuroplast/Topics/Probability basics/02 Conditioning"));
	const step = notes.find((n) => n.key === "step:learn:chat_1:space");
	assert.equal(step.path, "Neuroplast/Topics/Probability basics/01 Sample spaces.md");
	assert.equal(step.properties.topic, "Probability basics");
	assert.ok(!step.body.includes("[["), "a root step links nothing");
	assert.ok(step.body.includes("## Questions on this step") && step.body.includes("Two coins: P(at least one head)?"));
	const next = notes.find((n) => n.key === "step:learn:chat_1:cond");
	assert.ok(next.body.includes("Builds on: [[Neuroplast/Topics/Probability basics/01 Sample spaces|Sample spaces]]"));
	assert.deepEqual(next.tags ?? next.properties.tags, ["neuroplast/step", "neuroplast/ahead"]);
	const home = notes.find((n) => n.key === "home");
	assert.ok(home.body.includes("[[Neuroplast/Topics/Probability basics|Probability basics]]"));
	assert.ok(home.body.includes("2026-10-29 Probability basics (in its topic)"), "a session its topic links is not linked again");
	const loose = vaultNotes({ sessions: [{ ...session, id: "chat_9", title: "Loose" }], topics: [], challenges: [] }).find((n) => n.key === "home");
	assert.ok(loose.body.includes("[[Neuroplast/Sessions/2026-10-29 Loose|2026-10-29 Loose]]"), "a session with no topic is linked from home");
});

test("graph colors go first and the learner's own groups stay", () => {
	const merged = withGraphColors({ scale: 1.2, colorGroups: [{ query: "path:Daily", color: { a: 1, rgb: 1 } }, { query: "tag:#neuroplast/old", color: { a: 1, rgb: 2 } }] });
	assert.equal(merged.scale, 1.2);
	assert.equal(merged.colorGroups.length, GRAPH_COLOR_GROUPS.length + 1);
	assert.equal(merged.colorGroups[0].query, "tag:#neuroplast/learning");
	assert.equal(merged.colorGroups.at(-1).query, "path:Daily");
	assert.equal(withGraphColors({}).colorGroups.length, GRAPH_COLOR_GROUPS.length);
});

test("a challenge hides answers until submitted, then shows the score and misses", () => {
	const base = {
		id: "challenge_0f1e2d3c-0000-4000-8000-000000000000", title: "Linear equations", createdAt: "2026-10-30T09:00:00Z",
		skills: [{ id: "s1", name: "Inverse operations" }], questions: [{ id: "q1", skillId: "s1", prompt: "Solve 2x = 6" }], responses: { q1: "4" },
	};
	const open = challengeNote({ ...base, result: null }, {});
	assert.ok(open.body.includes("In progress: 1 of 1 answered"));
	assert.ok(!open.body.includes("**Answer:**"));
	assert.equal(open.path, "Neuroplast/Challenges/2026-10-30 Linear equations 0f1e2d.md");
	const result = { points: 0, correct: 0, total: 1, goalMet: false, bySkill: [{ skillId: "s1", name: "Inverse operations", correct: 0, total: 1 }], byMode: [], items: [{ questionId: "q1", skillId: "s1", mode: "recall", correct: false, response: "4", answer: "3", explanation: "Divide both sides by 2." }] };
	const done = challengeNote({ ...base, submittedAt: "2026-10-30T09:10:00Z", result }, {});
	assert.equal(done.properties.score, 0);
	assert.ok(done.body.includes("**Score: 0/100**") && done.body.includes("| Inverse operations | 0/1 |"));
	assert.ok(done.body.includes("> **Answer:** 3") && done.body.includes("> Divide both sides by 2."));
});

test("two records with the same name on the same day get distinct notes", () => {
	const twin = { ...session, id: "chat_2" };
	const notes = vaultNotes({ sessions: [session, twin], topics: [], challenges: [] });
	const paths = notes.filter((n) => n.properties.neuroplast === "session").map((n) => n.path);
	assert.deepEqual(paths, ["Neuroplast/Sessions/2026-10-29 Probability basics.md", "Neuroplast/Sessions/2026-10-29 Probability basics (2).md"]);
});

test("a challenge chains to its session; one without a session to its topic; home links neither", () => {
	const topic = learnTopic({ ...session, tree });
	const base = { title: "Probability basics", skills: [], questions: [], responses: {}, result: null };
	const first = { ...base, id: "challenge_aaaaaaaa-0000-4000-8000-000000000000", createdAt: "2026-10-30T09:00:00Z", sessionId: "chat_1" };
	const retake = { ...base, id: "challenge_bbbbbbbb-0000-4000-8000-000000000000", createdAt: "2026-10-31T09:00:00Z", sessionId: "chat_1", previousId: first.id };
	const notes = vaultNotes({ sessions: [session], topics: [topic], challenges: [retake, first] });
	const byKey = (k) => notes.find((n) => n.key === k);
	assert.ok(byKey("session:chat_1").body.includes("Challenge: [[Neuroplast/Challenges/2026-10-31 Probability basics bbbbbb|"), "the session links its newest challenge");
	assert.ok(!byKey("topic:learn:chat_1").body.includes("Neuroplast/Challenges/"), "the topic does not");
	const r = byKey(`challenge:${retake.id}`).body;
	assert.ok(r.includes("Session: [[Neuroplast/Sessions/2026-10-29 Probability basics|") && r.includes("Retake of [[Neuroplast/Challenges/2026-10-30 Probability basics aaaaaa|"));
	assert.ok(!r.includes("Skill tree:"));
	const home = byKey("home").body;
	assert.ok(!home.includes("[[Neuroplast/Challenges/"), "home links no challenge");

	const chapter = { key: "challenge:linear", kind: "challenge", title: "Linear equations", statusLine: "", nodes: [], edges: [], branching: false, challengeId: "challenge_cccccccc-0000-4000-8000-000000000000" };
	const solo = { ...base, title: "Linear equations", id: chapter.challengeId, createdAt: "2026-10-30T09:00:00Z" };
	const notes2 = vaultNotes({ sessions: [], topics: [chapter], challenges: [solo] });
	assert.ok(notes2.find((n) => n.key === "topic:challenge:linear").body.includes("Challenge: [[Neuroplast/Challenges/2026-10-30 Linear equations cccccc|"));
	assert.ok(notes2.find((n) => n.key === `challenge:${solo.id}`).body.includes("Skill tree: [[Neuroplast/Topics/Linear equations|"));
});
