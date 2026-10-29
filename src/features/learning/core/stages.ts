/**
 * Session stages the learner moves by hand: skip the warm-up, start the
 * lesson once the plan is shown. Pure scans over the native record, so the
 * server gates and the session buttons read the same truth.
 *
 *   - warmupBlocker: probe_done is refused until the goal was asked and
 *     answered and enough knowledge questions were answered — unless the
 *     learner asked to skip.
 *   - planAwaitingStart: teaching questions are refused while the first
 *     plan waits for the learner's go-ahead (Start learning, a reply, or an
 *     answered ask).
 */
import type { NeuroplastMarkerMessage, NeuroplastMessage } from "@/features/learning/core/native-messages";

export type StageAction = "skip-warmup" | "start-learning";

/** Answered knowledge questions the warm-up needs (the goal question excluded). */
export const MIN_WARMUP_QUESTIONS = 5;

/** The model-facing text of each stage marker. */
export const STAGE_TEXT: Record<StageAction, string> = {
	"skip-warmup":
		"[SKIP WARM-UP] — I want to skip the rest of the warm-up. Ask nothing more: call probe_done now with your best assessment from what you have seen (say where the evidence is thin), then end your turn.",
	"start-learning": "[START LEARNING] — the plan looks good. Start teaching from the first step.",
};

/** The compact transcript line each marker renders as. */
export const STAGE_LABEL: Record<StageAction, string> = {
	"skip-warmup": "Skipped the warm-up",
	"start-learning": "Started learning",
};

const KNOWLEDGE_TOOLS = ["probe", "recall"];
const TEACH_QUESTION_TOOLS = ["quiz", "explain"];

function role(m: NeuroplastMessage): string {
	return (m as { role?: string }).role ?? "";
}

/** A question result the learner actually answered (not dismissed). */
function answered(m: NeuroplastMessage, tools: readonly string[]): boolean {
	if (role(m) !== "toolResult") return false;
	const result = m as { toolName?: string; isError?: boolean; details?: { dismissed?: boolean } };
	return tools.includes(result.toolName ?? "") && !result.isError && result.details != null && result.details.dismissed !== true;
}

export function stageOf(m: NeuroplastMessage): StageAction | null {
	if (role(m) !== "custom") return null;
	const marker = m as NeuroplastMarkerMessage;
	if (marker.customType !== "stage") return null;
	const action = (marker.details as { action?: unknown } | null)?.action;
	return action === "skip-warmup" || action === "start-learning" ? action : null;
}

export function warmupProgress(messages: readonly NeuroplastMessage[]) {
	return {
		goalAnswered: messages.some((m) => answered(m, ["ask_user_question"])),
		knowledgeAnswered: messages.filter((m) => answered(m, KNOWLEDGE_TOOLS)).length,
		skipped: messages.some((m) => stageOf(m) === "skip-warmup"),
	};
}

/** Why probe_done must wait, or null when the warm-up may end. */
export function warmupBlocker(messages: readonly NeuroplastMessage[]): string | null {
	const progress = warmupProgress(messages);
	if (progress.skipped) return null;
	const missing: string[] = [];
	if (!progress.goalAnswered) {
		missing.push(
			"the learner's goal is not pinned down yet — ask with ask_user_question what they need this for (a class, an exam, a project), and whether they have a syllabus, textbook or notes they can attach",
		);
	}
	if (progress.knowledgeAnswered < MIN_WARMUP_QUESTIONS) {
		const left = MIN_WARMUP_QUESTIONS - progress.knowledgeAnswered;
		missing.push(`only ${progress.knowledgeAnswered} knowledge questions are answered — ask at least ${left} more, one at a time`);
	}
	if (missing.length === 0) return null;
	return `The warm-up is not done: ${missing.join("; and ")}. Keep probing; never ask anything in your closing sentence.`;
}

/** The last successful plan_init result's index, or -1. */
function latestPlanIndex(messages: readonly NeuroplastMessage[]): number {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i]!;
		if (role(m) !== "toolResult") continue;
		const result = m as { toolName?: string; isError?: boolean; details?: { ok?: boolean } };
		if (result.toolName === "plan_init" && !result.isError && result.details?.ok === true) return i;
	}
	return -1;
}

/** Has teaching already begun (a lesson question posed and not refused)? */
function teachingBegan(messages: readonly NeuroplastMessage[]): boolean {
	const refused = new Set(
		messages.filter((m) => role(m) === "toolResult" && (m as { isError?: boolean }).isError).map((m) => (m as { toolCallId?: string }).toolCallId),
	);
	return messages.some(
		(m) =>
			role(m) === "assistant" &&
			((m as { content?: Array<{ type?: string; id?: string; name?: string }> }).content ?? []).some(
				(b) => b.type === "toolCall" && TEACH_QUESTION_TOOLS.includes(b.name ?? "") && !refused.has(b.id),
			),
	);
}

/** Does the plan wait for the learner? True when a plan exists, no lesson
 *  question was ever posed, and nothing from the learner follows the newest
 *  plan. `hasTree` covers a plan written earlier in the running turn (its
 *  result is not in the record yet). */
export function planAwaitingStart(messages: readonly NeuroplastMessage[], hasTree: boolean): boolean {
	const at = latestPlanIndex(messages);
	if (at === -1 && !hasTree) return false;
	if (teachingBegan(messages)) return false;
	if (at === -1) return true; // written this turn — nothing can follow it yet
	return !messages.slice(at + 1).some((m) => role(m) === "user" || stageOf(m) === "start-learning" || answered(m, ["ask_user_question"]));
}

export const PLAN_GATE_ERROR =
	"The learner has not started the lesson yet. Present the plan in a few lines and END YOUR TURN — teaching starts when they press Start learning or reply.";

/** A wake carrying only the warm-up → plan handoff: the lesson's own next
 *  step, so it never counts as background use of a subscription. */
export function lessonHandoffOnly(steers: readonly NeuroplastMessage[]): boolean {
	return steers.length > 0 && steers.every((m) => role(m) === "custom" && (m as NeuroplastMarkerMessage).customType === "probe-handoff");
}
