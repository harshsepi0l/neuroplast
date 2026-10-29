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
import { COLUMN, DOCK } from "./chat-layout";
import { AttachButton, AttachmentChips, type Attachments } from "@/features/learning/ui/composer/attach";

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
	questionNumber,
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
	setupCta,
	challengeCta,
	stageActions,
	attachments,
	queuedSteers,
}: {
	pending: ReturnType<typeof findPendingToolCall>;
	/** The pending question's number in the session ("Check 3"). */
	questionNumber?: number;
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
	/** Only undrained steers (visibleQueuedSteers). */
	queuedSteers: QueuedSteerLine[];
	/** The setup CTA shown while model slots are unset. */
	setupCta?: React.ReactNode;
	/** "Take the challenge" — shown above the composer once teaching starts. */
	challengeCta?: React.ReactNode;
	/** Skip / start buttons for the warm-up and plan stages. */
	stageActions?: React.ReactNode;
	/** The paperclip under an open question: files ride the answer. */
	attachments?: Attachments;
}) {
	const mode = pending ? `question:${pending.toolCallId}` : practice ? `practice:${practice.toolCallId}` : "chat";
	return (
		<div data-testid="session-dock" className={`${pending ? COLUMN : DOCK} pb-10 pt-2`} style={{ "--dock-max-h": "none" } as React.CSSProperties}>
			{setupCta}
			{!practice && stageActions}
			{!pending && !practice && challengeCta}
			<QueuedSteersBody steers={queuedSteers} />
			{/* A pending question sits in the page with no box around it (the
			    quiet worksheet); the practice dock and composer keep theirs. */}
			<div className={pending ? "" : "overflow-hidden rounded-2xl border bg-card"}>
				<div key={mode} className="dock-variant">
					{pending ? (
						<QuestionDock
							toolName={pending.tool as "quiz" | "probe" | "ask_user_question" | "explain" | "recall"}
							toolCallId={pending.toolCallId}
							input={pending.input as never}
							expanded
							number={questionNumber}
							phase={phase}
							onExpand={() => {}}
							onSubmit={onSubmitAnswer}
							compactionRunning={compactionRunning}
						/>
					) : practice ? (
						<PracticeDock
							problemCallId={practice.toolCallId}
							input={practice.input as { statement: string }}
							expanded
							onExpand={() => {}}
							onSubmit={onSubmitThinking}
							compactionRunning={compactionRunning}
						/>
					) : (
						composer
					)}
				</div>
			</div>
			{pending && attachments && (
				<div data-testid="answer-attach" className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground print:hidden">
					<AttachButton attachments={attachments} label="Attach file" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent hover:text-foreground disabled:opacity-40" />
					<AttachmentChips attachments={attachments} />
				</div>
			)}
			{/* The open question stands alone, like the rest of the page;
			    the stats and model row return with the composer. */}
			{!pending && <StatsBar turns={turns} contextTokens={contextTokens} pricing={pricing} chatId={chatId} />}
		</div>
	);
}
