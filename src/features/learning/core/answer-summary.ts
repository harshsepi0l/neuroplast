import type { QuestionAnswerData } from "./question-core";

/** The card's label: the tool's own name first (probe-phase calls read
 *  Probe/Recall), else by kind. Old records without `tool` use the kind. */
export function answerLabel(answer: QuestionAnswerData): string {
	if (answer.tool === "probe") return "Probe";
	if (answer.tool === "recall") return "Recall";
	if (answer.kind === "quiz") return answer.questionType === "predict" ? "Prediction" : "Check";
	if (answer.kind === "explain") return "Explain";
	return "Question";
}

/** A stated confidence (0–100) as the word the learner picked. */
export function confidenceWord(confidence: number): string {
	if (confidence <= 30) return "guessing";
	if (confidence <= 50) return "unsure";
	if (confidence <= 70) return "fairly sure";
	return "certain";
}

/** Graded result of a quiz answer; null for ungraded kinds. */
export function answerVerdict(answer: QuestionAnswerData): "correct" | "incorrect" | "unknown" | null {
	if (answer.kind !== "quiz") return null;
	if (answer.dontKnow) return "unknown";
	return answer.correct ? "correct" : "incorrect";
}

/**
 * The one-line record of an answered question: what was answered, the
 * right answer when it was missed, and how sure the learner was.
 */
export function answerSummary(answer: QuestionAnswerData, maxText = 120): string {
	if (answer.dismissed) return "Skipped";
	if (answer.kind === "quiz" && answer.dontKnow) return "Didn't know";
	const picked = [...answer.answers.map((a) => a.label), ...(answer.other ? [answer.other] : [])];
	let text = picked.length ? picked.join(", ") : (answer.text ?? "").trim();
	if (text.length > maxText) text = `${text.slice(0, maxText - 1).trimEnd()}…`;
	const parts = [text || "Answered"];
	if (answer.kind === "quiz" && !answer.correct && answer.correctIndices?.length && answer.options) {
		const right = answer.options.filter((o) => answer.correctIndices!.includes(o.index)).map((o) => o.label);
		if (right.length) parts.push(`answer: ${right.join(", ")}`);
	}
	if (answer.kind === "quiz" && typeof answer.confidence === "number") parts.push(confidenceWord(answer.confidence));
	return parts.join(" · ");
}
