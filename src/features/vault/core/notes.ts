import type { NeuroplastMessage } from "@/features/learning/core/native-messages";
import type { QuestionAnswerData } from "@/features/learning/core/question-core";
import type { SkillTreeNode, SkillTreeTopic } from "@/features/knowledge/core/skill-trees";
import type { ChallengeResult } from "@/features/challenges/core/contracts";
import { projectView } from "@/features/learning/core/view";
import { phaseTimeline } from "@/features/learning/core/phases";
import { currentStage, messageStages, type SessionStage } from "@/features/learning/core/stage-sections";
import { answerSummary, answerVerdict, questionNumbers } from "@/features/learning/core/answer-summary";
import { QUESTION_TOOLS } from "@/features/learning/core/pending";
import { splitAttachments } from "@/features/learning/core/attachments";
import { isSubagentFailure, type JobKind } from "@/features/artifacts/core/jobs";

/**
 * The Obsidian vault: Neuroplast's records as Markdown notes. Pure: records
 * in, notes out (vault-relative path, properties, body). The server writes
 * them under <vault>/Neuroplast and keeps whatever the learner wrote below
 * each note's generated block.
 */

export const ROOT = "Neuroplast";

export type Properties = Record<string, string | number | boolean | string[] | Record<string, number> | undefined>;

export interface Note {
	/** Stable identity across renames: "session:<id>", "topic:<key>", … */
	key: string;
	/** Vault-relative, e.g. "Neuroplast/Sessions/2026-10-29 Bayes.md". */
	path: string;
	properties: Properties;
	body: string;
}

export interface VaultSession {
	id: string;
	title: string;
	kind: "teach" | "practice";
	createdAt: string;
	updatedAt: string;
	messages: readonly NeuroplastMessage[];
}

export interface VaultChallenge {
	id: string;
	title: string;
	createdAt: string;
	submittedAt?: string;
	sessionId?: string;
	previousId?: string;
	skills: readonly { id: string; name: string }[];
	questions: readonly { id: string; skillId: string; prompt: string }[];
	responses: Record<string, string>;
	/** Present once submitted: the answer key stays hidden until then. */
	result: ChallengeResult | null;
}

export interface VaultInput {
	sessions: readonly VaultSession[];
	topics: readonly SkillTreeTopic[];
	challenges: readonly VaultChallenge[];
}

// ─── names and links ─────────────────────────────────────────────────────────

/** A title as a file name Obsidian accepts: no []#^|\/:*?"<> and no
 *  leading dot, at most 80 characters. */
export function fileName(title: string): string {
	const clean = title.replace(/[[\]#^|\\/:*?"<>]/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
	return (clean.length > 80 ? clean.slice(0, 80).trimEnd() : clean) || "Untitled";
}

/** A wikilink to a note by its full path (unambiguous), shown as `label`. */
export function link(path: string, label: string): string {
	return `[[${path.replace(/\.md$/, "")}|${label.replace(/[|\]]/g, " ")}]]`;
}

const day = (iso: string) => iso.slice(0, 10);

// ─── text ────────────────────────────────────────────────────────────────────

const MONEY = /(?<![\\$])\$(?=\d[\d,]*(?:\.\d+)?(?:[kKMB]|bn)?(?:$|[\s.,;:!?)\]'"—–-]))/g;

/** Tutor text for Obsidian: money keeps a literal dollar (so "$10 … $0" is
 *  not read as math), and \( \) / \[ \] math becomes $ / $$. */
export function obsidianText(text: string): string {
	return text
		.replace(MONEY, "\\$")
		.replace(/\\\[([\s\S]+?)\\\]/g, (_m, math: string) => `\n$$\n${math.trim()}\n$$\n`)
		.replace(/\\\((.+?)\\\)/g, (_m, math: string) => `$${math.trim()}$`)
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** Every line of `text` inside a callout. */
function quoted(text: string): string {
	return text.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n");
}

// ─── properties and the generated block ──────────────────────────────────────

function yamlValue(value: NonNullable<Properties[string]>): string {
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) return value.length ? `\n${value.map((v) => `  - ${JSON.stringify(v)}`).join("\n")}` : "[]";
	return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(", ")} }`;
}

export function frontmatter(properties: Properties): string {
	const lines = Object.entries(properties)
		.filter((entry): entry is [string, NonNullable<Properties[string]>] => entry[1] !== undefined)
		.map(([key, value]) => `${key}: ${yamlValue(value)}`);
	return `---\n${lines.join("\n")}\n---\n`;
}

export const START = "%% neuroplast:start (rewritten on every sync; write your own notes below the end marker) %%";
export const END = "%% neuroplast:end %%";
const START_RE = /^%% neuroplast:start.*%%$/m;

/** What the learner wrote in an existing note: everything after the end
 *  marker, or the whole body when the markers are gone. */
export function userText(existing: string): string {
	const end = existing.indexOf(END);
	if (end !== -1 && START_RE.test(existing)) return existing.slice(end + END.length).replace(/^\n/, "");
	return existing.replace(/^---\n[\s\S]*?\n---\n/, "");
}

/** The file's full text: properties, the generated block, then the
 *  learner's own text from the existing file (if any), untouched. */
export function renderNote(note: Note, existing?: string): string {
	const mine = existing === undefined ? "" : userText(existing);
	return `${frontmatter(note.properties)}${START}\n${note.body.trim()}\n${END}\n${mine || "\n"}`;
}

// ─── sessions ────────────────────────────────────────────────────────────────

const STAGE_HEADING: Record<SessionStage, string> = { warmup: "Warm-up", plan: "Plan", learn: "Learn" };
const STAGE_PROPERTY: Record<SessionStage, string> = { warmup: "warm-up", plan: "plan", learn: "learn" };
const STAGE_LINE: Record<string, string> = { "skip-warmup": "Skipped to the plan", "start-learning": "Started learning" };
const JOB_LABEL: Record<string, string> = { research: "Research", pdf: "PDF reading", demo: "Demo", visual: "Figure" };

type Part = { type: string; text?: string; state?: string; toolCallId?: string; input?: unknown; output?: unknown; data?: unknown };

/** One answered question as a callout. */
export function questionCallout(number: number | undefined, input: unknown, answer: QuestionAnswerData): string {
	const question = ((input as { question?: string } | null)?.question ?? answer.questionText ?? "").trim();
	const verdict = answerVerdict(answer);
	const mark = verdict === "correct" ? " ✓" : verdict === "incorrect" ? " ✗" : "";
	const type = verdict === "correct" ? "success" : verdict === "incorrect" ? "failure" : "question";
	const lines = [`[!${type}] Question${number ? ` ${number}` : ""}${mark}`, obsidianText(question), "", `**Your answer:** ${obsidianText(answerSummary(answer, 400))}`];
	const thinking = (answer.thinking ?? answer.note ?? "").trim();
	if (thinking) lines.push(`**Your reasoning:** ${obsidianText(thinking)}`);
	return quoted(lines.join("\n"));
}

function assessmentCallout(input: unknown): string | null {
	const a = (input as { assessment?: { strands?: { strand: string; assessment: string }[]; summary?: string } } | null)?.assessment;
	if (!a?.strands?.length) return null;
	const lines = ["[!summary] Where you stand"];
	if (a.summary) lines.push(obsidianText(a.summary), "");
	for (const s of a.strands) lines.push(`**${s.strand}:** ${obsidianText(s.assessment)}`);
	return quoted(lines.join("\n"));
}

/** The Markdown blocks of one view message, in order. */
function messageBlocks(m: { role: string; parts: readonly Part[]; metadata?: unknown }, numbers: Map<string, number>, planLink?: string): string[] {
	const meta = (m.metadata as { subagentResult?: { kind?: JobKind; result?: unknown } } | undefined)?.subagentResult;
	if (meta) {
		let failed = true;
		try { failed = !meta.kind || !meta.result || isSubagentFailure(meta.kind, meta.result as never); } catch { /* malformed: failed */ }
		return [`*${JOB_LABEL[meta.kind ?? ""] ?? "Helper"} ${failed ? "failed" : "finished"}.*`];
	}
	const out: string[] = [];
	for (const part of m.parts) {
		if (part.type.startsWith("tool-") && part.state === "output-error") continue;
		if (part.type === "text" && part.text?.trim()) {
			if (m.role === "user") {
				const { text, files } = splitAttachments(part.text);
				if (text) out.push(`**You:** ${text}`);
				if (files.length) out.push(`*Attached: ${files.map((f) => f.name).join(", ")}*`);
			} else out.push(obsidianText(part.text));
			continue;
		}
		const tool = part.type.startsWith("tool-") ? part.type.slice(5) : "";
		if ((QUESTION_TOOLS as readonly string[]).includes(tool) && part.state === "output-available" && part.output) {
			out.push(questionCallout(part.toolCallId ? numbers.get(part.toolCallId) : undefined, part.input, part.output as QuestionAnswerData));
		} else if (tool === "probe_done" && part.state === "output-available") {
			const callout = assessmentCallout(part.input);
			if (callout) out.push(callout);
		} else if (tool === "plan_init" && part.state === "output-available") {
			out.push(`*The plan was written${planLink ? `: ${planLink}` : "."}*`);
		} else if (part.type === "data-stage") {
			const action = (part.data as { action?: string } | null)?.action;
			if (action && STAGE_LINE[action]) out.push(`*→ ${STAGE_LINE[action]}*`);
		}
	}
	return out;
}

export function sessionPath(s: VaultSession): string {
	return `${ROOT}/Sessions/${day(s.createdAt)} ${fileName(s.title)}.md`;
}

export function sessionNote(s: VaultSession, links: { topic?: string; challenge?: string }): Note {
	const view = projectView(s.messages);
	const numbers = questionNumbers(view as never);
	const blocks: string[] = [`# ${s.title}`];
	let stage: SessionStage = "warmup";
	if (s.kind === "teach") {
		const phases = phaseTimeline(view as never);
		const stages = messageStages(view as never, phases);
		stage = currentStage(stages, phases.at(-1) ?? "probe");
		const meta = [links.topic && `Plan: ${links.topic}`, links.challenge && `Challenge: ${links.challenge}`].filter(Boolean);
		if (meta.length) blocks.push(meta.join(" · "));
		let heading: SessionStage | undefined;
		view.forEach((m, i) => {
			const parts = messageBlocks(m as never, numbers, links.topic);
			if (!parts.length) return;
			if (stages[i] !== heading) {
				heading = stages[i];
				blocks.push(`## ${STAGE_HEADING[heading!]}`);
			}
			blocks.push(...parts);
		});
	} else {
		for (const m of view) blocks.push(...messageBlocks(m as never, numbers));
	}
	return {
		key: `session:${s.id}`,
		path: sessionPath(s),
		properties: {
			neuroplast: "session",
			tags: [tag("session")],
			kind: s.kind === "teach" ? "learn" : "practice",
			stage: s.kind === "teach" ? STAGE_PROPERTY[stage] : undefined,
			questions: numbers.size,
			created: day(s.createdAt),
			updated: day(s.updatedAt),
			plan: links.topic,
			challenge: links.challenge,
			id: s.id,
		},
		body: blocks.join("\n\n"),
	};
}

// ─── topics and steps ────────────────────────────────────────────────────────

const STATUS_WORD: Record<string, string> = {
	solid: "Solid", learning: "Learning now", ahead: "Ahead", strong: "Strong", trained: "Trained",
	practicing: "Practicing", "needs-practice": "Needs practice", unassessed: "Not tested yet",
};
/** Graph tags: one per kind of note, and one per step status, so
 *  Obsidian's graph can color them (graphColorGroups). */
const STATUS_TAG: Record<string, string> = {
	solid: "solid", strong: "solid", trained: "solid", learning: "learning", practicing: "learning",
	"needs-practice": "needs-practice", ahead: "ahead", unassessed: "ahead",
};
const tag = (name: string) => `neuroplast/${name}`;

const STATUS_CLASS: Record<string, string> = {
	solid: "good", strong: "good", trained: "good", learning: "now", practicing: "now", "needs-practice": "weak", ahead: "ahead", unassessed: "ahead",
};

/** Learn steps in the plan's own order (as the lesson outline numbers
 *  them); challenge skills by depth. */
function ordered(topic: SkillTreeTopic): SkillTreeNode[] {
	return topic.kind === "learn" ? [...topic.nodes] : [...topic.nodes].sort((a, b) => a.depth - b.depth);
}

export function topicPath(topic: SkillTreeTopic): string {
	return `${ROOT}/Topics/${fileName(topic.title)}.md`;
}

export function stepPath(topic: SkillTreeTopic, node: SkillTreeNode, index: number): string {
	return `${ROOT}/Topics/${fileName(topic.title)}/${String(index + 1).padStart(2, "0")} ${fileName(node.title)}.md`;
}

function stepLine(node: SkillTreeNode): string {
	const parts = [STATUS_WORD[node.status] ?? node.status];
	if (node.checks?.graded) parts.push(`${node.checks.correct}/${node.checks.graded} right`);
	if (node.score) parts.push(`${node.score.correct}/${node.score.total} on the last challenge`);
	return parts.join(" · ");
}

/** The topic's tree as a Mermaid diagram, nodes colored by status. */
export function topicMermaid(topic: SkillTreeTopic): string {
	const nodes = ordered(topic);
	const id = new Map(nodes.map((n, i) => [n.id, `n${i + 1}`]));
	const lines = ["```mermaid", "flowchart TD"];
	// "1 · Title", never "1. Title": Mermaid reads a leading "1. " as a
	// Markdown list and Obsidian refuses the diagram ("Unsupported markdown").
	nodes.forEach((n, i) => lines.push(`    n${i + 1}["${i + 1} · ${n.title.replace(/["`]/g, "'")}"]:::${STATUS_CLASS[n.status] ?? "ahead"}`));
	for (const e of topic.edges) if (id.has(e.from) && id.has(e.to)) lines.push(`    ${id.get(e.from)} --> ${id.get(e.to)}`);
	lines.push(
		"    classDef good fill:#d3f9d8,stroke:#2b8a3e,color:#1e1e1e",
		"    classDef now fill:#ffd43b,stroke:#1e1e1e,color:#1e1e1e",
		"    classDef weak fill:#ffe3e3,stroke:#c92a2a,color:#1e1e1e",
		"    classDef ahead fill:#f1f3f5,stroke:#868e96,stroke-dasharray:4 3,color:#1e1e1e",
		"```",
	);
	return lines.join("\n");
}

/** A topic note and one note per step (Learn) or skill (challenge). */
export function topicNotes(topic: SkillTreeTopic, links: { session?: string; challenge?: string }, questions: Map<string, string[]>): Note[] {
	const nodes = ordered(topic);
	const path = topicPath(topic);
	const paths = new Map(nodes.map((n, i) => [n.id, stepPath(topic, n, i)]));
	const solid = nodes.filter((n) => STATUS_CLASS[n.status] === "good").length;
	const unit = topic.kind === "learn" ? "Steps" : "Skills";
	// Links follow the tree, not a star: the topic links only where to
	// start and where you are; each step links the steps it builds on.
	const roots = nodes.filter((n) => !topic.edges.some((e) => e.to === n.id && paths.has(e.from)));
	const now = nodes.filter((n) => STATUS_TAG[n.status] === "learning" && !roots.includes(n));
	const body = [
		`# ${topic.title}`,
		[topic.statusLine, links.session && `Session: ${links.session}`, links.challenge && `Challenge: ${links.challenge}`].filter(Boolean).join(" · "),
		[`Start: ${roots.map((n) => link(paths.get(n.id)!, n.title)).join(", ")}`, now.length ? `Now: ${now.map((n) => link(paths.get(n.id)!, n.title)).join(", ")}` : ""].filter(Boolean).join("\n"),
		topicMermaid(topic),
		`## ${unit}`,
		nodes.map((n, i) => `${i + 1}. ${n.title}: ${stepLine(n)}`).join("\n"),
	];
	const notes: Note[] = [{
		key: `topic:${topic.key}`,
		path,
		properties: {
			neuroplast: "topic",
			tags: [tag("topic")],
			kind: topic.kind,
			status: topic.statusLine,
			solid: `${solid}/${nodes.length}`,
			session: links.session,
			challenge: links.challenge,
			updated: topic.updatedAt ? day(topic.updatedAt) : undefined,
			key: topic.key,
		},
		body: body.join("\n\n"),
	}];
	nodes.forEach((node, i) => {
		const needs = topic.edges.filter((e) => e.to === node.id && paths.has(e.from)).map((e) => link(paths.get(e.from)!, nodes.find((n) => n.id === e.from)!.title));
		// What comes next shows in Obsidian's backlinks; a link back to the
		// topic from every step would turn the graph into a star.
		const lines = [`# ${node.title}`, `${topic.kind === "learn" ? "Step" : "Skill"} ${i + 1} of ${nodes.length} in ${topic.title} · ${stepLine(node)}`];
		if (node.summary) lines.push(obsidianText(node.summary));
		if (needs.length) lines.push(`Builds on: ${needs.join(", ")}`);
		if (node.stages?.length) lines.push(`## Training\n\n${node.stages.map((s) => `- [${s.passed ? "x" : " "}] ${s.stage}`).join("\n")}`);
		const asked = questions.get(node.id);
		if (asked?.length) lines.push(`## Questions on this ${topic.kind === "learn" ? "step" : "skill"}`, ...asked);
		notes.push({
			key: `step:${topic.key}:${node.id}`,
			path: paths.get(node.id)!,
			properties: {
				neuroplast: topic.kind === "learn" ? "step" : "skill",
				tags: [tag(topic.kind === "learn" ? "step" : "skill"), tag(STATUS_TAG[node.status] ?? "ahead")],
				topic: topic.title,
				order: i + 1,
				status: STATUS_WORD[node.status] ?? node.status,
				checks: node.checks ? { asked: node.checks.asked, right: node.checks.correct } : undefined,
				score: node.score ? `${node.score.correct}/${node.score.total}` : undefined,
			},
			body: lines.join("\n\n"),
		});
	});
	return notes;
}

/** The answered lesson questions of a session, by the plan step they name. */
export function questionsByStep(messages: readonly NeuroplastMessage[]): Map<string, string[]> {
	const view = projectView(messages);
	const numbers = questionNumbers(view as never);
	const out = new Map<string, string[]>();
	for (const m of view) {
		for (const part of m.parts as readonly Part[]) {
			const nodeId = (part.input as { nodeId?: string } | null)?.nodeId;
			if (!nodeId || part.state !== "output-available" || !part.output) continue;
			const list = out.get(nodeId) ?? [];
			list.push(questionCallout(part.toolCallId ? numbers.get(part.toolCallId) : undefined, part.input, part.output as QuestionAnswerData));
			out.set(nodeId, list);
		}
	}
	return out;
}

// ─── challenges ──────────────────────────────────────────────────────────────

export function challengePath(c: VaultChallenge): string {
	return `${ROOT}/Challenges/${day(c.createdAt)} ${fileName(c.title)} ${c.id.slice(10, 16)}.md`;
}

export function challengeNote(c: VaultChallenge, links: { session?: string; previous?: string; topic?: string }): Note {
	const skill = new Map(c.skills.map((s) => [s.id, s.name]));
	const lines = [`# ${c.title}: challenge`];
	const meta = [links.session && `Session: ${links.session}`, links.topic && `Skill tree: ${links.topic}`, links.previous && `Retake of ${links.previous}`].filter(Boolean);
	if (meta.length) lines.push(meta.join(" · "));
	const r = c.result;
	if (!r) {
		const answered = c.questions.filter((q) => (c.responses[q.id] ?? "").trim()).length;
		lines.push(`In progress: ${answered} of ${c.questions.length} answered. Results and answers appear here once it is submitted.`);
	} else {
		lines.push(`**Score: ${r.points}/100** (${r.correct} of ${r.total} right)${r.goalMet ? " · goal met" : ""}`);
		lines.push(["| Skill | Right |", "| --- | --- |", ...r.bySkill.map((s) => `| ${s.name} | ${s.correct}/${s.total} |`)].join("\n"));
		lines.push("## Questions");
		r.items.forEach((item, i) => {
			const q = c.questions.find((x) => x.id === item.questionId);
			const callout = [
				`[!${item.correct ? "success" : "failure"}] Question ${i + 1} · ${skill.get(item.skillId) ?? item.skillId} ${item.correct ? "✓" : "✗"}`,
				obsidianText(q?.prompt ?? ""),
				"",
				`**Your answer:** ${obsidianText(item.response || "(blank)")}`,
			];
			if (!item.correct) callout.push(`**Answer:** ${obsidianText(item.answer)}`);
			if (item.explanation) callout.push(obsidianText(item.explanation));
			lines.push(quoted(callout.join("\n")));
		});
	}
	return {
		key: `challenge:${c.id}`,
		path: challengePath(c),
		properties: {
			neuroplast: "challenge",
			tags: [tag("challenge")],
			topic: c.title,
			score: r?.points,
			goal_met: r ? r.goalMet : undefined,
			status: r ? "submitted" : "in progress",
			created: day(c.createdAt),
			submitted: c.submittedAt ? day(c.submittedAt) : undefined,
			session: links.session,
			id: c.id,
		},
		body: lines.join("\n\n"),
	};
}

// ─── the whole vault ─────────────────────────────────────────────────────────

/** Every note for the workspace, plus a home note linking them. */
export function vaultNotes(input: VaultInput): Note[] {
	const sessionPaths = new Map(input.sessions.map((s) => [s.id, sessionPath(s)]));
	const sessionTitle = new Map(input.sessions.map((s) => [s.id, s.title]));
	const challengeBySession = new Map<string, VaultChallenge>();
	for (const c of input.challenges) if (c.sessionId && !challengeBySession.has(c.sessionId)) challengeBySession.set(c.sessionId, c);
	const topicBySession = new Map(input.topics.filter((t) => t.sessionId).map((t) => [t.sessionId!, t]));
	const topicByChallenge = new Map(input.topics.filter((t) => t.challengeId).map((t) => [t.challengeId!, t]));
	const sessionLink = (id?: string) => (id && sessionPaths.has(id) ? link(sessionPaths.get(id)!, sessionTitle.get(id)!) : undefined);
	const challengeLink = (c?: VaultChallenge) => (c ? link(challengePath(c), c.result ? `${c.title} (${c.result.points})` : `${c.title} (in progress)`) : undefined);

	const notes: Note[] = [];
	for (const s of input.sessions) {
		const topic = topicBySession.get(s.id);
		notes.push(sessionNote(s, { topic: topic && link(topicPath(topic), topic.title), challenge: challengeLink(challengeBySession.get(s.id)) }));
	}
	for (const topic of input.topics) {
		const session = topic.sessionId ? input.sessions.find((s) => s.id === topic.sessionId) : undefined;
		// A session's challenge hangs off the session; only a topic with no
		// session (the built-in chapter) links its newest challenge itself.
		const challenge = topic.sessionId ? undefined : input.challenges.find((c) => c.id === topic.challengeId);
		notes.push(...topicNotes(topic, { session: sessionLink(topic.sessionId), challenge: challengeLink(challenge) }, session ? questionsByStep(session.messages) : new Map()));
	}
	for (const c of input.challenges) {
		const topic = topicByChallenge.get(c.id) ?? (c.sessionId ? topicBySession.get(c.sessionId) : undefined);
		const previous = input.challenges.find((p) => p.id === c.previousId);
		const session = sessionLink(c.sessionId);
		notes.push(challengeNote(c, { session, previous: challengeLink(previous), topic: !session && topic ? link(topicPath(topic), topic.title) : undefined }));
	}

	// Two records with the same title and day: later ones get " (2)", " (3)".
	const taken = new Set<string>();
	for (const note of notes) {
		let path = note.path;
		for (let n = 2; taken.has(path.toLowerCase()); n++) path = note.path.replace(/\.md$/, ` (${n}).md`);
		taken.add(path.toLowerCase());
		note.path = path;
	}

	// Home links the topics, and sessions no topic links to. Challenges are
	// always reached through their session (or, with none, their topic).
	const reached = new Set<string>();
	for (const n of notes) if (n.properties.neuroplast === "topic") for (const m of n.body.matchAll(/\[\[([^|\]]+)/g)) reached.add(`${m[1]}.md`);
	const name = (n: Note) => String(n.path.split("/").pop()).replace(/\.md$/, "");
	const list = (kind: string) =>
		notes.filter((n) => n.properties.neuroplast === kind).map((n) =>
			`- ${kind === "topic" || (kind === "session" && !reached.has(n.path)) ? link(n.path, name(n)) : `${name(n)} (${kind === "challenge" ? "in its session or topic" : "in its topic"})`}`).join("\n") || "- None yet";
	notes.unshift({
		key: "home",
		path: `${ROOT}/Neuroplast.md`,
		properties: { neuroplast: "home", tags: [tag("home")] },
		body: [
			"# Neuroplast",
			"Your Neuroplast records, kept in sync by the app. Each note has a generated part between the `neuroplast` markers; write your own notes below the end marker and they are kept.",
			`## Topics\n\n${list("topic")}`,
			`## Sessions\n\n${list("session")}`,
			`## Challenges\n\n${list("challenge")}`,
		].join("\n\n"),
	});
	return notes;
}

// ─── graph colors ────────────────────────────────────────────────────────────

/** Color groups for Obsidian's graph (.obsidian/graph.json), first match
 *  wins: step status before kind. Colors as Obsidian stores them. */
export const GRAPH_COLOR_GROUPS: readonly { query: string; color: { a: 1; rgb: number } }[] = [
	["learning", 0xffd43b], ["needs-practice", 0xff6b6b], ["solid", 0x51cf66], ["ahead", 0xadb5bd],
	["topic", 0x4dabf7], ["session", 0x9775fa], ["challenge", 0xff922b], ["home", 0xe9ecef],
].map(([name, rgb]) => ({ query: `tag:#neuroplast/${name}`, color: { a: 1 as const, rgb: rgb as number } }));

/** An existing graph.json with Neuroplast's color groups in front and the
 *  learner's own groups (and every other setting) kept. */
export function withGraphColors(graph: Record<string, unknown>): Record<string, unknown> {
	const own = Array.isArray(graph.colorGroups) ? (graph.colorGroups as { query?: string }[]).filter((g) => !g.query?.startsWith("tag:#neuroplast/")) : [];
	return { ...graph, colorGroups: [...GRAPH_COLOR_GROUPS, ...own] };
}
