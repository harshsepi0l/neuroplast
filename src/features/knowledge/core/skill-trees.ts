import { derivePlanStatusesLh, type PlanTree } from "@/features/learning/core/plan";
import type { NeuroplastMessage } from "@/features/learning/core/native-messages";
import type { KnowledgeTree, SkillState } from "@/features/challenges/core/knowledge-tree";

/**
 * The Knowledge tab's skill trees: every topic the learner is working on,
 * in one shape. A Learn session's plan becomes a tree of its steps (with
 * the plan's own prerequisite edges); a challenge topic becomes a path of
 * its skills (challenges record no prerequisites). Pure projection — the
 * page composes it from the chat and challenge stores.
 */

/** A Learn step's status: moved past, being learned now, or still ahead. */
export type LearnStatus = "solid" | "learning" | "ahead";
export type SkillTreeStatus = LearnStatus | SkillState;

export interface SkillTreeNode {
	id: string;
	title: string;
	summary?: string;
	/** Row in the tree: the longest prerequisite chain above this node. */
	depth: number;
	status: SkillTreeStatus;
	/** Learn steps: the checks the tutor asked on this step. */
	checks?: { asked: number; answered: number; graded: number; correct: number };
	/** Challenge skills: the latest scored challenge's result for it. */
	score?: { correct: number; total: number };
	/** Challenge skills: the four training stages and whether each is passed. */
	stages?: { stage: string; passed: boolean }[];
}

export interface SkillTreeTopic {
	/** Stable across reloads: `learn:<chat id>` or `challenge:<topic id>`. */
	key: string;
	kind: "learn" | "challenge";
	title: string;
	/** One line for the topics list, e.g. "Learn · step 2 of 7". */
	statusLine: string;
	nodes: SkillTreeNode[];
	edges: { from: string; to: string }[];
	/** True when some row holds more than one node (draw as a layered tree). */
	branching: boolean;
	/** Learn topics: the session to continue. */
	sessionId?: string;
	/** Challenge topics: the challenge to resume or train from. */
	challengeId?: string;
	/** Challenge topics: the topic id (for starting the built-in chapter). */
	topicId?: string;
	updatedAt?: string;
}

/** Longest-path depth per node over the prerequisite edges; nodes in a
 *  cycle or with dangling edges fall back to depth 0. Stable: nodes keep
 *  their authored order within a row. */
export function layerDepths(nodes: readonly { id: string }[], edges: readonly { from: string; to: string }[]): Map<string, number> {
	const ids = new Set(nodes.map((n) => n.id));
	const parents = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
	for (const e of edges) if (ids.has(e.from) && ids.has(e.to) && e.from !== e.to) parents.get(e.to)!.push(e.from);
	const depth = new Map<string, number>();
	const visiting = new Set<string>();
	const walk = (id: string): number => {
		const known = depth.get(id);
		if (known !== undefined) return known;
		if (visiting.has(id)) return 0; // cycle guard
		visiting.add(id);
		const d = parents.get(id)!.reduce((max, p) => Math.max(max, walk(p) + 1), 0);
		visiting.delete(id);
		depth.set(id, d);
		return d;
	};
	for (const n of nodes) walk(n.id);
	return depth;
}

function isBranching(nodes: readonly SkillTreeNode[]): boolean {
	const perRow = new Map<number, number>();
	for (const n of nodes) perRow.set(n.depth, (perRow.get(n.depth) ?? 0) + 1);
	return [...perRow.values()].some((count) => count > 1);
}

const CHECK_TOOLS = new Set(["quiz", "explain"]);

/** Per plan step: the nodeId-tagged checks asked, answered, graded, right. */
export function checksByNode(messages: readonly NeuroplastMessage[]): Map<string, { asked: number; answered: number; graded: number; correct: number }> {
	const nodeOfCall = new Map<string, string>();
	const out = new Map<string, { asked: number; answered: number; graded: number; correct: number }>();
	const bump = (node: string) => {
		let c = out.get(node);
		if (!c) out.set(node, (c = { asked: 0, answered: 0, graded: 0, correct: 0 }));
		return c;
	};
	for (const m of messages) {
		const role = (m as { role?: string }).role;
		if (role === "assistant") {
			for (const block of (m as { content: { type: string; id?: string; name?: string; arguments?: unknown }[] }).content) {
				if (block.type !== "toolCall" || !block.name || !CHECK_TOOLS.has(block.name) || !block.id) continue;
				const nodeId = (block.arguments as { nodeId?: unknown } | null)?.nodeId;
				if (typeof nodeId !== "string" || !nodeId) continue;
				nodeOfCall.set(block.id, nodeId);
			}
		} else if (role === "toolResult") {
			const r = m as { toolCallId: string; isError?: boolean; details?: unknown };
			const node = nodeOfCall.get(r.toolCallId);
			if (!node) continue;
			nodeOfCall.delete(r.toolCallId);
			if (r.isError) continue; // a malformed call the tutor retried
			const c = bump(node);
			c.asked++;
			const d = r.details as { kind?: string; dismissed?: boolean; dontKnow?: boolean; correct?: boolean } | null | undefined;
			if (!d || d.dismissed) continue;
			c.answered++;
			if (d.kind === "quiz" && !d.dontKnow) {
				c.graded++;
				if (d.correct) c.correct++;
			}
		}
	}
	// Calls still waiting for an answer (no result yet) count as asked.
	for (const node of nodeOfCall.values()) bump(node).asked++;
	return out;
}

/** A Learn session with a plan → its skill tree. */
export function learnTopic(session: { id: string; title: string; updatedAt: string; tree: PlanTree; messages: readonly NeuroplastMessage[] }): SkillTreeTopic {
	const { tree } = session;
	const statuses = derivePlanStatusesLh(tree, session.messages as NeuroplastMessage[]);
	const depths = layerDepths(tree.nodes, tree.edges);
	const checks = checksByNode(session.messages);
	const nodes: SkillTreeNode[] = tree.nodes.map((n) => ({
		id: n.id,
		title: n.title,
		...(n.summary ? { summary: n.summary } : {}),
		depth: depths.get(n.id) ?? 0,
		status: statuses.current === n.id ? "learning" : statuses.visited.has(n.id) ? "solid" : "ahead",
		checks: checks.get(n.id) ?? { asked: 0, answered: 0, graded: 0, correct: 0 },
	}));
	const reached = nodes.filter((n) => n.status !== "ahead").length;
	return {
		key: `learn:${session.id}`,
		kind: "learn",
		title: session.title,
		statusLine: reached === 0 ? `Learn · ${nodes.length} steps planned` : `Learn · step ${reached} of ${nodes.length}`,
		nodes,
		edges: tree.edges.map((e) => ({ from: e.from, to: e.to })),
		branching: isBranching(nodes),
		sessionId: session.id,
		updatedAt: session.updatedAt,
	};
}

/** A challenge topic (from the challenge knowledge tree) → a path of its skills. */
export function challengeTopic(tree: KnowledgeTree, chapter: boolean): SkillTreeTopic {
	const nodes: SkillTreeNode[] = tree.skills.map((s, i) => ({
		id: s.id,
		title: s.name,
		summary: s.description,
		depth: i,
		status: s.state,
		...(s.latest ? { score: { correct: s.latest.correct, total: s.latest.total } } : {}),
		stages: s.training.stages.map((st) => ({ stage: st.stage, passed: st.passed })),
	}));
	const statusLine = tree.activeChallengeId
		? "Challenge · in progress"
		: tree.latestScore !== undefined
			? `Challenge · ${tree.latestScore}/100`
			: chapter
				? "Chapter · not started"
				: "Challenge · not taken";
	return {
		key: `challenge:${tree.topic.id}`,
		kind: "challenge",
		title: tree.topic.title,
		statusLine,
		nodes,
		edges: nodes.slice(1).map((n, i) => ({ from: nodes[i]!.id, to: n.id })),
		branching: false,
		challengeId: tree.activeChallengeId ?? tree.latestChallengeId,
		topicId: tree.topic.id,
	};
}
