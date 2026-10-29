"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/easyui/Button";
import { cn } from "@/lib/utils";
import { startSession } from "@/features/learning/ui/learning-start";
import { useModelCatalog } from "@/features/learning/ui/composer/model-picker";
import type { ChatSummary } from "@/features/learning/core/chat";
import type { ChallengeSummary } from "@/features/challenges/core/contracts";
import type { SkillState } from "@/features/challenges/core/knowledge-tree";
import type { LessonMode } from "@/features/learning/core/lesson";

export interface HomeSkill {
	id: string;
	name: string;
	state: SkillState;
	latest?: { correct: number; total: number };
}

export interface HomeWeek {
	sessions: number;
	answered: number;
	graded: number;
	correct: number;
}

const STATE_LABEL: Record<SkillState, string> = {
	unassessed: "Not tested yet",
	"needs-practice": "Needs practice",
	practicing: "Practicing",
	trained: "Trained",
	strong: "Strong",
};
const STATE_DOT: Record<SkillState, string> = {
	unassessed: "bg-muted-foreground",
	"needs-practice": "bg-[var(--danger)]",
	practicing: "bg-primary",
	trained: "bg-[var(--success)]",
	strong: "bg-[var(--success)]",
};

function relativeDay(iso: string, now: number): string {
	const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
	if (days <= 0) {
		const hours = Math.floor((now - Date.parse(iso)) / 3_600_000);
		return hours <= 0 ? "just now" : `${hours}h ago`;
	}
	if (days === 1) return "yesterday";
	if (days < 7) return `${days} days ago`;
	return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** What a session is waiting on, or how it went. */
function sessionStatus(s: ChatSummary): { text: string; waiting: boolean } {
	const answered = s.answers?.answered ?? 0;
	if (s.pendingQuestion) return { text: `Check ${answered + 1} is waiting`, waiting: true };
	if (s.pendingProblem) return { text: "A problem is waiting", waiting: true };
	if (s.answers?.graded) return { text: `${s.answers.correct}/${s.answers.graded} right`, waiting: false };
	if (answered) return { text: `${answered} answered`, waiting: false };
	return { text: s.kind === "practice" ? "Practice" : "Not started", waiting: false };
}

function SectionHead({ id, title, href, link }: { id: string; title: string; href?: string; link?: string }) {
	return (
		<div className="mb-2 flex items-baseline justify-between gap-4">
			<h2 id={id} className="m-0 text-lg font-semibold">{title}</h2>
			{href && link && <Link href={href} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{link}</Link>}
		</div>
	);
}

function StartBox({ compact = false }: { compact?: boolean }) {
	const router = useRouter();
	const { catalog } = useModelCatalog();
	const ready = Boolean(catalog?.defaults && catalog.providers.some((p) => p.id === catalog.defaults?.model.provider && p.keyPresent));
	const [text, setText] = useState("");
	const [busy, setBusy] = useState<LessonMode | null>(null);
	const [error, setError] = useState("");
	async function start(mode: LessonMode) {
		if (!text.trim() || busy) return;
		if (!ready) { router.push("/connections"); return; }
		setBusy(mode); setError("");
		try { router.push(`/chat/${await startSession(text.trim(), mode)}`); }
		catch (failure) { setError((failure as Error).message); setBusy(null); }
	}
	return (
		<div className="flex flex-col gap-3">
			<label htmlFor="home-ask" className={compact ? "sr-only" : "text-xl font-semibold"}>What do you want to understand?</label>
			<textarea
				id="home-ask"
				rows={2}
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void start("learn"); } }}
				placeholder="e.g. Bayes' theorem, from scratch"
				className="neuroplast-input w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2.5 outline-none placeholder:text-muted-foreground focus:border-primary/60"
			/>
			<div className="flex flex-wrap gap-2.5">
				<Button size="sm" disabled={!text.trim()} isLoading={busy === "learn"} onClick={() => void start("learn")}>Learn it</Button>
				<Button size="sm" variant="secondary" disabled={!text.trim() || busy !== null} isLoading={busy === "practice"} onClick={() => void start("practice")}>Practice it</Button>
			</div>
			{!ready && <p className="m-0 text-sm text-muted-foreground">Connect a model first. <Link href="/connections" className="underline underline-offset-4">Connect</Link></p>}
			{error && <p role="alert" className="m-0 text-sm text-[var(--danger)]">{error}</p>}
		</div>
	);
}

/**
 * Home: where you left off, what to start, and how it is going — recent
 * sessions, the latest challenge with its skills, and this week's numbers.
 * A first visit (nothing yet) shows three getting-started steps instead.
 */
export function HomeDashboard({ sessions, challenge, skills, week, now }: {
	sessions: ChatSummary[];
	challenge?: ChallengeSummary;
	skills: HomeSkill[];
	week: HomeWeek;
	now: number;
}) {
	const router = useRouter();
	const { catalog } = useModelCatalog();
	const ready = Boolean(catalog?.defaults && catalog.providers.some((p) => p.id === catalog.defaults?.model.provider && p.keyPresent));
	// Continue: a session waiting on the learner first, else the newest.
	const latest = sessions.find((s) => s.pendingQuestion || s.pendingProblem) ?? sessions[0];
	const today = new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

	if (!latest && !challenge) {
		return (
			<div className="h-full overflow-auto px-6 pb-16 pt-12">
				<div className="mx-auto flex max-w-[45rem] flex-col gap-8">
					<header>
						<div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Welcome</div>
						<h1 className="mb-2 mt-1.5 text-3xl font-bold tracking-tight">Let’s get you learning</h1>
						<p className="m-0 text-muted-foreground">Three steps. Your sessions, scores and skills will show up here as you go.</p>
					</header>
					<ol className="m-0 list-none p-0">
						{[
							{ done: ready, title: "Connect a model", body: ready ? "Your tutor is ready." : <>Add a provider key or sign in. <Link href="/connections" className="underline underline-offset-4">Connect a model</Link></> },
							{ done: false, title: "Ask your first question", body: <StartBox compact /> },
							{ done: false, title: "Take a challenge", body: <>Finish a Learn session and take its challenge, or try the <Link href="/challenges" className="underline underline-offset-4">linear equations chapter</Link>.</> },
						].map((step, i) => (
							<li key={step.title} className="flex items-start gap-4 border-t border-border/50 py-4 last:border-b">
								<span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs", step.done ? "border-[var(--success)] bg-[var(--success)] text-background" : "border-border/70")}>{step.done ? "✓" : i + 1}</span>
								<div className="min-w-0 flex-1">
									<div className="mb-1 font-semibold">{step.title}</div>
									<div className="text-sm text-muted-foreground">{step.body}</div>
								</div>
							</li>
						))}
					</ol>
				</div>
			</div>
		);
	}

	const status = latest ? sessionStatus(latest) : null;
	const delta = challenge?.score !== undefined && challenge.previousScore !== undefined ? challenge.score - challenge.previousScore : undefined;
	return (
		<div className="h-full overflow-auto px-6 pb-16 pt-10">
			<div className="mx-auto flex max-w-[68rem] flex-col gap-9">
				<header>
					<div className="font-mono text-xs uppercase tracking-wide text-muted-foreground" suppressHydrationWarning>{today}</div>
					<h1 className="m-0 mt-1.5 text-3xl font-bold tracking-tight">Welcome back</h1>
				</header>

				<section className="grid gap-5 md:grid-cols-2">
					{latest && status && (
						<div className="flex flex-col gap-3 rounded-2xl border border-border/60 border-l-[3px] bg-card p-6" style={{ borderLeftColor: "var(--brand)" }}>
							<span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Continue where you left off</span>
							<div className="text-xl font-semibold">{latest.title}</div>
							<div className="text-muted-foreground">
								{latest.kind === "practice" ? "Practice" : "Learn"}
								{latest.plan && ` · step ${Math.max(latest.plan.reached, 1)} of ${latest.plan.total}`}
								{" · "}
								<span className={status.waiting ? "text-foreground" : undefined}>{status.text}</span>
							</div>
							{latest.plan && (
								<div className="h-1.5 overflow-hidden rounded-full bg-border/40" aria-hidden>
									<div className="h-full rounded-full bg-primary" style={{ width: `${(100 * latest.plan.reached) / latest.plan.total}%` }} />
								</div>
							)}
							<div className="mt-1"><Button size="sm" onClick={() => router.push(`/chat/${latest.id}`)}>Resume</Button></div>
						</div>
					)}
					<div className="rounded-2xl border border-border/60 bg-card p-6"><StartBox /></div>
				</section>

				<div className="grid gap-12 md:grid-cols-2">
					<div className="flex flex-col gap-9">
						{sessions.length > 0 && (
							<section aria-labelledby="home-recent">
								<SectionHead id="home-recent" title="Recent sessions" href="/sessions" link="All sessions" />
								<ul className="m-0 list-none p-0">
									{sessions.slice(0, 5).map((s) => {
										const st = sessionStatus(s);
										return (
											<li key={s.id} className="border-t border-border/50 last:border-b">
												<Link href={`/chat/${s.id}`} className="flex items-center gap-3.5 py-3 hover:text-primary">
													<span aria-hidden className={cn("size-2 shrink-0 rounded-full", st.waiting ? "bg-primary" : s.answers?.graded ? "bg-[var(--success)]" : "bg-muted-foreground")} />
													<span className="min-w-0 flex-1 truncate">{s.title}</span>
													<span className="shrink-0 text-sm text-muted-foreground" suppressHydrationWarning>{st.text} · {relativeDay(s.updatedAt, now)}</span>
												</Link>
											</li>
										);
									})}
								</ul>
							</section>
						)}
						<section aria-labelledby="home-week">
							<SectionHead id="home-week" title="This week" />
							<div className="grid grid-cols-3 gap-3">
								<div><div className="text-3xl font-bold">{week.sessions}</div><div className="text-sm text-muted-foreground">{week.sessions === 1 ? "session" : "sessions"}</div></div>
								<div><div className="text-3xl font-bold">{week.answered}</div><div className="text-sm text-muted-foreground">questions answered</div></div>
								<div><div className="text-3xl font-bold">{week.graded ? `${Math.round((100 * week.correct) / week.graded)}%` : "—"}</div><div className="text-sm text-muted-foreground">checks right</div></div>
							</div>
						</section>
					</div>

					<div className="flex flex-col gap-9">
						<section aria-labelledby="home-challenge">
							<SectionHead id="home-challenge" title="Latest challenge" href="/challenges" link="All challenges" />
							{challenge ? (
								<>
									<div className="flex items-end justify-between gap-4 border-t border-border/50 py-3.5">
										<div className="min-w-0">
											<div className="truncate font-semibold">{challenge.topicTitle}</div>
											<div className="text-sm text-muted-foreground">
												{challenge.submittedAt ? new Date(challenge.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "In progress"}
												{delta !== undefined && ` · ${delta > 0 ? `up ${delta}` : delta < 0 ? `down ${-delta}` : "same as"} from ${challenge.previousScore}`}
											</div>
										</div>
										{challenge.score !== undefined && <div className="text-4xl font-bold leading-none">{challenge.score}<span className="text-base font-medium text-muted-foreground">/100</span></div>}
									</div>
									<Button size="sm" variant={challenge.goalMet ? "secondary" : "primary"} onClick={() => router.push(`/challenge/${challenge.id}`)}>
										{!challenge.submittedAt ? "Resume challenge" : challenge.goalMet ? "View result" : "Train weak skills"}
									</Button>
								</>
							) : (
								<p className="m-0 border-t border-border/50 py-3.5 text-muted-foreground">Finish a Learn session and take its challenge to see your score here.</p>
							)}
						</section>

						{skills.length > 0 && (
							<section aria-labelledby="home-skills">
								<SectionHead id="home-skills" title="Skills" href="/knowledge" link="Knowledge tree" />
								<ul className="m-0 list-none p-0">
									{skills.map((skill) => (
										<li key={skill.id} className="flex items-center gap-3.5 border-t border-border/50 py-3 last:border-b">
											<span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATE_DOT[skill.state])} />
											<span className="min-w-0 flex-1 truncate">{skill.name}</span>
											<span className="shrink-0 text-sm text-muted-foreground">{STATE_LABEL[skill.state]}{skill.latest && ` · ${skill.latest.correct}/${skill.latest.total}`}</span>
										</li>
									))}
								</ul>
							</section>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
