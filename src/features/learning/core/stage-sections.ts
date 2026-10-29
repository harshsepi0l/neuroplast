import type { Phase3 } from "./phases";

/** The session's stacked sections, in order. (The challenge is a row of its
 *  own below them: it lives on its own page.) */
export type SessionStage = "warmup" | "plan" | "learn";
export const SESSION_STAGES: readonly SessionStage[] = ["warmup", "plan", "learn"];

/** Minimal slice of a view message: role and typed parts. */
export interface StageMessage {
	role?: string;
	parts: ReadonlyArray<{ type: string; state?: string; data?: unknown }>;
}

function startsLearning(m: StageMessage): boolean {
	return m.parts.some((p) => p.type === "data-stage" && (p.data as { action?: string } | null)?.action === "start-learning");
}

/**
 * The section each message renders in. A message stays in the stage it
 * began in, so the warm-up's closing message (the one carrying probe_done)
 * stays in the warm-up. Learn opens at the learner's Start learning or at
 * the first lesson question, whichever comes first, and everything after
 * belongs to it.
 */
export function messageStages(messages: readonly StageMessage[], phases: readonly Phase3[]): SessionStage[] {
	const out: SessionStage[] = [];
	let learning = false;
	for (let i = 0; i < messages.length; i++) {
		if (phases[i] === "teach" || startsLearning(messages[i]!)) learning = true;
		if (learning) out.push("learn");
		else out.push((i === 0 ? "probe" : phases[i - 1]) === "probe" ? "warmup" : "plan");
	}
	return out;
}

/** The open section: Learn once anything is in it, Plan once the warm-up
 *  has concluded, else the warm-up. */
export function currentStage(stages: readonly SessionStage[], phase: Phase3): SessionStage {
	if (stages.includes("learn")) return "learn";
	return phase === "probe" ? "warmup" : "plan";
}

function hasAssistant(messages: readonly StageMessage[], stages: readonly SessionStage[], stage: SessionStage): boolean {
	return messages.some((m, i) => stages[i] === stage && m.role === "assistant");
}

function planWritten(messages: readonly StageMessage[]): boolean {
	return messages.some((m) => m.parts.some((p) => (p.type.startsWith("tool-plan_") && p.state === "output-available") || p.type === "data-plan-block"));
}

/**
 * The loading screen the current section shows, or null: the warm-up
 * before the tutor's first word, the plan between the warm-up and the
 * written plan, the lesson between Start learning and the tutor's first
 * word.
 */
export function stageLoading(messages: readonly StageMessage[], stages: readonly SessionStage[], current: SessionStage): SessionStage | null {
	if (messages.length === 0) return null;
	if (current === "warmup") return hasAssistant(messages, stages, "warmup") ? null : "warmup";
	if (current === "plan") return planWritten(messages) ? null : "plan";
	return hasAssistant(messages, stages, "learn") ? null : "learn";
}
