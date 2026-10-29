"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, Flag, Radar, Waypoints, type LucideIcon } from "lucide-react";
import type { SessionStage } from "@/features/learning/core/stage-sections";
import { Button } from "@/ui/easyui/Button";
import { cn } from "@/lib/utils";
import { useSessionChallenge, type SessionChallengeInfo } from "./session-challenge";

const STAGE: Record<SessionStage, { n: number; label: string; icon: LucideIcon; later: string }> = {
	warmup: { n: 1, label: "Warm-up", icon: Radar, later: "Starts with your first message" },
	plan: { n: 2, label: "Plan", icon: Waypoints, later: "Comes after the warm-up" },
	learn: { n: 3, label: "Learn", icon: BookOpen, later: "Opens when you start learning" },
};

export type StageStatus = "done" | "current" | "upcoming";

/**
 * One stage of a Learn session as its own section. The current stage is
 * open; a finished one folds to one line the learner can open again; one
 * still ahead is a dashed row.
 */
export function StageSection({ stage, status, summary, open, onToggle, children, footer }: {
	stage: SessionStage;
	status: StageStatus;
	summary?: string;
	open: boolean;
	onToggle: () => void;
	children?: ReactNode;
	footer?: ReactNode;
}) {
	const { n, label, icon: Icon, later } = STAGE[stage];
	if (status === "upcoming") {
		return (
			<div data-testid={`stage-${stage}`} data-status="upcoming" className="flex items-center gap-4 rounded-xl border-[1.5px] border-dashed border-border/40 px-5 py-3.5 text-muted-foreground print:hidden">
				<span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-border/40"><Icon size={18} /></span>
				<span className="flex flex-col">
					<span className="font-mono text-xs uppercase tracking-wide">{n} · {label}</span>
					<span>{later}</span>
				</span>
			</div>
		);
	}
	const done = status === "done";
	const heading = (
		<>
			<span
				aria-hidden
				className={cn(
					"flex size-9 shrink-0 items-center justify-center rounded-full",
					done ? "bg-primary text-primary-foreground" : "border-2 border-primary text-foreground shadow-[0_0_0_5px_color-mix(in_srgb,var(--brand)_18%,transparent)]",
				)}
			>
				{done ? <Check size={18} strokeWidth={2.5} /> : <Icon size={18} />}
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
					{n} · {label} · {done ? "Done" : "Now"}
				</span>
				<span className="truncate text-[calc(var(--neuroplast-prose-size)*1.05)] font-semibold">{summary ?? label}</span>
			</span>
		</>
	);
	return (
		<section
			aria-label={label}
			data-testid={`stage-${stage}`}
			data-status={status}
			className={cn("rounded-xl border-[1.5px]", done ? "border-border/40" : "border-border")}
		>
			{done ? (
				<button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-4 rounded-xl px-5 py-3.5 text-left hover:bg-accent/50">
					{heading}
					<span className="text-sm text-muted-foreground print:hidden">{open ? "Hide" : "Show"}</span>
					<ChevronDown aria-hidden size={18} className={cn("text-muted-foreground transition-transform print:hidden", open && "rotate-180")} />
				</button>
			) : (
				<div className="flex items-center gap-4 rounded-t-xl border-b-[1.5px] border-border/40 bg-[var(--surface-warm)] px-5 py-3.5">{heading}</div>
			)}
			{open && (
				<div className={cn("flex flex-col gap-4 px-5 pb-5", done ? "border-t-[1.5px] border-border/40 pt-4" : "pt-4")}>
					{children}
					{footer}
				</div>
			)}
		</section>
	);
}

/** The challenge row under the stages: build or open this session's challenge. */
export function ChallengeRow({ chatId, challenge, disabled }: { chatId: string; challenge?: SessionChallengeInfo; disabled: boolean }) {
	const { take, busy, error } = useSessionChallenge(chatId, challenge);
	const scored = challenge?.score !== undefined;
	return (
		<div data-testid="session-challenge" className={cn("flex items-center gap-4 rounded-xl border-[1.5px] px-5 py-3.5 print:hidden", challenge ? "border-border/40" : "border-dashed border-border/40")}>
			<span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", scored ? "bg-primary text-primary-foreground" : "border-2 border-border/40 text-muted-foreground")}>
				<Flag size={18} />
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">4 · Challenge</span>
				<span>
					{busy
						? "Building ten questions from this session. This takes about a minute."
						: error || (challenge ? (scored ? `Your score: ${challenge.score}/100` : "In progress") : "Ten scored questions on this session")}
				</span>
			</span>
			<Button size="sm" variant={challenge ? "secondary" : "primary"} disabled={disabled} isLoading={busy} rightIcon={<ArrowRight size={15} />} onClick={() => void take()}>
				{challenge ? "Open challenge" : "Take it now"}
			</Button>
		</div>
	);
}

const LOADING: Record<SessionStage, { title: string; line: string; retry: string }> = {
	warmup: { title: "Getting your warm-up ready", line: "A few questions first, so the plan starts where you are.", retry: "Let's start the warm-up." },
	plan: { title: "Building your plan", line: "From what the warm-up found.", retry: "Go ahead and write the plan." },
	learn: { title: "Starting the lesson", line: "Step one of your plan is on its way.", retry: "Let's start the lesson." },
};

/** How long a loading screen waits with nothing running before it offers a retry. */
export const STALL_MS = 20_000;

/**
 * The loading screen between stages: neurons trying to connect. When no
 * turn is running for a while (a dropped handoff), it offers a retry that
 * sends a plain message to move the session on.
 */
export function StageLoading({ stage, busy, onRetry }: { stage: SessionStage; busy: boolean; onRetry: (text: string) => void }) {
	const { title, line, retry } = LOADING[stage];
	const [seconds, setSeconds] = useState(0);
	const [idleSince, setIdleSince] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		setIdleSince(busy ? null : Date.now());
	}, [busy]);
	useEffect(() => {
		const timer = setInterval(() => {
			setSeconds((s) => s + 1);
			setNow(Date.now());
		}, 1000);
		return () => clearInterval(timer);
	}, []);
	const stalled = idleSince !== null && now - idleSince >= STALL_MS;
	return (
		<div role="status" aria-live="polite" data-testid={`stage-loading-${stage}`} className="flex flex-col items-center gap-5 py-6 text-center">
			<Neurons />
			<div className="flex flex-col gap-1">
				<h3 className="m-0 text-xl font-bold">{title}</h3>
				<p className="m-0 text-muted-foreground">{line}</p>
				{!stalled && <span className="font-mono text-xs text-muted-foreground">{seconds}s</span>}
			</div>
			{stalled && (
				<div data-testid="stage-retry" className="flex w-full max-w-md items-center gap-3 rounded-lg border-[1.5px] border-dashed border-muted-foreground/60 px-4 py-3 text-left">
					<span className="flex-1">This is taking longer than usual.</span>
					<Button size="sm" variant="secondary" onClick={() => onRetry(retry)}>Retry</Button>
				</div>
			)}
		</div>
	);
}

const SOMA = [[70, 60], [235, 40], [130, 175], [260, 150]] as const;
const LINKS = ["M80 55C130 20 180 70 224 44", "M74 71C70 120 110 130 124 165", "M141 172C180 190 220 130 249 148", "M238 51C270 90 240 110 257 139"];
const DENDRITES = [
	"M60 54L44 44M44 44l-10-2M44 44l-2-12M62 68L50 84",
	"M246 36L262 24M262 24h12M245 46L262 54M228 32L222 16",
	"M119 179L100 186M100 186l-8 10M125 186L120 204M138 184L146 200",
	"M271 154L290 160M290 160l8-8M265 160L272 178M268 141L284 128",
];

function Neurons() {
	return (
		<svg aria-hidden width="240" height="165" viewBox="0 0 320 220" fill="none" strokeLinecap="round" strokeLinejoin="round">
			<g className="stroke-border/30" strokeWidth="1.5" strokeDasharray="2 6">
				{LINKS.map((d) => <path key={d} d={d} />)}
			</g>
			<g strokeWidth="3">
				{LINKS.map((d, i) => <path key={d} className="neuron-strive" style={{ animationDelay: `${i * 0.5}s` }} pathLength={100} d={d} />)}
			</g>
			<g className="stroke-foreground" strokeWidth="2">
				{SOMA.map(([x, y], i) => (
					<g key={i}>
						<path d={DENDRITES[i]} />
						<circle cx={x} cy={y} r="11" className="fill-background" />
					</g>
				))}
			</g>
			<g className="fill-primary">
				{SOMA.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" />)}
			</g>
		</svg>
	);
}
