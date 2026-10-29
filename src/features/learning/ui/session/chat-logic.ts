import { isProviderKeyRefusal, type ModelSlotName } from "@/features/settings/core/settings";
import type { NeuroplastViewMessage } from "@/features/learning/core/view";

/** The BYOK refusal envelope from the transport's error text: the
 *  DefaultChatTransport throws the 503 body VERBATIM as the error message,
 *  so the machine-readable {code, missing} shape survives to here. Real
 *  errors (any other text) read as null and keep the honest banner.
 *  Exported pure for tests. */
export function parseModelsRefusal(message: string | undefined): ModelSlotName[] | null {
	if (!message) return null;
	try {
		const body = JSON.parse(message) as { code?: unknown; missing?: unknown };
		if (body.code === "models_not_configured" && Array.isArray(body.missing)
			&& body.missing.every((s) => typeof s === "string")) {
			return body.missing as ModelSlotName[];
		}
		return null;
	} catch {
		return null;
	}
}

/** The provider-key refusal's transport seam (zero-keys wave, Platform's
 *  66dbea9): same discipline as parseModelsRefusal — the 503 body rides
 *  the thrown error message verbatim, so the envelope's own matcher
 *  (core, invariant-tail) decides; the wording can never drift client-
 *  side. Exported pure for tests. */
export function parseProviderKeyRefusal(message: string | undefined): boolean {
	if (!message) return false;
	try {
		const body = JSON.parse(message) as { code?: unknown; error?: unknown };
		return body.code === "provider_key_missing" && typeof body.error === "string" && isProviderKeyRefusal(body.error);
	} catch {
		return false;
	}
}

/** A wake-pipeline steer message: user-role delivery whose metadata marks it
 * as a sub-agent result — rendered as an artifact card, never a bubble. */
export function isSubagentSteer(m: NeuroplastViewMessage): boolean {
	return (m.metadata as { subagentResult?: unknown } | undefined)?.subagentResult != null;
}

/** The layered-Esc ruling (owner, 2026-10-04): an open overlay claims Esc —
 *  closing itself — before the abort chain may open its confirm. A mermaid
 *  focus, the plan popup, or the setup dialog over a pending question must
 *  close the OVERLAY, never dismiss the question underneath. Priority is
 *  stacking order: the abort confirm (topmost, claims via its own dialog),
 *  then the session overlays (mermaid paints above plan — later in DOM),
 *  then setup (self-closing — the gate only must not fire), then the
 *  2026-10-02 abort chain proper (question before turn). */
export type EscAbortTarget = "mermaid" | "plan" | "setup" | "question" | "problem" | "turn" | null;
/**
 * Does the ?prompt topic still owe its first send? The gate is "no real
 * conversation yet" (no user/assistant message) — NOT emptiness: a
 * session started with map picks carries a graph-context MARKER as
 * message[0], and that scaffolding must never swallow the first send
 * (owner report, 2026-10-04: the turn went dead behind it — the old
 * `length === 0` check saw the marker and refused to fire).
 */
export function initialPromptOwed(messages: readonly { role: string }[], prompt: string | undefined): boolean {
	if (!prompt) return false;
	return !messages.some((m) => m.role === "user" || m.role === "assistant");
}

export function escAbortTarget(s: {
	abortAsk: boolean;
	mermaidFocus: boolean;
	planOpen: boolean;
	setupOpen: boolean;
	pending: boolean;
	/** An active practice problem (practice sessions, 2026-10-04): Esc
	 *  opens the discard confirm — below a pending question (the two
	 *  never coexist, but the layering stays strict), above the turn
	 *  abort (a live turn can be running BEHIND an idle problem only in
	 *  teaching sessions — practice problems end their pose turns). */
	problem: boolean;
	busy: boolean;
}): EscAbortTarget {
	if (s.abortAsk) return null; // the popup's own Esc — claimed by the dialog
	if (s.mermaidFocus) return "mermaid";
	if (s.planOpen) return "plan";
	if (s.setupOpen) return "setup";
	if (s.pending) return "question";
	if (s.problem) return "problem";
	if (s.busy) return "turn";
	return null;
}

/** Remembers whether the tutor's thinking is shown (per device). */
export const SHOW_THINKING_KEY = "neuroplast:show-thinking";

interface ViewPartLike { type: string; text?: string; state?: string; toolCallId?: string; output?: unknown }
interface ViewMessageLike { role: string; parts: readonly ViewPartLike[] }

const userText = (m: ViewMessageLike) => m.parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n").trim();

/** A user message that repeats the one right before it — what a retry
 *  after a failed attempt leaves behind. It shows once. */
export function repeatedUserMessage(messages: readonly ViewMessageLike[], i: number): boolean {
	const m = messages[i];
	const prev = messages[i - 1];
	if (!m || !prev || m.role !== "user" || prev.role !== "user") return false;
	const text = userText(m);
	return text.length > 0 && text === userText(prev);
}

/** The warm-up (probe-phase questions): which were answered, the first
 *  one (where the warm-up heading goes), and how many were right. */
export function warmupSummary(messages: readonly ViewMessageLike[]): { ids: Set<string>; first?: string; answered: number; correct: number } {
	const ids = new Set<string>();
	let first: string | undefined;
	let correct = 0;
	for (const m of messages) {
		for (const p of m.parts) {
			if ((p.type !== "tool-probe" && p.type !== "tool-recall") || p.state !== "output-available" || !p.toolCallId) continue;
			ids.add(p.toolCallId);
			first ??= p.toolCallId;
			if ((p.output as { correct?: boolean } | undefined)?.correct) correct++;
		}
	}
	return { ids, first, answered: ids.size, correct };
}

/** The tutor is still thinking (a reasoning part is the newest thing). */
export function lastPartIsReasoning(messages: readonly ViewMessageLike[]): boolean {
	const last = messages.at(-1);
	return last?.role === "assistant" && last.parts.at(-1)?.type === "reasoning";
}

/** What the working line says while the tutor prepares the next thing. */
export function workingLabel(phase: string, kind: string): string {
	if (kind === "practice") return "Preparing the next problem…";
	if (phase === "probe") return "Picking your next question…";
	if (phase === "plan") return "Building your plan…";
	return "Writing the next step…";
}

/**
 * Removes paragraphs that are just a question tool's arguments written out
 * as JSON — a weaker model sometimes types the call into the lesson
 * instead of making it. Ordinary prose and code blocks are kept.
 */
export function stripLeakedToolArgs(text: string): string {
	return text
		.split(/\n{2,}/)
		.filter((para) => {
			const t = para.trim();
			if (!t.startsWith("{") || !t.endsWith("}")) return true;
			try {
				const obj = JSON.parse(t) as Record<string, unknown>;
				return !(typeof obj === "object" && obj && "question" in obj && ("options" in obj || "correctAnswer" in obj));
			} catch {
				return !/"question"\s*:/.test(t) || !/"(options|correctAnswer)"\s*:/.test(t);
			}
		})
		.join("\n\n");
}
