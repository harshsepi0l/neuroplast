"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MessageResponse } from "@/features/learning/ui/messages/message";
import type { QuestionAnswerData } from "@/features/learning/core/question-core";
import { answerLabel, answerSummary, answerVerdict, confidenceWord } from "@/features/learning/core/answer-summary";
import { parseAskInput, parseQuizInput } from "@/features/learning/core/tool-parts";

/**
 * An answered question, folded to one line: label, ✓/✗, the question and
 * what was answered. Show (Why, on a miss) opens a quiet panel with the
 * full question, your answer, the right answer, why, and your reasoning.
 * Printing always includes the panel.
 *
 * Quiz answers are graded; ask answers are a plain record; explain
 * answers show the tutor's committed answer without a verdict (the tutor
 * grades them in its next reply).
 */
export function AnsweredCard({ answer, input, number }: { answer: QuestionAnswerData; input?: unknown; number?: number }) {
	const [open, setOpen] = useState(false);
	const verdict = answerVerdict(answer);
	return (
		<div data-testid="answered-card" className="-mt-px">
			<div className="flex items-baseline gap-3 border-y border-border/50 py-2.5">
				<span className="shrink-0 font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{answerLabel(answer)}
					{number !== undefined && ` ${number}`}
				</span>
				{verdict && (
					<span
						aria-label={verdict === "correct" ? "Correct" : verdict === "incorrect" ? "Incorrect" : "Didn't know"}
						className={cn(
							"shrink-0 font-semibold",
							verdict === "correct" && "text-[var(--success)]",
							verdict === "incorrect" && "text-[var(--danger)]",
							verdict === "unknown" && "text-muted-foreground",
						)}
					>
						{verdict === "correct" ? "✓" : verdict === "incorrect" ? "✗" : "?"}
					</span>
				)}
				{open ? (
					<span className="min-w-0 flex-1 font-semibold">
						<MessageResponse>{answer.questionText}</MessageResponse>
					</span>
				) : (
					<>
						<span className="min-w-0 flex-1 truncate text-[calc(var(--neuroplast-prose-size)*0.95)] text-muted-foreground">
							{plain(answer.questionText)}
						</span>
						<span className="min-w-0 max-w-[45%] shrink-0 truncate text-[calc(var(--neuroplast-prose-size)*0.95)]">{answerSummary(answer, 80)}</span>
					</>
				)}
				<button
					type="button"
					aria-expanded={open}
					onClick={() => setOpen((v) => !v)}
					className="shrink-0 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground print:hidden"
				>
					{open ? "Hide" : verdict === "incorrect" ? "Why" : "Show"}
				</button>
			</div>
			<div className={open ? "mb-3 mt-2" : "hidden print:mb-3 print:mt-2 print:block"}>
				<AnswerPanel answer={answer} input={input} />
			</div>
		</div>
	);
}

/** Markdown/LaTeX markers stripped for the one-line view. */
function plain(text: string): string {
	return text.replace(/\$+/g, "").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex gap-4 leading-relaxed">
			<span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}

/** The opened record: what you said, the answer, why, your reasoning. */
function AnswerPanel({ answer, input }: { answer: QuestionAnswerData; input?: unknown }) {
	if (answer.dismissed) {
		return <div className="ml-8 rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground">Skipped.</div>;
	}
	const details = (answer.kind === "ask" ? parseAskInput(input) : answer.kind === "quiz" ? parseQuizInput(input) : undefined)?.details;
	const said = answer.dontKnow
		? "I don't know"
		: [...answer.answers.map((a) => a.label), ...(answer.other ? [answer.other] : []), ...(answer.text ? [answer.text] : [])].join(", ") || "—";
	const right =
		answer.kind === "quiz" && answer.correctIndices?.length
			? (answer.options ?? []).filter((o) => answer.correctIndices!.includes(o.index)).map((o) => o.label).join(", ")
			: answer.kind === "explain"
				? answer.committed
				: undefined;
	const reasoning = (answer.thinking ?? answer.note ?? "").trim();
	return (
		<div data-testid="answered-detail" className="ml-8 flex flex-col gap-2.5 rounded-lg bg-card px-4 py-3.5">
			{details && (
				<div className="text-sm text-muted-foreground">
					<MessageResponse>{details}</MessageResponse>
				</div>
			)}
			<Line label="You said">
				<MessageResponse>{said}</MessageResponse>
			</Line>
			{typeof answer.confidence === "number" && !answer.dontKnow && (
				<Line label="How sure">
					<span className="text-muted-foreground">{confidenceWord(answer.confidence)}</span>
				</Line>
			)}
			{right && answer.kind !== "ask" && (
				<Line label="Answer">
					<span className="font-semibold">
						<MessageResponse>{right}</MessageResponse>
					</span>
				</Line>
			)}
			{answer.explanation && (
				<Line label="Why">
					<MessageResponse>{answer.explanation}</MessageResponse>
				</Line>
			)}
			{reasoning && (
				<Line label="Your reasoning">
					<span className="italic text-muted-foreground">“{reasoning}”</span>
				</Line>
			)}
			{answer.readingThinking && (
				<Line label="While reading">
					<span className="italic text-muted-foreground">“{answer.readingThinking}”</span>
				</Line>
			)}
		</div>
	);
}
