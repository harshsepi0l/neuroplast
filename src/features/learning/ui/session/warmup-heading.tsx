"use client";

/**
 * The warm-up's heading. While warming up it titles the list of answered
 * questions; once teaching starts the list folds behind this one line.
 */
export function WarmupHeading({ summary, folded, open, onToggle }: {
	summary: { answered: number; correct: number };
	folded: boolean;
	open: boolean;
	onToggle: () => void;
}) {
	if (!folded) {
		return (
			<div className="mt-2 flex items-baseline justify-between gap-4">
				<h2 className="m-0 text-lg font-semibold">Warm-up</h2>
				<span className="text-sm text-muted-foreground">{summary.answered} answered</span>
			</div>
		);
	}
	return (
		<div data-testid="warmup-summary" className="flex items-center gap-3 border-y border-border/50 py-2.5">
			<span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Warm-up</span>
			<span className="flex-1 text-[calc(var(--neuroplast-prose-size)*0.95)]">
				{summary.answered} answered · {summary.correct} right
			</span>
			<button type="button" aria-expanded={open} onClick={onToggle} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground print:hidden">
				{open ? "Hide" : "Show"}
			</button>
		</div>
	);
}
