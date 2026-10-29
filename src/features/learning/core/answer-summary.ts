import type { QuestionAnswerData } from "./question-core";
import { QUESTION_TOOLS } from "./pending";

/** The card's label: the tool's own name first (probe-phase calls read
 *  Probe/Recall), else by kind. Old records without `tool` use the kind. */
export function answerLabel(_answer: QuestionAnswerData): string {
	// One label and one numbering for every question in the session: the
	// tool behind it (probe, quiz, explain, ask) is the tutor's business.
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
	if (answer.kind !== "quiz" || answer.dismissed) return null;
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

/** Numbers every question in the transcript (answered or pending) in
 *  the order it was asked: toolCallId → 1, 2, 3… so a card can read
 *  "Check 3". Errored calls the model retried are not counted. */
export function questionNumbers(
	messages: readonly { parts: readonly { type: string; toolCallId?: string; state?: string }[] }[],
): Map<string, number> {
	const numbers = new Map<string, number>();
	for (const m of messages) {
		for (const part of m.parts) {
			if (!part.type.startsWith("tool-") || !part.toolCallId || part.state === "output-error") continue;
			if (!(QUESTION_TOOLS as readonly string[]).includes(part.type.slice("tool-".length))) continue;
			if (!numbers.has(part.toolCallId)) numbers.set(part.toolCallId, numbers.size + 1);
		}
	}
	return numbers;
}

const LATEX_SYMBOLS: Record<string, string> = {
	mid: "|", cdot: "·", times: "×", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠",
	approx: "≈", infty: "∞", pm: "±", to: "→", rightarrow: "→", cap: "∩", cup: "∪", in: "∈",
	alpha: "α", beta: "β", theta: "θ", lambda: "λ", mu: "μ", sigma: "σ", pi: "π",
};

/** One-line plain text for a question or answer: markdown and LaTeX
 *  markers turned into readable characters (\(P(A \mid B)\) → P(A | B)). */
export function plainLine(text: string): string {
	return text
		// Money keeps its dollar sign: `\$10` and a bare `$10` both read $10.
		.replace(/\\?\$(?=\d[\d,]*(?:\.\d+)?(?:[kKMB]|bn)?(?:$|[\s.,;:!?)\]'"—–-]))/g, "\u0000")
		.replace(/\\[()[\]]/g, "")
		.replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^}]*)\}/g, "$1")
		.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
		.replace(/\\([a-zA-Z]+)/g, (_m, name: string) => LATEX_SYMBOLS[name] ?? "")
		.replace(/[{}$]/g, "")
		.replace(/[*_`]/g, "")
		.replace(/\s+/g, " ")
		.replace(/\u0000/g, "$")
		.trim();
}
