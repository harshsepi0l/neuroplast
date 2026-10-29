"use client";

import { useContext } from "react";
import { SettingsIcon } from "lucide-react";
import { JobsContext } from "@/features/learning/ui/session/jobs-context";
import { ChatActionsContext } from "@/features/learning/ui/session/chat-actions-context";
import { isModelsRefusal, isProviderKeyRefusal } from "@/features/settings/core/settings";
import { type JobKind, type JobRecord } from "@/features/artifacts/core/jobs";
import { BrailleSpinner } from "@/features/learning/ui/messages/braille-spinner";

/**
 * The dispatch card (contracts.ts "THE ASYNC PROTOCOL" §4): the tool-call
 * box for a background sub-agent. The tool part's output is the FIRE-AND-
 * FORGET ACK (a string) — never the result. Live status comes from the
 * chat-view jobs feed via JobsContext, matched by toolCallId:
 *
 *   job unknown → "dispatched" pulse (the jobs feed hasn't seen it yet)
 *   running     → live activity card (activity line + elapsed)
 *   done/error  → quiet one-liner ("delivered" / "failed") — the artifact
 *                 itself arrives in the steer message right below, so the
 *                 box must not duplicate it.
 */
const KIND_LABEL: Record<JobKind, string> = {
	research: "Research agent",
	demo: "Demo agent",
	visual: "Figure agent",
	pdf: "PDF reader",
};

export function DispatchCard({ toolCallId, kind }: { toolCallId: string; kind: JobKind }) {
	const jobs = useContext(JobsContext);
	const job = jobs.find((j) => j.toolCallId === toolCallId) ?? null;
	const label = KIND_LABEL[kind];

	if (!job || job.status === "running") {
		return <DispatchActivityCard job={job} label={label} />;
	}
	// Settled: the result (or its failure) arrives as its own line just
	// below — repeating "delivered"/"failed" here only adds noise.
	if (!isModelsRefusal(job.error) && !isProviderKeyRefusal(job.error)) return null;
	// BYOK (owner, 2026-09-22): a job refused for missing models is INFO,
	// not scary-error — gray glyph + "needs model setup" + the deep-link
	// into the SetupDialog (the same flow the send interception uses).
	// The provider-key refusal twin (zero-keys wave): a pinned model
	// whose key is gone reads as the key being needed — the deep-link
	// lands on the SetupDialog's first-key stage on its own.
	if (isModelsRefusal(job.error)) {
		return <DispatchRefusedCard label={label} line="needs model setup" button="Set up models" />;
	}
	if (isProviderKeyRefusal(job.error)) {
		return <DispatchRefusedCard label={label} line="needs a provider key" button="Add a key" />;
	}
	return null;
}

/** The refused card: quiet info tone — nothing red, nothing "failed". */
function DispatchRefusedCard({ label, line, button }: { label: string; line: string; button: string }) {
	const ctx = useContext(ChatActionsContext);
	return (
		<div
			className="flex items-center gap-2 text-xs text-muted-foreground"
			data-testid="dispatch-refused"
		>
			<SettingsIcon className="size-3.5" />
			<span className="font-medium uppercase tracking-wide">{label}</span>
			<span>{line}</span>
			{ctx && (
				<button
					type="button"
					data-testid="dispatch-setup-link"
					onClick={ctx.openSetup}
					className="ml-1 rounded-sm border border-border bg-card px-2 py-0.5 font-ui normal-case tracking-normal text-foreground transition-colors hover:border-muted-foreground/50"
				>
					{button}
				</button>
			)}
		</div>
	);
}

function DispatchActivityCard({ job, label }: { job: JobRecord | null; label: string }) {
	// Elapsed from createdAt — jobs appear here only via the jobs feed (post-mount),
	// so no SSR/hydration mismatch.
	const elapsed =
		job && job.createdAt ? Math.max(0, Math.round((Date.now() - Date.parse(job.createdAt)) / 1000)) : null;
	// One quiet line while it works: spinner, what it is, how long, what it's doing.
	return (
		<div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground" data-testid="dispatch-card">
			<BrailleSpinner label={`${label} running`} />
			<span>{label}</span>
			{elapsed !== null && <span>· {elapsed}s</span>}
			{job?.activity && (
				<span className="min-w-0 truncate" data-testid="dispatch-activity-line">
					· {job.activity}
				</span>
			)}
		</div>
	);
}
