"use client";
import { ArrowRight } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import { useSessionChallenge, type SessionChallengeInfo } from "./session-challenge";

/**
 * The learner moves the session on by hand. In the warm-up: skip to the
 * plan, or straight to a challenge. Once the plan is shown: start
 * learning, or skip to a challenge. They sit at the foot of the current
 * stage's section; the plan's outline above them links the knowledge tree.
 */
export function StageActions({
	stage,
	chatId,
	challenge,
	disabled,
	onSkipWarmup,
	onStartLearning,
}: {
	stage: "warmup" | "plan";
	chatId: string;
	challenge?: SessionChallengeInfo;
	disabled: boolean;
	onSkipWarmup: () => void;
	onStartLearning: () => void;
}) {
	const { take, busy, error } = useSessionChallenge(chatId, challenge);
	return (
		<div data-testid="stage-actions" className="flex flex-wrap items-center gap-2 print:hidden">
			{stage === "plan" ? (
				<Button size="sm" disabled={disabled || busy} rightIcon={<ArrowRight size={15} />} onClick={onStartLearning}>
					Start learning
				</Button>
			) : (
				<Button size="sm" variant="secondary" disabled={disabled || busy} onClick={onSkipWarmup}>
					Skip to plan
				</Button>
			)}
			<Button size="sm" variant="secondary" disabled={disabled} isLoading={busy} onClick={() => void take()}>
				{challenge ? "Open challenge" : "Skip to challenge"}
			</Button>
			{(busy || error) && <span className="text-sm text-muted-foreground">{error || "Building your challenge…"}</span>}
		</div>
	);
}
