"use client";
import { QueuedSteersBody, type QueuedSteerLine } from "@/features/learning/ui/composer/queued-steers";
import { StatsBar } from "@/features/learning/ui/session/stats-bar";
import { QuestionDock } from "@/features/learning/ui/docks/question-dock";
import { PracticeDock } from "@/features/learning/ui/docks/practice-dock";
import type { TurnUsage } from "@/features/learning/core/chat";
import type { Phase3 } from "@/features/learning/core/phases";
import type { QuestionAnswerData } from "@/features/learning/core/question-core";
import type { SessionPricing } from "@/features/learning/core/prices";
import { findPendingToolCall } from "@/features/learning/core/pending";
import { DOCK } from "./chat-layout";

/**
 * The end of the lesson page: the open question, the practice problem, or
 * the composer, IN THE FLOW after the last message — the session reads top
 * to bottom like a worksheet. A pending question replaces the composer;
 * once answered it becomes an AnsweredCard in the transcript above and the
 * tutor's next step streams in below it. The page follows new content
 * while the learner is at the bottom (use-stick-to-bottom).
 */
export function SessionDock({
	pending,
	practice,
	compactionRunning,
	onSubmitThinking,
	phase,
	turns,
	contextTokens,
	pricing,
	composer,
	onSubmitAnswer,
	chatId,
	dictationSlot,
	dictationCancel,
	setupCta,
	queuedSteers,
}: {
	pending: ReturnType<typeof findPendingToolCall>;
	/** The active practice problem: owns the slot like a pending question. */
	practice: { toolCallId: string; input: unknown } | null;
	/** Compaction running for this chat — the docks' submit gate. */
	compactionRunning: boolean;
	onSubmitThinking: (text: string) => void;
	/** Session phase at the pending question — scales the thinking field. */
	phase: Phase3;
	turns: TurnUsage[];
	contextTokens: number | null;
	pricing?: SessionPricing;
	composer: React.ReactNode;
	onSubmitAnswer: (output: QuestionAnswerData) => void;
	chatId: string;
	/** The dictation strip, in the stats bar's middle slot. */
	dictationSlot?: React.ReactNode;
	/** Esc in a pending question's field stops dictation. */
	dictationCancel?: () => void;
	/** Only undrained steers (visibleQueuedSteers). */
	queuedSteers: QueuedSteerLine[];
	/** The setup CTA shown while model slots are unset. */
	setupCta?: React.ReactNode;
}) {
	const mode = pending ? `question:${pending.toolCallId}` : practice ? `practice:${practice.toolCallId}` : "chat";
	return (
		<div data-testid="session-dock" className={`${DOCK} pb-10 pt-2`} style={{ "--dock-max-h": "none" } as React.CSSProperties}>
			{setupCta}
			<QueuedSteersBody steers={queuedSteers} />
			<div
				className={`overflow-hidden rounded-2xl border bg-card ${pending || practice ? "shadow-[4px_4px_0_var(--brand)]" : ""}`}
			>
				<div key={mode} className="dock-variant">
					{pending ? (
						<QuestionDock
							toolName={pending.tool as "quiz" | "probe" | "ask_user_question" | "explain" | "recall"}
							toolCallId={pending.toolCallId}
							input={pending.input as never}
							expanded
							phase={phase}
							onExpand={() => {}}
							onSubmit={onSubmitAnswer}
							onEscape={dictationCancel}
							dictationClaim
							compactionRunning={compactionRunning}
						/>
					) : practice ? (
						<PracticeDock
							problemCallId={practice.toolCallId}
							input={practice.input as { statement: string }}
							expanded
							onExpand={() => {}}
							onSubmit={onSubmitThinking}
							onEscape={dictationCancel}
							compactionRunning={compactionRunning}
						/>
					) : (
						composer
					)}
				</div>
			</div>
			<StatsBar turns={turns} contextTokens={contextTokens} pricing={pricing} dictationSlot={dictationSlot} chatId={chatId} />
		</div>
	);
}
