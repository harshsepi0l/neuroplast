"use client";
import { cn } from "@/lib/utils";
import type { Phase3 } from "@/features/learning/core/phases";

const STEPS = [
	{ id: "probe", label: "Warm-up" },
	{ id: "plan", label: "Plan" },
	{ id: "teach", label: "Learn" },
	{ id: "challenge", label: "Challenge" },
] as const;

/**
 * Where the session is: Warm-up › Plan › Learn › Challenge. Done steps are
 * green, the current one yellow. The challenge step counts once the
 * session has one.
 */
export function SessionStepper({ phase, challenge }: { phase: Phase3; challenge: boolean }) {
	const current = challenge ? 3 : STEPS.findIndex((s) => s.id === phase);
	return (
		<ol aria-label="Session progress" data-testid="phase-chip" data-phase={phase} className="m-0 flex shrink-0 list-none items-center gap-3.5 p-0 text-xs">
			{STEPS.map((step, i) => (
				<li
					key={step.id}
					aria-current={i === current ? "step" : undefined}
					className={cn("flex items-center gap-1.5", i === current ? "font-semibold text-foreground" : "text-muted-foreground")}
				>
					<span
						aria-hidden
						className={cn(
							"size-2 rounded-full border-[1.5px]",
							i < current && "border-[var(--success)] bg-[var(--success)]",
							i === current && "border-primary bg-primary",
							i > current && "border-muted-foreground/60",
						)}
					/>
					{step.label}
				</li>
			))}
		</ol>
	);
}
