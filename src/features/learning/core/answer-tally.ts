import { QUESTION_TOOLS } from "./pending";

/** Counts of a session's answered questions. */
export interface AnswerTally {
	/** Questions answered (skipped ones excluded). */
	answered: number;
	/** Graded quiz answers (an "I don't know" counts as answered, not graded). */
	graded: number;
	/** Graded answers that were right. */
	correct: number;
}

interface ResultLike {
	role: string;
	toolName?: string;
	isError?: boolean;
	details?: unknown;
	timestamp?: number;
}

/**
 * Tallies the learner's answers in a native transcript: each question
 * tool's result carries the answer as its details (the "Question posed"
 * placeholder carries none). `since` (ms) counts only answers at or after
 * that time.
 */
export function answerTally(messages: readonly ResultLike[], since?: number): AnswerTally {
	const tally: AnswerTally = { answered: 0, graded: 0, correct: 0 };
	for (const m of messages) {
		if (m.role !== "toolResult" || m.isError || !m.toolName || !(QUESTION_TOOLS as readonly string[]).includes(m.toolName)) continue;
		const d = m.details as { kind?: string; dismissed?: boolean; dontKnow?: boolean; correct?: boolean } | null | undefined;
		if (!d || d.dismissed) continue;
		if (since !== undefined && (m.timestamp ?? 0) < since) continue;
		tally.answered++;
		if (d.kind === "quiz" && !d.dontKnow) {
			tally.graded++;
			if (d.correct) tally.correct++;
		}
	}
	return tally;
}
