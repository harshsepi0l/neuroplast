"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/easyui/Button";
import { cn } from "@/lib/utils";
import { startSession } from "@/features/learning/ui/learning-start";
import { useSessionChallenge } from "@/features/learning/ui/session/session-challenge";
import type { SkillTreeNode, SkillTreeStatus, SkillTreeTopic } from "@/features/knowledge/core/skill-trees";

const STATUS_LABEL: Record<SkillTreeStatus, string> = {
	solid: "Solid",
	learning: "Learning now",
	ahead: "Ahead",
	strong: "Strong",
	trained: "Trained",
	practicing: "Practicing",
	"needs-practice": "Needs practice",
	unassessed: "Not tested yet",
};
type Tone = "good" | "now" | "weak" | "ahead";
const TONE: Record<SkillTreeStatus, Tone> = {
	solid: "good", strong: "good", trained: "good",
	learning: "now", practicing: "now",
	"needs-practice": "weak",
	ahead: "ahead", unassessed: "ahead",
};
const DOT: Record<Tone, string> = {
	good: "border-[var(--success)] bg-[var(--success)] text-background",
	now: "border-primary bg-primary text-primary-foreground",
	weak: "border-[var(--danger)] bg-[var(--danger)] text-background",
	ahead: "border-dashed border-muted-foreground/70 bg-background text-muted-foreground",
};
const PILL: Record<Tone, string> = {
	good: "bg-[var(--success-bg)] text-[var(--success)]",
	now: "bg-primary/15 text-primary",
	weak: "bg-[var(--danger-bg)] text-[var(--danger)]",
	ahead: "bg-muted text-muted-foreground",
};
const STAGE_LABEL: Record<string, string> = {
	recall: "Recall the move",
	discrimination: "Choose the method",
	application: "Apply it",
	"delayed-recall": "Recall it again",
};

function nodeLine(node: SkillTreeNode): string {
	const parts = [STATUS_LABEL[node.status]];
	if (node.checks && node.checks.asked > 0) {
		const waiting = node.checks.asked - node.checks.answered;
		if (node.checks.answered) parts.push(node.checks.graded ? `${node.checks.correct}/${node.checks.graded} checks right` : `${node.checks.answered} answered`);
		if (waiting) parts.push(`${waiting} waiting`);
	}
	if (node.score) parts.push(`${node.score.correct}/${node.score.total}`);
	return parts.join(" · ");
}

/** A straight path: one step per row, a line down the left. */
function PathTree({ topic, selected, onSelect }: { topic: SkillTreeTopic; selected: string; onSelect: (id: string) => void }) {
	const ordered = [...topic.nodes].sort((a, b) => a.depth - b.depth);
	return (
		<ol className="m-0 list-none p-0">
			{ordered.map((node, i) => {
				const tone = TONE[node.status];
				return (
					<li key={node.id} className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3">
						{i < ordered.length - 1 && <span aria-hidden className="absolute bottom-[-0.25rem] left-[1.2rem] top-8 w-0.5 bg-border/40" />}
						<span aria-hidden className={cn("relative z-[1] mx-auto mt-1 grid size-7 place-items-center rounded-full border-[1.5px] font-mono text-xs font-semibold", DOT[tone])}>{tone === "good" ? "✓" : i + 1}</span>
						<button
							type="button"
							aria-pressed={selected === node.id}
							onClick={() => onSelect(node.id)}
							className={cn("mb-3 rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-accent/50", selected === node.id && "bg-card")}
						>
							<div className={cn("font-semibold", tone === "ahead" && "text-muted-foreground")}>{node.title}</div>
							<div className="text-sm text-muted-foreground">{nodeLine(node)}</div>
						</button>
					</li>
				);
			})}
		</ol>
	);
}

const NODE_W = 220;
const NODE_H = 76;
const GAP_X = 28;
const GAP_Y = 52;

/** A layered tree: one row per prerequisite depth, connectors from each
 *  step to the steps that build on it. Wide trees scroll in their box. */
function LayeredTree({ topic, selected, onSelect }: { topic: SkillTreeTopic; selected: string; onSelect: (id: string) => void }) {
	const layout = useMemo(() => {
		const rows = new Map<number, SkillTreeNode[]>();
		for (const n of topic.nodes) rows.set(n.depth, [...(rows.get(n.depth) ?? []), n]);
		const depths = [...rows.keys()].sort((a, b) => a - b);
		const widest = Math.max(...depths.map((d) => rows.get(d)!.length));
		const width = widest * NODE_W + (widest - 1) * GAP_X;
		const pos = new Map<string, { x: number; y: number }>();
		depths.forEach((d, r) => {
			const row = rows.get(d)!;
			const rowW = row.length * NODE_W + (row.length - 1) * GAP_X;
			row.forEach((n, i) => pos.set(n.id, { x: (width - rowW) / 2 + i * (NODE_W + GAP_X), y: r * (NODE_H + GAP_Y) }));
		});
		return { pos, width, height: depths.length * NODE_H + (depths.length - 1) * GAP_Y };
	}, [topic]);
	return (
		<div className="overflow-x-auto pb-2">
			<div className="relative mx-auto" style={{ width: layout.width, height: layout.height }}>
				<svg aria-hidden className="absolute inset-0 overflow-visible" width={layout.width} height={layout.height}>
					{topic.edges.map((e) => {
						const a = layout.pos.get(e.from);
						const b = layout.pos.get(e.to);
						if (!a || !b) return null;
						const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
						const my = (y1 + y2) / 2;
						return <path key={`${e.from}-${e.to}`} d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-border/50" />;
					})}
				</svg>
				{topic.nodes.map((node) => {
					const p = layout.pos.get(node.id)!;
					const tone = TONE[node.status];
					return (
						<button
							key={node.id}
							type="button"
							aria-pressed={selected === node.id}
							onClick={() => onSelect(node.id)}
							className={cn(
								"absolute flex flex-col justify-center gap-1 rounded-xl border bg-card px-3.5 text-left transition-colors hover:border-primary/60",
								tone === "ahead" ? "border-dashed border-border/60" : "border-border/60",
								selected === node.id && "border-primary ring-1 ring-primary",
							)}
							style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
						>
							<span className={cn("line-clamp-2 text-sm font-semibold leading-snug", tone === "ahead" && "text-muted-foreground")}>{node.title}</span>
							<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<span aria-hidden className={cn("size-2 shrink-0 rounded-full border", DOT[tone])} />
								{nodeLine(node)}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

/** A Learn topic's next moves: back into the lesson, or straight to a
 *  challenge (opened when one exists, built otherwise). */
function TopicChallenge({ sessionId }: { sessionId: string }) {
	const router = useRouter();
	const { take, busy, error } = useSessionChallenge(sessionId);
	return (
		<div className="flex w-full items-center gap-3">
			<Button size="sm" data-testid="topic-learn" onClick={() => router.push(`/chat/${sessionId}`)}>Learn</Button>
			<Button size="sm" variant="secondary" isLoading={busy} onClick={() => void take()}>Take the challenge</Button>
			{(busy || error) && <span className="text-sm text-muted-foreground">{error || "Building your challenge…"}</span>}
		</div>
	);
}

function Detail({ topic, node }: { topic: SkillTreeTopic; node: SkillTreeNode }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const tone = TONE[node.status];
	const index = [...topic.nodes].sort((a, b) => a.depth - b.depth).findIndex((n) => n.id === node.id) + 1;
	async function start(text: string, mode: "learn" | "practice") {
		setBusy(true);
		setError("");
		try { router.push(`/chat/${await startSession(text, mode)}`); }
		catch (failure) { setError((failure as Error).message); setBusy(false); }
	}
	return (
		<aside aria-label="Selected skill" aria-live="polite" className="flex min-w-0 flex-col gap-3.5 rounded-2xl border border-border/60 bg-card p-5">
			<div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
					{topic.kind === "learn" ? "Step" : "Skill"}
					{/* A branching plan has no single order, so no "n of m" there. */}
					{!topic.branching && ` ${index} of ${topic.nodes.length}`}
				</div>
			<h3 className="m-0 text-xl font-bold leading-snug">{node.title}</h3>
			<span className={cn("self-start rounded-md px-2.5 py-1 text-sm font-semibold", PILL[tone])}>{STATUS_LABEL[node.status]}</span>
			{node.summary && <p className="m-0 text-muted-foreground">{node.summary}</p>}

			{topic.kind === "learn" && node.checks && (
				<dl className="m-0 text-sm">
					<div className="flex justify-between gap-3 border-t border-border/50 py-2"><dt className="text-muted-foreground">Checks asked</dt><dd className="m-0">{node.checks.asked}</dd></div>
					<div className="flex justify-between gap-3 border-t border-border/50 py-2"><dt className="text-muted-foreground">Answered</dt><dd className="m-0">{node.checks.answered}</dd></div>
					<div className="flex justify-between gap-3 border-y border-border/50 py-2"><dt className="text-muted-foreground">Right</dt><dd className="m-0">{node.checks.graded ? `${node.checks.correct}/${node.checks.graded}` : "—"}</dd></div>
				</dl>
			)}

			{topic.kind === "challenge" && (
				<>
					<div className="flex items-baseline justify-between"><span className="text-sm text-muted-foreground">Last challenge</span><span className="text-2xl font-bold">{node.score ? `${node.score.correct}/${node.score.total}` : "—"}</span></div>
					{node.stages && (
						<div>
							<div className="mb-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">Training</div>
							<ul className="m-0 list-none p-0 text-sm">
								{node.stages.map((s) => (
									<li key={s.stage} className="flex items-center gap-2.5 border-t border-border/50 py-2 last:border-b">
										<span aria-hidden className={s.passed ? "text-[var(--success)]" : "text-muted-foreground"}>{s.passed ? "✓" : "○"}</span>
										<span>{STAGE_LABEL[s.stage] ?? s.stage}</span>
										<span className="sr-only">{s.passed ? "passed" : "not yet"}</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</>
			)}

			<div className="flex flex-wrap gap-2.5">
				{topic.kind === "learn" ? (
					<>
						<Button size="sm" onClick={() => router.push(`/chat/${topic.sessionId}`)}>Learn</Button>
						<Button size="sm" variant="secondary" isLoading={busy} onClick={() => void start(`Practice: ${node.title} (${topic.title})`, "practice")}>Practice it</Button>
					</>
				) : (
					<>
						{topic.challengeId ? (
							<Button size="sm" onClick={() => router.push(`/challenge/${topic.challengeId}`)}>{node.score ? "Train this skill" : "Open challenge"}</Button>
						) : (
							<Button size="sm" onClick={() => router.push("/challenges")}>Take the challenge</Button>
						)}
						<Button size="sm" variant="secondary" isLoading={busy} onClick={() => void start(`Teach me ${node.title} (${topic.title})`, "learn")}>Learn it in a session</Button>
					</>
				)}
			</div>
			{error && <p role="alert" className="m-0 text-sm text-[var(--danger)]">{error}</p>}
		</aside>
	);
}

/** The node to open first: the one being learned, else the first not yet solid. */
function defaultNode(topic: SkillTreeTopic): string {
	const order = [...topic.nodes].sort((a, b) => a.depth - b.depth);
	return (order.find((n) => n.status === "learning" || n.status === "practicing") ?? order.find((n) => TONE[n.status] !== "good") ?? order[0])?.id ?? "";
}

/**
 * Knowledge: every topic as a skill tree. Topics on the left, the selected
 * topic's tree in the middle (a path, or layered rows when the plan
 * branches), and the selected skill's detail and next steps on the right.
 */
export function SkillTreeView({ topics, initialTopic }: { topics: SkillTreeTopic[]; initialTopic?: string }) {
	const [topicKey, setTopicKey] = useState(topics.some((t) => t.key === initialTopic) ? initialTopic! : (topics[0]?.key ?? ""));
	const topic = topics.find((t) => t.key === topicKey) ?? topics[0];
	const [selected, setSelected] = useState<Record<string, string>>({});
	const nodeId = topic ? (selected[topic.key] ?? defaultNode(topic)) : "";
	const node = topic?.nodes.find((n) => n.id === nodeId);
	const solid = topic ? topic.nodes.filter((n) => TONE[n.status] === "good").length : 0;

	return (
		<div className="h-full overflow-auto px-6 pb-16 pt-9">
			<div className="mx-auto flex max-w-[84rem] flex-col gap-7">
				<header>
					<h1 className="m-0 text-3xl font-bold tracking-tight">Knowledge</h1>
				</header>

				{!topic ? (
					<p className="m-0 border-t border-border/50 py-4 text-muted-foreground">
						Nothing here yet. Start a session in <Link href="/chat/new" className="underline underline-offset-4">Learn</Link> or try the <Link href="/challenges" className="underline underline-offset-4">linear equations chapter</Link>.
					</p>
				) : (
					<div className="flex flex-wrap items-start gap-7">
						<nav aria-label="Topics" className="flex min-w-[12.5rem] flex-[0_1_15rem] flex-col gap-1">
							<div className="px-3.5 pb-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">Topics</div>
							{topics.map((t) => (
								<button
									key={t.key}
									type="button"
									aria-current={t.key === topic.key ? "true" : undefined}
									onClick={() => setTopicKey(t.key)}
									className={cn(
										"flex flex-col gap-0.5 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-accent/50",
										t.key === topic.key && "bg-card shadow-[inset_3px_0_0_var(--brand)]",
									)}
								>
									<span className="line-clamp-2 font-semibold">{t.title}</span>
									<span className="text-sm text-muted-foreground">{t.statusLine}</span>
								</button>
							))}
						</nav>

						<section aria-labelledby="tree-title" className="min-w-0 flex-[999_1_26rem]">
							<div className="mb-5 flex flex-wrap items-baseline justify-between gap-2.5">
								<h2 id="tree-title" className="m-0 text-xl font-bold">{topic.title}</h2>
								<span className="text-sm text-muted-foreground">{solid} of {topic.nodes.length} {topic.kind === "learn" ? "steps" : "skills"} solid · {topic.statusLine}</span>
								{topic.kind === "learn" && topic.sessionId && <TopicChallenge key={topic.sessionId} sessionId={topic.sessionId} />}
							</div>
							{topic.branching ? (
								<LayeredTree topic={topic} selected={nodeId} onSelect={(id) => setSelected((s) => ({ ...s, [topic.key]: id }))} />
							) : (
								<PathTree topic={topic} selected={nodeId} onSelect={(id) => setSelected((s) => ({ ...s, [topic.key]: id }))} />
							)}
						</section>

						{node && <div className="min-w-[16rem] max-w-[22rem] flex-[1_1_19rem]"><Detail key={`${topic.key}:${node.id}`} topic={topic} node={node} /></div>}
					</div>
				)}

				<p className="m-0 text-sm text-muted-foreground">
					Looking for your notes map? <Link href="/knowledge/legacy" className="underline underline-offset-4">Previous notes graph</Link>
				</p>
			</div>
		</div>
	);
}
