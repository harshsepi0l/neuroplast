"use client";
import { openingMessage, clearOpeningMessage } from "../opening-message";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatSession } from "@/features/learning/ui/session/session";
import { visibleQueuedSteers } from "@/features/learning/ui/session/session-core";
import { SetupDialog } from "@/features/learning/ui/session/setup-dialog";
import { Hint } from "@/ui/primitives/hint";
import { useZeroKeys, ZeroKeysPill } from "@/features/learning/ui/session/setup-cta";
import { type StickToBottomContext } from "use-stick-to-bottom";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/features/learning/ui/messages/conversation";
import { Message, MessageContent, MessageResponse } from "@/features/learning/ui/messages/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/features/learning/ui/messages/reasoning";
import { Shimmer } from "@/features/learning/ui/messages/shimmer";
import { BrailleSpinner } from "@/features/learning/ui/messages/braille-spinner";
import { LiveToolCard } from "@/features/learning/ui/messages/live-tool-card";
import { Separator } from "@/ui/primitives/separator";
import { AnsweredCard } from "@/features/learning/ui/docks/answered-card";
import { artifactRenderers } from "@/features/artifacts/ui/renderers";
import { SubagentSteerCard } from "@/features/learning/ui/messages/steer-card";
import { Composer } from "@/features/learning/ui/composer/composer";
import { useEnterSubmits } from "@/features/learning/ui/composer/enter-submits";
import { blurAfterPointerClick } from "@/features/learning/ui/session/focus-hygiene";
import { DictationBar, joinDictation, useDictation } from "@/features/learning/ui/composer/dictation";
import { useFieldCycle } from "@/features/learning/ui/composer/field-cycle";
import { JobsContext } from "@/features/learning/ui/session/jobs-context";
import { useChatJobs } from "./use-chat-jobs";
import { useServerEvent } from "@/features/learning/ui/session/server-events";
import { firstSourceTextParts, messageAnchorId, textPartMessageId } from "@/features/learning/core/session-navigation";
import { kbdEventForAction as kbdEventForChat } from "@/features/settings/core/keyboard";
import { needsContinuation, type NeuroplastMessage } from "@/features/learning/core/native-messages";
import { PlanBlock, PlanPopup, latestTree } from "@/features/learning/ui/messages/plan-block";
import { PlanOutline } from "@/features/learning/ui/messages/plan-outline";
import { MermaidOverlay, SessionMermaidContext } from "@/features/learning/ui/session/session-overlay";
import { AbortTurnDialog, type AbortMode } from "@/features/learning/ui/session/abort-turn-dialog";
import { ArrowRightIcon, DumbbellIcon, WaypointsIcon } from "lucide-react";
import type { PlanBlockData } from "@/features/learning/core/chat";
import { SessionFind } from "@/features/learning/ui/session/session-find";
import { SessionMessageNavigation } from "@/features/learning/ui/session/session-navigation";
import { ThinkingCard, type PracticeThinkingData } from "@/features/learning/ui/docks/practice-cards";
import { GraphContextCard, type GraphContextData } from "@/features/knowledge/ui/graph-context-card";
import { TopBar } from "@/app-shell/top-bar";
import type { ArtifactPartProps, TurnUsage } from "@/features/learning/core/chat";
import type { QuestionAnswerData } from "@/features/learning/core/question-core";
import type { SessionPricing } from "@/features/learning/core/prices";
import { PhaseChip, PhaseDivider } from "@/features/learning/ui/session/phase-divider";
import { CompactionCutDivider, CompactionMomentDivider, type CompactionDividerData } from "@/features/learning/ui/session/compaction-divider";
import { CoverageRing } from "@/features/knowledge/ui/extraction-coverage";
import { activeProblemOf } from "@/features/learning/core/native-messages";
import { dismissedAnswer } from "@/features/learning/core/question-core";
import { findPendingToolCall, toolQuestionKind } from "@/features/learning/core/pending";
import { phaseTimeline, teachStepIndex } from "@/features/learning/core/phases";
import { currentUserThinkingOpen, setAllUserThinkingOpen } from "@/features/learning/ui/messages/thinking-block";
import { slotsConfigured, type ModelsSettings } from "@/features/settings/core/settings";
import { useSettingsSaved } from "@/app-shell/settings-signal";
import { COLUMN } from "./chat-layout";
import { ChatActionsContext } from "./chat-actions-context";
import { escAbortTarget, initialPromptOwed, isSubagentSteer, parseModelsRefusal, parseProviderKeyRefusal } from "./chat-logic";
import { SessionDock } from "./session-dock";
import { PrintButton, printedOn } from "@/ui/print/print-button";

/** The quiet system line (custom-message scheme rendering): centered, muted,
 *  small — the transcript's voice for events that are not speech (wake
 *  scaffolding). */
function SystemLine({ children, testId }: { children: React.ReactNode; testId?: string }) {
	return (
		<div
			data-testid={testId}
			className="flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground"
		>
			{children}
		</div>
	);
}


/**
 * The teaching session. All chat state lives in useChat; the server persists
 * the canonical transcript after every turn.
 *
 * The bottom blob is ONE persistent shell whose contents swap (chat composer ↔
 * question dock ↔ collapsed bar). The shell is sticky INSIDE the scroller —
 * never overlapping the transcript at rest, never covering the scrollbar —
 * and DockOverlay animates its height on variant changes.
 */
export function Chat({
	chatId,
	title,
	initialMessages,
	initialPrompt,
	initiallyInFlight,
	initiallyCompacting = false,
	initialConfigured = false,
	kind = "teach",
}: {
	chatId: string;
	title: string;
	initialMessages: NeuroplastMessage[];
	/** The session kind (practice sessions, owner 2026-10-04): practice
	 *  renders no phase chip (no probe→teach arc applies) and a Practice
	 *  tag rides the header instead. */
	kind?: "teach" | "practice";
	initialPrompt?: string;
	/** A teacher turn is running server-side but attached to no client
	 * (navigated away mid-turn, returned while in flight). */
	initiallyInFlight?: boolean;
	/** A compaction holds the chat's model gate at mount (navigated away
	 * mid-compaction — the registry is live server state, the
	 * compaction-changed event already fired). The transcript spinner
	 * and send gates key on it. */
	initiallyCompacting?: boolean;
	/** slotsConfigured(server record) — the persistent setup CTA keys on
	 *  it (BYOK, owner 2026-09-22). The server gate stays the truth; this
	 *  only decides whether the pill rides the composer. */
	initialConfigured?: boolean;
}) {
	// Reattach plumbing (background-turn runner wave): the hook holds the
	// settled terminal's callback — a stable ref assigned below, once
	// syncFromServer exists (refs, not closures: no stale capture).
	const reattachSettledRef = useRef<() => void>(() => {});

	// THE SESSION HOOK (Wave D, owner-approved 2026-09-26): the app-owned
	// replacement for useChat + the AI-SDK transport. The record is native
	// history; the VIEW (grouped, golden-master) is derived client-side
	// (core/view.ts projectView); sends are ONE explicit input event each
	// ({chatId, input} — the stash indirection died with the SDK), and the
	// turn stream is the VERBATIM AgentEvent passthrough the server emits.
	const { messages, nativeMessages, contextTokens, send, steer, steerQueue, submitAnswer, dismissQuestion, dismissProblem, setMessages, adoptRecord, status, error, stop, clearError, resumeStream, setReattachSettled } =
		useChatSession({ chatId, initialMessages, initiallyInFlight });

	const sessionFindScopeRef = useRef<HTMLDivElement | null>(null);
	const scrollContextRef = useRef<StickToBottomContext | null>(null);
	const sourceTextParts = useMemo(() => firstSourceTextParts(messages), [messages]);

	// The reattach settled terminal → the sync-and-continue seam (below).
	setReattachSettled(() => reattachSettledRef.current());

	// New chat with a topic: send the first message exactly once
	// (initialPromptOwed — the pure gate, pinned in the test suite).
	const sentInitial = useRef(false);
	useEffect(() => {
		const prompt = initialPrompt || openingMessage(chatId);
		if (!sentInitial.current && initialPromptOwed(initialMessages, prompt)) {
			sentInitial.current = true;
			void send({ type: "text", text: prompt! });
		}
	}, [chatId, initialPrompt, initialMessages, send]);
	useEffect(() => {
		if (status === "ready" && nativeMessages.some(message => message.role === "user")) clearOpeningMessage(chatId);
	}, [chatId, nativeMessages, status]);

	// A turn running server-side, attached to no live view of ours (navigate
	// away mid-turn, or a wake turn discovered mid-session): the reattach
	// stream is the primary channel (resumeStream — the same rendering path
	// as a live turn); this flag is the FALLBACK liveness source — it gates
	// the composer, shows the pre-first-chunk shimmer, and drives the 1500ms
	// record poll that adopts at settle if the stream can't attach.
	const [turnInFlight, setTurnInFlight] = useState(initiallyInFlight ?? false);

	// Session title: click-to-rename (owner, 2026-09-17). Clicking the header
	// title opens edit mode with everything selected — typing replaces, arrows
	// move inside. Enter or a click away commits (PUT /api/chats/:id); Escape
	// discards. The server never bumps updatedAt on a rename (sidebar order
	// must not churn), and the sidebar patch is instant via the window event —
	// its 2.5s poll is only a backstop.
	const [titleText, setTitleText] = useState(title);
	const [renaming, setRenaming] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const titleInputRef = useRef<HTMLInputElement | null>(null);

	const commitRename = useCallback(
		async (next: string) => {
			setRenaming(false);
			const t = next.trim();
			if (t === "" || t === titleText) return; // empty commit = discard
			try {
				const res = await fetch(`/api/chats/${chatId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title: t }),
				});
				if (!res.ok) throw new Error(`rename failed: ${res.status}`);
				setTitleText(t);
				window.dispatchEvent(
					new CustomEvent("neuroplast:chat-renamed", { detail: { id: chatId, title: t } }),
				);
			} catch (err) {
				console.error("rename failed:", err); // keep the old title
			}
		},
		[chatId, titleText],
	);

	// Select-all when edit mode opens: the click means "replace", so the
	// whole title highlights on entry (owner ask, 2026-09-17).
	useEffect(() => {
		if (renaming) {
			const el = titleInputRef.current;
			if (el) {
					el.focus();
					el.select();
			}
		}
	}, [renaming]);

	// ── Keyboard seams (shortcut wave A, 2026-09-17) ──
	// F2 opens the title rename (the chat header owns the editing state).
	useEffect(() => {
		const onRename = () => {
			setTitleDraft(titleText);
			setRenaming(true);
		};
		window.addEventListener("neuroplast:kbd-rename-session", onRename);
		return () => window.removeEventListener("neuroplast:kbd-rename-session", onRename);
	}, [titleText]);

	// The OTHER rename surface (wave 6: the sidebar's inline rename): its
	// commit dispatches the same neuroplast:chat-renamed event this header's rename
	// does — if it renamed THIS chat, patch the header title in place (the
	// event is the single source of truth; the header is one more listener).
	useEffect(() => {
		const onRenamed = (e: Event) => {
			const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
			if (id === chatId) setTitleText((prev) => (title !== prev ? title : prev));
		};
		window.addEventListener("neuroplast:chat-renamed", onRenamed);
		return () => window.removeEventListener("neuroplast:chat-renamed", onRenamed);
	}, [chatId]);

	// The Esc chain's last link: abort the turn. The background runner
	// decoupled turns from views, so the abort is ALWAYS the remote kill
	// (POST /api/activity/abort — any in-flight turn dies server-side, our
	// view renders the aborted-partial close when the finish arrives). A
	// LOCAL view also detaches first — stop() settles the client instantly
	// and keeps the partial; the server-side partial persists via the
	// abort's own onFinish. Inert when nothing runs (busyRef gate).
	const abortInFlightTurn = useCallback(() => {
		if (localStreamRef.current) stop();
		void fetch("/api/activity/abort", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ kind: "turn", id: chatId }),
		}).catch(() => {
			/* transient — the turn settles on its own; the record poll adopts */
		});
		// 409 not_running is the benign raced-settle: the stream's finish
			// already settled the view (or the poll fallback adopts) — nothing owed.
	}, [chatId, stop]);
	// ESC-abort guard (owner, 2026-10-02): the abort chain opens a confirm
	// popup EVERYWHERE (streams and pending questions alike). Both window
	// listeners fire per Esc, so the state gate here — not stopPropagation
	// ordering — is what keeps the popup's own Esc from chaining.
	// LAYERED ESC (owner, 2026-10-04): an open overlay CLAIMS Esc — closing
	// itself — before the abort chain may open its confirm. A mermaid focus,
	// the plan popup, or the setup dialog over a pending question must not
	// dismiss the question underneath.
	const [abortAsk, setAbortAsk] = useState<AbortMode | null>(null);
	const abortAskRef = useRef<AbortMode | null>(null);
	abortAskRef.current = abortAsk;
	useEffect(() => {
		const onAbort = () => {
			const target = escAbortTarget({
				abortAsk: abortAskRef.current !== null,
				mermaidFocus: mermaidFocusRef.current !== null || figureFocusRef.current !== null,
				planOpen: planOpenRef.current,
				setupOpen: setupOpenRef.current,
				pending: pendingRef.current !== null,
				problem: activeProblemRef.current !== null,
				busy: busyRef.current,
			});
			if (target === "question") setAbortAsk("question");
			else if (target === "problem") setAbortAsk("problem");
			else if (target === "turn") setAbortAsk("turn");
			else if (target === "mermaid") setMermaidFocus(null);
			else if (target === "plan") setPlanOpen(false);
			// setup closes itself; null = nothing to do — both claimed.
		};
		window.addEventListener("neuroplast:kbd-abort-turn", onAbort);
		return () => window.removeEventListener("neuroplast:kbd-abort-turn", onAbort);
	}, []);
	const confirmAbort = useCallback(
		(mode: AbortMode) => {
			setAbortAsk(null);
			if (mode === "turn") {
				abortInFlightTurn();
				return;
			}
			// From a pending question the dismiss is silent (A2, 2026-10-03):
			// the skipped toolResult lands via the SILENT route, no turn, no
			// wake — the next plain send is the wake. MID-TURN (owner,
			// 2026-10-04 — the GLM loop): the question can only dangle because a
			// turn is STILL RUNNING, so the discard ALSO kills that turn; the
			// route parks the dismissal (202) and the settle applies it.
			const p = pendingRef.current;
			if (p) {
				const question = (p.input as { question?: string } | null)?.question ?? "";
				void dismissQuestion(p.toolCallId, dismissedAnswer(toolQuestionKind(p.tool), question));
				if (busyRef.current) abortInFlightTurn();
				return;
			}
			// The practice discard (owner, 2026-10-04): ask-style — the
			// silent marker route; the conclude synthesis rides the user's
			// next input. The composer returns immediately. Mid-turn the
			// discard also kills the running turn (same park + settle law).
			const problem = activeProblemRef.current;
			if (problem) {
				void dismissProblem(problem.toolCallId);
				if (busyRef.current) abortInFlightTurn();
			}
		},
		[abortInFlightTurn, dismissQuestion, dismissProblem],
	);
	// Mount continuation: if the stored transcript ends with a fulfilled tool
	// (a job result landed while no client was open), resume the lesson — the
	// SDK's sendAutomaticallyWhen only fires inside addToolOutput, so reloads
	// need this nudge. Once per mount; the turn that follows ends in text (or
	// a pending question), so no loop. NEVER while a turn is already running
	// server-side — that would double-run the teacher (the server would 409
	// it; the poll below resumes instead).
	const mountContinuation = useRef(false);
	useEffect(() => {
		if (mountContinuation.current) return;
		mountContinuation.current = true;
		if (!turnInFlight && status === "ready" && needsContinuation(initialMessages)) {
			void send({ type: "continue" });
		}
		// mount-only by design (turnInFlight read at initial value)
	}, []);

	const pending = findPendingToolCall(messages);
	// The abort handler reads the pending question from a ref (the window
	// listener is mount-scoped; the value it needs is render-scoped).
	const pendingRef = useRef(pending);
	pendingRef.current = pending;

	// THE ACTIVE PRACTICE PROBLEM (practice sessions, 2026-10-04): the
	// same dock-ownership rule as a pending question — an active problem
	// replaces the composer. Computed from the NATIVE record (the fold is
	// the gate the tools themselves read), not the projected view.
	const activeProblem = activeProblemOf(nativeMessages);
	const activeProblemRef = useRef(activeProblem);
	activeProblemRef.current = activeProblem;

	const localStream = status === "submitted" || status === "streaming";
	const busy = localStream || turnInFlight;
	const busyRef = useRef(busy);
	busyRef.current = busy;

	// The attach handoff (stream-reattach wave): the moment a resumed
	// stream takes over the rendering — the SDK left "ready", so
	// submitted/streaming means chunks are flowing — localStream covers
	// busy/shimmer/gates on its own. Keeping turnInFlight set would only
	// double-render the shimmer and keep the 1500ms fallback poll fighting
	// the live stream it was a fallback FOR.
	useEffect(() => {
		if (turnInFlight && (status === "submitted" || status === "streaming")) setTurnInFlight(false);
	}, [status, turnInFlight]);

	// Mid-session discovery (jobs poll, handoff watch): a server-side turn
	// exists that none of our views holds — attach to it through the same
	// resume path as mount reattach (live rendering, instant catch-up). The
	// flag stays as the fallback until the stream attaches (watcher above);
	// concurrent resume calls are SDK-guarded (a newer one aborts the older
	// request), so discovery ticks re-firing this are harmless.
	const turnInFlightRef = useRef(turnInFlight);
	turnInFlightRef.current = turnInFlight;
	const attachToRunningTurn = useCallback(() => {
		setTurnInFlight(true);
		void resumeStream();
	}, [resumeStream]);

	// The practice dock's send (ONE lane, owner 2026-10-05): POSTs the
	// thinking against the ACTIVE problem — whether it claims an answer is
	// read from the text by the agent, not declared here. Starts a turn;
	// the dock stays mounted (the problem is still active until the agent
	// concludes).
	const submitThinking = useCallback(
		(text: string) => {
			const problem = activeProblemRef.current;
			if (!problem) return;
			void send({ type: "thinking", problemCallId: problem.toolCallId, text });
		},
		[send],
	);

	// ⌘T (toggle-user-thinking, owner round 2026-10-07): set EVERY user
	// thinking row to one state — transcript rows default open, so the
	// first press collapses everything, the second re-expands.
	useEffect(() => {
		const onToggle = () => setAllUserThinkingOpen(!currentUserThinkingOpen());
		window.addEventListener(kbdEventForChat("toggle-user-thinking"), onToggle);
		return () => window.removeEventListener(kbdEventForChat("toggle-user-thinking"), onToggle);
	}, []);

	// The phase at every message (one linear fold): the transcript draws a
	// color-coded dotted divider at each boundary; the header chip reads the
	// session's current phase.
	const phases = useMemo(() => phaseTimeline(messages), [messages]);

	const [text, setText] = useState("");
	/* The composer's value MIRROR ("nothing gets lost" round, owner
	 * 2026-10-01): a dictation flush lands via setState, which a closure
	 * waiting through `await finish()` cannot observe in time. Kept
	 * current at every write site via applyText. */
	const textRef = useRef("");
	const applyText = useCallback((v: string) => {
		textRef.current = v;
		setText(v);
	}, []);
	// The BYOK setup flow (owner, 2026-09-22): the persistent CTA and the
	// refusal interception share one SetupDialog mount. `configured` is
	// seeded server-side (slotsConfigured on the record) and flips on Save.
	const [configured, setConfigured] = useState(initialConfigured);
	// The zero-keys truth (zero-keys wave): no provider key = the pill
	// takes precedence over the models CTA (keys come first in the chain).
	// Reads once on mount, re-reads on the "keys" signal.
	const zeroKeys = useZeroKeys();
	// Cross-surface freshness (fix wave): another surface's models write —
	// setup save, composer pick, a settings write — re-reads the record so
	// the setup CTA appears/disappears live (it used to lag until reload).
	useSettingsSaved((section) => {
		if (section !== "models") return;
		fetch("/api/settings")
			.then((r) => r.json() as Promise<{ settings?: { models?: ModelsSettings } | null } | null>)
			.then((body) => setConfigured(slotsConfigured(body?.settings?.models)))
			.catch(() => {});
	});
	const [setupOpen, setSetupOpen] = useState(false);
	/** The last explicitly-sent draft (composer send): the
	 *  refusal flow restores it into the composer, where it waits for the
	 *  learner to re-send (Save never auto-sends, owner 2026-10-09).
	 *  Auto-continuations (probe answers) never set it — their refusal
	 *  opens the dialog with no replay. */
	const draftRef = useRef<string | null>(null);

	// THE BYOK REFUSAL (owner, 2026-09-22): a send that lands the server's
	// 503 models_not_configured envelope renders as the SETUP FLOW, never
	// the error banner. The gate refuses BEFORE the write-ahead persist,
	// so the server record is the truth minus the refused send — the
	// optimistic message is an orphan that goes HOME: refetch the record,
	// drop the orphan, put the draft back in the composer, open the
	// dialog (the prefilled tiers carry their picks, the unpinned ones the
	// "needed" marks). The draft stays in the composer until the learner
	// re-sends it (owner ruling 2026-10-09).
	useEffect(() => {
		if (!error) return;
		const missing = parseModelsRefusal(error.message);
		// The key-refusal twin (zero-keys wave): a pinned model whose
		// provider key is gone gets the SAME treatment — revert-draft and
		// open setup (the dialog derives to its first-key stage on its own).
		const keyRefused = parseProviderKeyRefusal(error.message);
		if (!missing && !keyRefused) return; // a real error keeps the honest banner
		// ORDER MATTERS: clearError() flips this effect's own dep (`error`)
		// and would cancel the in-flight work below — so the banner dismiss,
		// the draft restore, and the dialog open all land TOGETHER after the
		// record refetch (the honest truth minus the refused send).
		let cancelled = false;
		void (async () => {
			const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
			if (!cancelled && res.ok) {
				const record = (await res.json().catch(() => null)) as { messages?: NeuroplastMessage[] } | null;
				if (Array.isArray(record?.messages)) setMessages(record.messages);
			}
			if (cancelled) return;
			if (draftRef.current !== null) {
				applyText(draftRef.current);
				draftRef.current = null;
			}
			clearError();
			setSetupOpen(true);
		})();
		return () => {
			cancelled = true;
		};
		// (setMessages/clearError are stable per useChat instance — the
		//  dep pair [error, chatId] is what the flow actually keys on.)
	}, [error, chatId]);
	// Voice dictation (STT wave, 2026-09-17): finals append at the end of
	// the current text (the page owns the separator, dictate-flush style);
	// interims ghost in the stats bar's middle slot next to the meter.
	// TAB CYCLES THE CHAT'S FIELDS (owner, keyboard round 2026-10-06):
	// reading-thinking → the active dock's field → the composer, in
	// visual order, forward-only with wrap; Tab from anywhere else
	// focuses the first live field (navigate IN). Gathered from live
	// DOM at event time — the docks mount and unmount, refs would go
	// stale. The quiz dock's rows↔thinking claim never reaches here.
	const cycleChatFields = useCallback((): readonly HTMLElement[] => {
		const pick = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
		return [
			...pick('[data-testid="reading-thinking-field"] textarea'),
			...pick('[data-testid="question-dock"] textarea'),
			...pick('[data-testid="practice-dock"] textarea'),
			...pick('[data-testid="composer"] textarea'),
		];
	}, []);
	useFieldCycle(cycleChatFields);
	const dictation = useDictation({
		// Ref-first (see textRef): the join is computed from the mirror so a
		// send resuming after `await finish()` reads the dictated tail.
		append: (t) => applyText(joinDictation(textRef.current, t)),
	});
	/* When a dictation run ends, the bare composer takes focus (owner
	 * 2026-10-01) — the hands are already on the keyboard from the stop.
	 * Falling edge of `active` only (idle→idle never focuses), and ONLY the
	 * composer: with a question pending the Composer is unmounted, the ref
	 * is null, and the thinking field is left alone by design. */
	const dictationWasActiveRef = useRef(false);
	const composerInputRef = useRef<HTMLTextAreaElement>(null);
	useEffect(() => {
		if (dictation.active) {
			dictationWasActiveRef.current = true;
		} else if (dictationWasActiveRef.current) {
			dictationWasActiveRef.current = false;
			composerInputRef.current?.focus();
		}
	}, [dictation.active]);

	// Jobs never gate the composer (contracts.ts "THE ASYNC PROTOCOL" §4): job
	// tools resolve with an ack mid-turn, so the learner can interject while
	// sub-agents run — a feature, not a race: the wake pipeline queues steers
	// until the current turn ends. Only a QUESTION pending or a turn in
	// flight (client or server-side wake turn) gates sending.
	// A LIVE dictation also makes the composer sendable (owner 2026-10-01):
	// the spoken text is deferred in the run's buffer — Enter must be able
	// to trigger the finish-first send (see onSend), not be gated out by an
	// empty textarea. If nothing was said, the send is a harmless no-op.
	// Steering (2026-10-03): a turn in flight no longer gates the composer —
	// Enter while a turn runs STEERS it (the quiet queue above the composer);
	// a pending question still owns the interaction (the dock replaces the
	// composer, and there is no live turn to steer anyway — questions end
	// turns).
	// Compaction (owner round 14): the RUNNING state — compaction-changed
	// flips it; the send paths, canSend, and the docks gate on it (the
	// server's registry mutex is the structural gate; this is the
	// affordance).
	const [compacting, setCompacting] = useState(initiallyCompacting);
	const canSend =
		(text.trim().length > 0 || dictation.active) && !pending && !activeProblem && !compacting;

	/* THE PRACTICE PAUSE (owner round 16): between problems — practice
	 * kind, nothing active, nothing in flight, and at least one problem
	 * has ever been posed (the fresh session's opening turn is owed, not
	 * the move-on). Enter-on-empty and the Next chip both key on it. */
	const nextReady =
		kind === "practice" &&
		!pending &&
		!activeProblem &&
		!compacting &&
		!busy &&
		nativeMessages.some(
			(m) => (m as { role?: string }).role === "assistant" &&
				Array.isArray((m as { content?: unknown[] }).content) &&
				(m as { content: Array<{ type?: string; name?: string }> }).content.some(
					(b) => b.type === "toolCall" && b.name === "problem",
				),
		);
	const sendNext = useCallback(() => {
		if (!nextReady) return;
		void send({ type: "next" });
	}, [nextReady, send]);

	/* ENTER FROM ANYWHERE (owner round 16 refinement, 2026-10-06 —
	 * keyboard-first): the move-on must not require composer focus. The
	 * window-level Enter (typing surfaces and buttons excluded — a
	 * focused composer/button keeps its own lane, so no double fire)
	 * fires the signal from body focus, a scroll, anywhere. sendNext
	 * self-guards on nextReady, so the listener is inert outside the
	 * pause — the dock-mounted listeners are gone by then (docks unmount
	 * when nothing is active; the two never overlap). */
	useEnterSubmits(sendNext);

	const syncFromServer = useCallback(async () => {
		const res = await fetch(`/api/chats/${chatId}`);
		if (!res.ok) return;
		const record = (await res.json()) as { messages?: NeuroplastMessage[]; turns?: TurnUsage[]; pricing?: SessionPricing };
		if (Array.isArray(record.turns)) setTurns(record.turns);
		setPricing(record.pricing);
		if (!Array.isArray(record.messages)) return;
		setMessages(record.messages);
		// The continuation seam (contracts.ts protocol §4): a job result
		// landing in the record leaves the agent owing a continuation — the
		// record ENDS on un-consumed results, the dock owns no question, and
		// nothing runs. The native fold (needsContinuation) is the old SDK
		// lastAssistantMessageIsCompleteWithToolCalls check.
		if (status === "ready" && needsContinuation(record.messages)) {
			void send({ type: "continue" });
		}
	}, [chatId, setMessages, send, status]);

	// The settled terminal's other half (stream-reattach wave): the
	// transport resolved turn-settled — no turn running, the record is
	// current. Drop the fallback busy state and adopt the record (its
	// continuation check fires the owed next turn, exactly as the poll's
	// settle branch always did).
	reattachSettledRef.current = () => {
		setTurnInFlight(false);
		void syncFromServer();
	};

	// ── Append-only record adoption (owner ground rules, 2026-09-15) ──
	// Content delivered into the record server-side — sub-agent
	// artifacts, abort notes — must become visible the
	// moment it persists, mid-turn included: it sits between messages, and
	// nothing about a running turn should hide it. The full snapshot sync
	// mid-stream is forbidden (it breaks the SDK's in-place continuation
	// merge — the stale-snapshot lesson), so adoption here is APPEND-ONLY
	// (the session hook's adoptRecord): insert the record's new ids in their canonical
	// order, never rewrite a local one, keep the in-flight tail last. The
	// full syncFromServer stays the net at idle (reorder, plan blocks, turns).
	const adoptAppendOnly = useCallback(async () => {
		try {
			const res = await fetch(`/api/chats/${chatId}`);
			if (!res.ok) return;
			const record = (await res.json()) as { messages?: NeuroplastMessage[] };
			if (!Array.isArray(record.messages)) return;
			adoptRecord(record.messages);
		} catch {
			/* transient — the idle full sync is the net */
		}
	}, [chatId, adoptRecord]);

	// Turn-start window: the server inserts claimed steers right after our
	// outgoing message, BEFORE the stream produces anything — so a bounded,
	// self-terminating window of three record fetches (400ms/1s/2s) catches
	// the insert and shows the marker during the turn, then stops. No
	// standing poll — the window exists only for these seconds. (The dock
	// nudges that lived here died at S5: dispatch writes announce jobs-changed
	// from the store, extraction announces activity-changed at setPhase.)
	const turnStartStatusRef = useRef(status);
	// The window must survive the submitted→streaming flip (the stream starts
	// in well under 400ms), so the timers are guarded by this ref — dropped at
	// unmount, left alone otherwise: the window self-terminates after 2s.
	const adoptionWindowOpenRef = useRef(false);
	const turnStartTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
	useEffect(() => {
		const was = turnStartStatusRef.current;
		turnStartStatusRef.current = status;
		if (was === "submitted" || status !== "submitted") return;
		// A turn just started (status flipped ready → submitted): open the
		// bounded adoption window.
		adoptionWindowOpenRef.current = true;
		const timers = [400, 1000, 2000].map((ms) =>
			setTimeout(() => {
				if (adoptionWindowOpenRef.current) {
					void adoptAppendOnly();
				}
			}, ms),
		);
		// Deliberately no cleanup here: this effect re-runs on every status
		// flip, which would cancel the window at submitted→streaming.
		timers.forEach((t) => {
			turnStartTimerRefs.current.push(t);
		});
	}, [status, adoptAppendOnly]);
	useEffect(() => {
		const timers = turnStartTimerRefs;
		return () => {
			adoptionWindowOpenRef.current = false;
			timers.current.forEach(clearTimeout);
			timers.current = [];
		};
	}, []);

	// The live plan popup (wave 4): opened by any transcript plan block, the
	// top-bar plan chip, and the dock band's marginalia.
	const [planOpen, setPlanOpen] = useState(false);
	// The coverage ring's refresh chain (extraction-UX redesign): bumped at
	// turn settle — the moment this session's uncovered mass changes.
	const [coverageTick, setCoverageTick] = useState(0);
	// The mermaid focus (chrome-melt wave, 2026-09-19): md-blocks' expand
	// button registers the chart source here; the overlay (and the plan
	// popup) mount INSIDE the session-area div — both are session-scoped, so
	// the drag bar stays sharp and draggable while a focus owns the area.
	const [mermaidFocus, setMermaidFocus] = useState<string | null>(null);
	// Figure focus (2026-10-07): the figure card's fullscreen button — same
	// overlay shell as mermaid, but carrying the raw svg + the card's invert
	// state so the fullscreen view stays faithful to the toggled card.
	const [figureFocus, setFigureFocus] = useState<{ svg: string; inverted: boolean } | null>(null);

	// Overlay mirrors for the layered-Esc gate (owner 2026-10-04): the
	// neuroplast:kbd-abort-turn handler reads these at EVENT time — declared here
	// beside their states, consumed below wherever the states live.
	const mermaidFocusRef = useRef(mermaidFocus);
	mermaidFocusRef.current = mermaidFocus;
	// The figure focus rides the mermaid layer in the Esc gate — the same
	// overlay class (session-scoped diagram focus, Esc claimed at the
	// document level by the overlay itself); the window chain must stay out.
	const figureFocusRef = useRef(figureFocus);
	figureFocusRef.current = figureFocus;
	const planOpenRef = useRef(planOpen);
	planOpenRef.current = planOpen;
	const setupOpenRef = useRef(setupOpen);
	setupOpenRef.current = setupOpen;
	// The session's live plan (drives the top-bar chip; the marginalia
	// derives its own from the same transcript).
	const planTree = useMemo(() => latestTree(messages), [messages]);

	// ── Session usage (wave-4 stats bar) ──
	// The money channel: the record's turns log and read-time server Pi
	// pricing projection. Seeded once on mount (the page doesn't carry turns),
	// refreshed when the local stream settles (each turn appends to the log
	// server-side), and kept fresh by syncFromServer whenever it already
	// fetches the record. No turns yet → the bar renders "—" everywhere.
	const [turns, setTurns] = useState<TurnUsage[]>([]);
	const [pricing, setPricing] = useState<SessionPricing | undefined>();
	// The per-chat model control state (model-picker writes via PUT; the
	// record is the source of truth, lifted here so the stats bar re-renders).
	const syncTurns = useCallback(async () => {
		try {
			const res = await fetch(`/api/chats/${chatId}`);
			if (!res.ok) return;
			const record = (await res.json()) as { turns?: TurnUsage[]; pricing?: SessionPricing };
			if (Array.isArray(record.turns)) setTurns(record.turns);
			setPricing(record.pricing);
		} catch {
			// transient blip: stats stay on the last known figures
		}
	}, [chatId]);
	useEffect(() => {
		void syncTurns();
	}, [syncTurns]);
	// After the learner's own turn ends the log has a fresh entry — and the
	// Post-turn settle (the SLIMMED watch — push-architecture S3,
	// 2026-10-02): our own stream just ended. Two instant LOCAL actions
	// only — the turns-only refetch lands the log entry while the server's
	// persist/endTurn lags by milliseconds, and the coverage ring re-reads
	// (this turn's messages just joined the uncovered mass). The ADOPTION
	// LOOP and the HANDOFF WATCH that lived here are RETIRED: a
	// server-initiated turn (the probe→teach handoff, a job wake, another
	// tab) is now ANNOUNCED on the events channel — the turn-started
	// subscription (below the jobs poll) attaches to it live. No polling
	// window can expire; the freeze class is gone.
	const prevStatusRef = useRef(status);
	useEffect(() => {
		const transitioned = prevStatusRef.current !== "ready" && status === "ready";
		// Every path (the old early-return skipped this on the transition
		// branch — the re-fire-on-dep-churn wart, fixed S3).
		prevStatusRef.current = status;
		if (!transitioned) return;
		// immediate: turns-only refetch — the stats bar updates even while
		// the server's persist/endTurn lags the client by milliseconds
		void syncTurns();
		// The coverage ring re-reads at turn settle too (extraction-UX
		// redesign, 2026-09-24); the ring's own running-poll handles runs.
		setCoverageTick((t) => t + 1);
		// CANONIZATION (fix B, the duplicate-previous-message bug, 2026-10-02):
		// turn-settled for OUR OWN turn arrives while the stream is still open
		// (endTurn emits from onFinish before the response terminates, so the
		// SSE frame reliably beats [DONE]) — the handler below cannot sync
		// there, it flags instead, and THIS flip consumes the flag: the record
		// is guaranteed durable (endTurn fires only after persistTurn, the S2
		// ordering law), so replacing the view onto it absorbs the tail's
		// streamed c_-id copies into base under their server ids. Without
		// this the tail kept those copies forever and the next send's
		// steer-adoption window rendered them a second time. The wake handoff
		// cannot be missed by this sync: the wake fires only after the idle
		// gates + grace (≥750ms past this flip), so its turn-started event
		// lands at an idle, already-canonical view and attaches normally.
		if (settleAnnouncedRef.current) {
			settleAnnouncedRef.current = false;
			void syncFromServer();
		}
		// (The extraction-discovery nudges that lived here died at S5: the
		// pipeline announces every phase on the events channel.)
	}, [status, syncTurns, syncFromServer]);

	// A stream that died MID-FLIGHT (network): the runner decoupled the turn
	// from its view, so the server turn runs ON behind the error banner —
	// re-enter the in-flight watch (the 1500ms fallback poll adopts at
	// settle) instead of leaving the session blind until the next send's
	// 409 merge-retry heals it. One record check per error transition.
	const prevErrorStatusRef = useRef(status);
	useEffect(() => {
		const was = prevErrorStatusRef.current;
		prevErrorStatusRef.current = status;
		if (was === "error" || status !== "error") return;
		let cancelled = false;
		void (async () => {
			try {
				const res = await fetch(`/api/chats/${chatId}`);
				if (!res.ok || cancelled) return;
				const record = (await res.json()) as { turnInFlight?: boolean };
				if (cancelled) return;
				if (record.turnInFlight === true) setTurnInFlight(true);
				else void syncFromServer();
			} catch {
				/* transient — the banner stands; the next send's merge-retry heals */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [status, chatId, syncFromServer]);

	// Central job observability: see use-chat-jobs.ts.
	const jobs = useChatJobs({ chatId, localStream, syncFromServer, adoptAppendOnly });
	const localStreamRef = useRef(false);
	localStreamRef.current = localStream;

	// ── Server-initiated turn discovery (push-architecture S3, 2026-10-02) ──
	// Every turn THIS chat runs is announced on the events channel — the
	// probe→teach handoff, a job wake, another tab's send, the
	// missed-on-mount case. This replaces the retired watch loop and the
	// 1500ms fallback record poll: discovery is no longer a polling window
	// that can expire. Handlers read REFS, not closure state — events fire
	// between renders, and a ref holds the live value at event time.
	const statusRef = useRef(status);
	statusRef.current = status;
	/** Fix B (2026-10-02): turn-settled arrived for OUR OWN turn — the
	 * record is durable (endTurn fires only after persistTurn); the ready
	 * flip consumes this flag to canonize the view onto the record. See the
	 * settle effect and the turn-settled handler below. */
	const settleAnnouncedRef = useRef(false);
	useServerEvent("turn-started", (p) => {
		// Known non-issue: beginTurn emits before registerTurn in the same
		// synchronous request flow; a GET /stream inside that sub-ms window
		// gets a settled response — unwinnable by a network round-trip,
		// self-healing via the eventual turn-settled. Do not engineer around.
		if (p.chatId !== chatId) return;
		if (localStreamRef.current) return; // our OWN turn — the 409-race guard
		if (turnInFlightRef.current) return; // already attached
		attachToRunningTurn();
	});
	useServerEvent("turn-settled", (p) => {
		if (p.chatId !== chatId) return;
		if (localStreamRef.current) {
			// Our own [DONE] path owns the BUSY settle — but not a no-op (fix B,
			// 2026-10-02): the event is the record-durable guarantee (endTurn
			// fires only after persistTurn), and it reliably beats [DONE] here
			// (endTurn emits from onFinish before the response terminates). Flag
			// it; the ready flip consumes the flag and canonizes the view onto
			// the record. (If [DONE] somehow won this race instead, this branch
			// didn't run and the fully-idle branch below already synced.)
			settleAnnouncedRef.current = true;
			return;
		}
		if (turnInFlightRef.current) {
			// The attached stream's terminal frame owns the normal settle —
			// syncing HERE would swap a stale snapshot mid-stream (the
			// continuation-coalescing law, see the jobs poll above). Only
			// the error case heals: the attached stream died, and the settle
			// says persistTurn has made the record durable truth.
			if (statusRef.current === "error") {
				setTurnInFlight(false);
				clearError();
				void syncFromServer();
			}
			return;
		}
		// Fully idle — a turn we never saw (every window missed): adopt now.
		void syncFromServer();
	});
	useServerEvent("compaction-changed", (p) => {
		// The settle-kick's background summary: while it runs, sends gate
		// (the next turn's server-side ensureCompacted awaits it anyway —
		// this only keeps the affordance honest). On finish, record-changed
		// (emitted by the compaction write itself) carries the marker in.
		if (p.chatId !== chatId) return;
		setCompacting(p.running);
	});
	useServerEvent("record-changed", (p) => {
		// The silent dismissal write (A2, 2026-10-03): no turn ever ran, so
		// only the record moved. Other tabs and post-error windows adopt;
		// our OWN dismissal already rendered its optimistic append — syncing
		// here too is harmless (the adoption law swaps local ids for the
		// server's). Busy states ignore it: a running turn owns the view,
		// and the write is 409-guarded against exactly that anyway.
		if (p.chatId !== chatId) return;
		if (localStreamRef.current || turnInFlightRef.current) return;
		void syncFromServer();
	});

	const onSend = () => {
		if (pending || compacting) return;
		/* FINISH DICTATION FIRST (owner, 2026-10-01): a learner who keeps
		 * talking right through Enter must not lose the tail — stop the run,
		 * let the last finals land in the composer, then send the REF value
		 * (the flush lands via setState, invisible to this closure). */
		if (!dictation.active) {
			doSteerOrSend();
			return;
		}
		void dictation.finish().then(doSteerOrSend);
	};
	const doSend = () => {
		if (busy || pending || compacting) return;
		const t = textRef.current.trim();
		if (!t) return;
		draftRef.current = t; // the refusal flow's preserve-and-replay seam
		applyText("");
		void send({ type: "text", text: t });
	};

	/* STEER VS SEND (owner arc 2026-10-03): a send while a turn runs steers
	 * it — the quiet queue + the live agent's steering rail; the turn's own
	 * stream lands the card when pi drains it. The branch is BUSY, not
	 * turnInFlight: the own-stream case CLEARS turnInFlight (the local
	 * dedup, chat.tsx ~370), so branching there swallowed Enter entirely
	 * during our own turn (owner live report, fixed same day). busy covers
	 * own stream AND foreign/wake turns — both have a live agent by the
	 * time the send's POST resolved, so the steer lands. Idle takes the
	 * plain send; a raced settle 409s and falls back to exactly that. */
	const doSteerOrSend = () => {
		if (pending || compacting) return;
		const t = textRef.current.trim();
		if (!t) return;
		if (busy) {
			applyText("");
			void steer(t);
			return;
		}
		doSend();
	};

	return (
		<ChatActionsContext.Provider
			value={{
				chatId,
				syncFromServer,
				sendText: (t: string) => {
					void send({ type: "text", text: t });
				},
				openSetup: () => setSetupOpen(true),
			}}
		>
		<SessionMermaidContext.Provider
			value={{
				openMermaid: setMermaidFocus,
				openFigure: (svg, inverted) => setFigureFocus({ svg, inverted }),
			}}
		>
		<JobsContext.Provider value={jobs}>
		{/* The session surface: the transcript column (header + scroller) and
		    the plan-tree panel as full-height SIBLINGS — the panel spans top to
		    bottom exactly like the left sidebar, and the header (name + phase
		    chip) spans from the left sidebar's edge to the panel's edge. The
		    dock overlays the column bottom (outside the scroller); a spacer in
		    the transcript reserves its height. */}
		<div data-print-flow className="integrated-session flex h-full min-h-0">
			<div data-print-flow className="flex min-w-0 flex-1 flex-col">
				{/* The top bar is its own block (owner, top-fade round 4): in flow
				    above the scroller on the plain page background — no gradient. Its
				    bottom outline (border-b border-border) matches the one that
				    separates the left sidebar — same width, same color (owner, r5).
				    h-15 (60px), not py-2: the toggle (a size-9 icon button) renders
				    only while the sidebar is CLOSED — an auto-height row would
				    collapse when it disappears and slide the title + chip up.
				    60px is an ALIGNMENT, not just a size: it equals the sidebar's
				    LH wordmark band, so the header's border-b continues that
				    band's bottom edge as one line across the app (owner, round 6). */}
				<TopBar
					// While renaming the bar is NOT a drag surface: app-region:drag
					// would eat the mousedown, so click-to-escape (below) could
					// never fire. Rename mode is interactive mode (owner ask) —
					// TopBar's one escape hatch.
					drag={!renaming}
					onMouseDown={(e) => {
						// Escape hitbox: any mousedown outside the input itself blurs
						// it, running the existing onBlur commit path. The input is
						// shrink-to-fit (field-sizing), so the rest of the bar is
						// this spacer + inert chips — all click-to-exit (owner ask).
						if (renaming && e.target !== titleInputRef.current) titleInputRef.current?.blur();
					}}
				>
					{renaming ? (
						<>
							<input
								ref={titleInputRef}
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") void commitRename(titleDraft);
									// stopPropagation claims the Esc (keyboard wave A):
									// closing rename must not also abort a turn.
									else if (e.key === "Escape") {
										e.stopPropagation();
										setRenaming(false);
									}
								}}
								onBlur={() => void commitRename(titleDraft)}
								spellCheck={false}
								aria-label="Session title"
								title="Rename this session"
								className="neuroplast-no-drag min-w-[8ch] max-w-[70%] shrink-0 bg-transparent font-title text-3xl tracking-tight caret-current outline-none [field-sizing:content]"
							/>
							{/* flex-1 spacer during rename too, so the chips stay at
							    the right edge; clicks here commit via the header
							    mousedown handler. */}
							<div className="min-w-4 flex-1" aria-hidden="true" />
						</>
					) : (
					<>
						<Hint
							// F2 renames (registry) — surfaced on the hover.
							label="Rename session"
							action="rename-session"
							side="bottom"
						>
<button
							type="button"
														onClick={() => {
								setTitleDraft(titleText);
								setRenaming(true);
							}}
							className="neuroplast-no-drag -mx-1.5 min-w-4 shrink cursor-text truncate rounded-md px-1.5 text-left font-title text-3xl tracking-tight transition-colors hover:bg-accent"
						>
							{titleText}
							</button>
						</Hint>
							{/* flex-1 spacer: keeps the chips at the right edge AND stays a
							    drag surface (no carve-out) — the freed bar is grippable. */}
							<div className="min-w-4 flex-1" aria-hidden="true" />
					</>
					)}
					<PrintButton label="Print" className="neuroplast-no-drag shrink-0" />
					{/* The plan chip: session-level structure beside the phase
					    chip — opens the full diagram; the outline at the top of
					    the page is the glance view. */}
					{planTree && (
						<Hint label="Open the full plan" side="bottom">
<button
							type="button"
							data-testid="plan-chip"
							onClick={(e) => {
								blurAfterPointerClick(e);
								setPlanOpen(true);
							}}
							className="neuroplast-no-drag flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border/80 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:border-border hover:text-foreground"
						>
							<WaypointsIcon className="size-3.5 text-primary" aria-hidden />
							Plan
						</button>
</Hint>
					)}
					{/* The extraction ring (owner-locked redesign, 2026-09-24): fills
					    with uncovered vs the chunk threshold, pulses while a run is in
					    flight, vanishes when the graph is off. Click → the exact
					    numbers. Before the phase label — the chips cluster right. */}
					{/* Practice (owner, 2026-10-04): the coverage ring hides —
				    practice never extracts, so an ever-filling ring with no
				    run behind it would lie. */}
					{kind !== "practice" && <CoverageRing chatId={chatId} refreshKey={coverageTick} />}
					{/* Practice sessions: no phase arc — a quiet Practice tag
					    instead of the phase chip. */}
					{kind === "practice" ? (
						<span
							data-testid="phase-chip"
							data-phase="practice"
							aria-hidden="true"
							className="pointer-events-none flex shrink-0 select-none items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>
							<DumbbellIcon className="size-3" />
							Practice
						</span>
					) : (
						<PhaseChip phase={phases.at(-1) ?? "probe"} />
					)}
				</TopBar>

				<SessionFind scopeRef={sessionFindScopeRef} scrollContextRef={scrollContextRef} />
				<div data-print-flow ref={sessionFindScopeRef} className="relative flex min-h-0 flex-1">
				<Conversation data-print-flow className="h-full min-w-0 flex-1" initial="instant" contextRef={scrollContextRef}>
					<SessionMessageNavigation />
					<ConversationContent className="min-h-full gap-0 p-0">
						<div data-session-find-root="" className={`${COLUMN} flex flex-1 flex-col gap-4 pt-4`}>
							<p className="print-only print-header" suppressHydrationWarning><strong>{titleText}</strong> · Learn session · Printed {printedOn()}</p>
							<PlanOutline messages={messages} onOpen={() => setPlanOpen(true)} />
							{messages.length === 0 && !busy && (
								<ConversationEmptyState
									title="New session"
									description="The teacher will open by probing what you already know."
								/>
							)}

							{messages.map((m, mi) =>
								m.role === "user" && isSubagentSteer(m) ? (
									// Sub-agent delivery (wake-pipeline steer): NO message bubble — the
									// artifact card sits in the transcript column directly, full width
									// and centered like the teacher's artifacts (contracts.ts "THE ASYNC
									// PROTOCOL" §4). Key fallback: legacy transcripts (pre id-hygiene)
									// can still hold empty ids — the index keeps keys unique for them.
									<SubagentSteerCard key={m.id || `m-${mi}`} message={m} />
								) : m.role === "user" && m.parts.some((p) => p.type === "data-probe-handoff") ? (
								// The probe→teach handoff wake (custom-message scheme): the
								// PLANNING DIVIDER IS the seam (owner ruling 2026-09-26 — it
								// replaced the "Preparing your plan…" system line; the marker
								// renders in the right spot by record construction, so the old
								// fold-based divider — which floated to the transcript top once
								// Wave D grouping merged the whole probe into one giant
								// assistant group — is gone). Never a user bubble: the wake is
								// scaffolding; the model-facing instruction lives in the adapter.
								<PhaseDivider key={m.id || `m-${mi}`} phase="plan" />
							) : m.role === "user" && m.parts.length > 0 && m.parts.every((p) => p.type.startsWith("data-")) ? (
								// Marker cards (custom messages, 2026-10-04): user-side
								// scaffolding — the graph-context pick, the practice
								// thinking trace — render as cards in the transcript
								// column directly, NO chat bubble (the subagent-steer
								// precedent). The user branch below renders text only;
								// without this hoist a data-only message read as an
								// EMPTY bubble (owner report, 2026-10-04).
								<Fragment key={m.id || `m-${mi}`}>
									{m.parts.map((part, pi) => {
										switch (part.type) {
											case "data-graph-context":
												return <GraphContextCard key={pi} data={part.data as GraphContextData} />;
											case "data-compaction":
												return <CompactionMomentDivider key={pi} data={part.data as CompactionDividerData} />;
											case "data-compaction-cut":
												return <CompactionCutDivider key={pi} data={part.data as CompactionDividerData} />;
											case "data-practice-thinking":
												return <ThinkingCard key={pi} data={part.data as PracticeThinkingData} />;
											case "data-practice-next":
												// The learner's move-on signal (owner round 16): a compact
												// centered mono-caps line — chrome, the dismissal register.
												return (
													<div
														key={pi}
														data-testid="practice-next-line"
														className="my-4 flex items-center justify-center gap-1.5 font-ui text-xs font-medium uppercase tracking-wide text-muted-foreground"
													>
														<ArrowRightIcon className="size-3" />
														Next problem
													</div>
												);
											default:
												return null;
										}
									})}
								</Fragment>
							) : (
									<Fragment key={m.id || `m-${mi}`}>
									{/* THE INFERRED TEACH SEAM (owner ruling 2026-09-26, the verdict
									death): teaching begins where the FIRST nodeId-tagged quiz is
									posed — the fold (phaseTimeline, the same derivation the phase chip
									reads) flips to teach exactly AT this assistant group. STEP-LEVEL
									since owner round 8 (2026-10-05 — the stacked-dividers bug): the
									plan presentation often lives in the SAME message, an earlier
									provider step than the quiz call, and the old message-level seam
									drew this divider before the plan too (Planning and Teaching
									stacked back-to-back, nothing between). teachStepIndex finds the
									step boundary governing the flip call: -1 = the message's first
									step → prepend before the whole block (this branch); a later
									index → the divider renders AT that part boundary in the loop
									below (replacing the plain step hairline — a labeled phase rule
									supersedes it). The boundary check (this index flips, the
									previous didn't) still guarantees exactly ONE divider per session.
									PREPENDED, never a replacement branch: the teach group is a real
									message with content — a replacement ternary swallowed the entire
									first lesson block (the Lacan session, 2026-09-27). */}
									{m.role === "assistant" &&
									mi > 0 &&
									phases[mi] === "teach" &&
									phases[mi - 1] !== "teach" &&
									teachStepIndex(m.parts) === -1 ? (
										<PhaseDivider key={`teach-${m.id || `m-${mi}`}`} phase="teach" />
									) : null}
									{m.role === "user" ? (
										/* THE DOCUMENT ROW (owner round, 2026-10-05): no right-aligned
										    bubble — the transcript reads as a document. User text is a
										    full-width quote block: muted "You" label, muted rail,
										    FULL-opacity text (learner words are content, not whisper).
										    Distinguished from user thinking at a glance: thinking is
										    collapsed + 50% italic; this is upright and present.
										    User text renders plain — the model's LaTeX pipeline is not
										    applied to learner-authored text ($ stays $, no surprises).
										    Rendered WITHOUT the Message wrapper — that is the bubble. */
											<div
										data-testid="user-message"
										/* THE DOCUMENT, ALL-IN (owner rounds two+three, 2026-10-07):
										    no chat side — the user message is a full-width card-color
										    BAND, the IDENTICAL geometry as the thinking rows: 5px band
										    padding, the left gap matches it, the rail fills the 3ch
										    inset (the band is the authorship mark against the agent's
										    transparent prose). The "You" label stays — one register
										    with the thinking labels. */
										className="my-2 w-full border-l-[calc(3ch-14px)] border-muted-foreground/30 bg-card py-1 pl-[14px] pr-4 font-ui text-xs"
									>
												{/* The rail GROUPS (owner round 4, 2026-10-05): the YOU heading
												    sits INSIDE the rail, same mono-xs register and same 1ch
												    rail as the thinking rows — one quote geometry. */}
												<div className="font-medium uppercase tracking-wide text-muted-foreground">You</div>
												<div className="neuroplast-prose whitespace-pre-wrap text-foreground">
													{m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n")}
												</div>
											</div>
									) : (
									<Message from="assistant" className="max-w-full">
									<MessageContent className="w-full">
											{m.parts.map((part, pi) => {
												const isLastPart = mi === messages.length - 1 && pi === m.parts.length - 1;
												// The step boundary where teaching begins (round 8): when
												// the teach flip happens in a LATER step, its PhaseDivider
												// replaces this boundary's plain hairline.
												const teachBoundary =
													m.role === "assistant" &&
													mi > 0 &&
													phases[mi] === "teach" &&
													phases[mi - 1] !== "teach" &&
													teachStepIndex(m.parts) === pi;
												// A tool call that errored BACK TO THE AGENT (validation
												// failure, malformed args) is invisible work — the agent
												// reads the error and retries. Owner ruling 2026-09-26:
												// surface the retry loop as one quiet line, any tool,
												// instead of silence (question tools used to render null,
												// so a flailing quiz loop read as a stall). Aborts are
												// terminal — nothing retries — so they stay silent.
												if (
													part.state === "output-error" &&
													part.type.startsWith("tool-") &&
													part.errorText !== "Operation aborted"
												) {
													return (
														<SystemLine key={`retry-${pi}`} testId="tool-retry">
															Retrying…
														</SystemLine>
													);
												}
												switch (part.type) {
													case "text": {
														const sourceId = textPartMessageId(part.id);
														const anchor = sourceId && sourceTextParts.get(sourceId) === part.id ? messageAnchorId(sourceId) : undefined;
														return (
															<div key={part.id || pi} id={anchor} data-source-message-id={sourceId ?? undefined} className="neuroplast-source-passage">
																<MessageResponse>{part.text}</MessageResponse>
															</div>
														);
													}
													case "reasoning":
														return (
															<Reasoning key={pi} isStreaming={status === "streaming" && isLastPart} className="mb-2">
																<ReasoningTrigger />
																<ReasoningContent>{part.text ?? ""}</ReasoningContent>
															</Reasoning>
														);
													case "step-start":
														if (teachBoundary)
															return <PhaseDivider key={`teach-step-${pi}`} phase="teach" />;
														return pi > 0 ? <Separator key={pi} className="my-3" /> : null;
													case "data-plan-block":
														// The plan in the chat (wave 4): a frozen snapshot
														// block — rendered as carried, never re-derived.
														return (
															<PlanBlock
																key={pi}
																data={part.data as PlanBlockData}
																onOpen={() => setPlanOpen(true)}
															/>
														);
													case "tool-quiz":
													case "tool-probe":
													case "tool-ask_user_question":
													case "tool-explain":
													case "tool-recall": {
														// Pending/streaming questions live in the dock, not the
														// transcript; answered ones render as graded records.
														if (part.state === "output-available") {
															return (
																<AnsweredCard key={pi} answer={part.output as QuestionAnswerData} input={part.input} />
															);
														}
														return null;
													}
													default: {
														// A tool call being WRITTEN (owner, streaming round 2026-10-01):
														// input-streaming spans the whole execution, and the live card —
														// spinner + shimmered activity label, the input watchable on expand
														// — replaces the retired transcript bottom line. On settling, the
														// registry's card takes over below.
														if (part.type.startsWith("tool-") && part.state === "input-streaming") {
															return <LiveToolCard key={pi} part={part as ArtifactPartProps["part"]} />;
														}
														// Artifact extension point (contracts.ts): job
														// parts and future artifacts render via the
														// registry — add renderers there, not here.
														if (part.type.startsWith("tool-")) {
															const Renderer = artifactRenderers[part.type.slice("tool-".length)];
															if (Renderer) return <Renderer key={pi} part={part as ArtifactPartProps["part"]} />;
														}
														return null;
													}
												}
											})}
										</MessageContent>
									</Message>
									)}
								</Fragment>
							))}

							{/* THE placeholder, ACTION-gated (owner, optimistic round
							    3, 2026-10-02): spinner + shimmered Thinking… from the
							    instant of any action that produces tokens — send,
							    answer, session start, reattach (status flips to
							    submitted SYNCHRONOUSLY with the action) — until the
							    turn's first APPLIED event, where the stream takes over
							    with the same look: an arrived-but-empty message renders
							    the thinking ROW (view.ts projects one empty reasoning
							    part), so submitted ⟺ placeholder and streaming ⟺ a
							    rendered row, mutually exclusive by construction.
							    Protocol events (agent_start) apply nothing and release
							    nothing — the placeholder covers the whole
							    provider-connect gap. turnInFlight: the same state
							    entered by external discovery (wake) / the poll
							    fallback. Never collapsible itself. */}
							{/* Compaction (owner round 15): the same register as the
						    thinking placeholder — a visible session-wide state while
						    the summarizer holds the model gate. Mutually exclusive with
						    the THINKING placeholder by construction (the gate sits
						    BEFORE beginTurn; the settle kick runs after endTurn). */}
							{compacting && (
								<span className="flex items-center gap-2 font-ui text-xs font-medium uppercase tracking-wide text-muted-foreground">
									<BrailleSpinner label="Compacting context" />
									<Shimmer duration={1}>COMPACTING CONTEXT…</Shimmer>
								</span>
							)}
							{(status === "submitted" || turnInFlight) && (
								<span className="flex items-center gap-2 font-ui text-xs font-medium uppercase tracking-wide text-muted-foreground">
									<BrailleSpinner label="Thinking" />
									<Shimmer duration={1}>
										THINKING…
									</Shimmer>
								</span>
							)}
							{error && (
								<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
									Something went wrong: {error.message}
								</div>
							)}
						</div>

						<SessionDock
					pending={pending}
					practice={activeProblem}
					compactionRunning={compacting}
					onSubmitThinking={submitThinking}
					chatId={chatId}
					phase={phases.at(-1) ?? "probe"}
					turns={turns}
					contextTokens={contextTokens}
					pricing={pricing}
					dictationSlot={<DictationBar dictation={dictation} />}
					dictationCancel={dictation.cancel}
					queuedSteers={visibleQueuedSteers(steerQueue, nativeMessages)}
					setupCta={
						zeroKeys ? (
							<ZeroKeysPill onOpen={() => setSetupOpen(true)} />
						) : (
							!configured && (
								<div className="pointer-events-auto mb-2 flex justify-center">
									<button
										type="button"
										data-testid="setup-cta"
										onClick={() => setSetupOpen(true)}
										className="rounded-sm border border-border bg-card px-3 py-1.5 font-ui text-xs text-foreground transition-colors hover:border-muted-foreground/50 hover:bg-accent cursor-pointer"
									>
										Set up your models
									</button>
								</div>
							)
						)
					}
					composer={
						<Composer
							// Stop aborts ANY in-flight turn (stream-reattach wave): the
							// square renders while a reattached/wake turn runs too — the
							// abort channel kills it server-side; stop() alone would
							// only detach our view.
							busy={busy}
							value={text}
							onChange={applyText}
							inputRef={composerInputRef}
							onSend={onSend}
							onStop={abortInFlightTurn}
							canSend={canSend}
							onEscape={dictation.active ? dictation.cancel : undefined}
							// The pause affordance (owner round 16): the placeholder
							// IS the hint — empty state, exactly where Enter-on-empty
							// applies.
							nextProblem={nextReady}
							onNext={sendNext}
							placeholder={nextReady ? "Ask anything, or press Enter for the next one." : undefined}
						/>
					}
					onSubmitAnswer={(output) => {
						if (!pending) return;
						// THE ANSWER IS THE QUESTION CALL'S TOOL RESULT (fork 1, owner
						// 2026-09-26): one input event, one turn — the hook appends
						// the optimistic graded result (the AnsweredCard shows at
						// once) and the server's write-ahead persists it before the
						// turn; the teacher's reaction streams below it. Dismissals
						// ride the same callback (QuestionAnswerData.dismissed).
						submitAnswer(pending.tool, pending.toolCallId, output);
					}}
				/>
					</ConversationContent>
					<ConversationScrollButton className="print:hidden" />
				</Conversation>

				{/* The session-scoped focuses (chrome-melt wave, 2026-09-19): mounted
				    INSIDE the session area — absolute inset-0 siblings of the scroller,
				    so they own the area below the drag bar, right of the sidebar, and
				    the top bar stays sharp + draggable while a focus is open. */}
				{mermaidFocus !== null && (
					<MermaidOverlay chart={mermaidFocus} onClose={() => setMermaidFocus(null)} />
				)}
				{figureFocus !== null && (
					<MermaidOverlay
						svg={figureFocus.svg}
						inverted={figureFocus.inverted}
						onClose={() => setFigureFocus(null)}
					/>
				)}
				{planOpen && <PlanPopup messages={messages} onClose={() => setPlanOpen(false)} />}
				<AbortTurnDialog mode={abortAsk} onClose={() => setAbortAsk(null)} onConfirm={confirmAbort} busy={busy} />
				</div>
			</div>
		</div>
		</JobsContext.Provider>
		</SessionMermaidContext.Provider>
		{/* The BYOK setup flow (owner, 2026-09-22): one mount serves the
		    persistent CTA, the refused-send interception, and the job cards'
		    deep-link. Save keeps the draft in the composer — it never sends
		    (owner ruling 2026-10-09); Esc also keeps it (the dialog is
		    closable by design — the gate is the server, not this modal). */}
		<SetupDialog
			open={setupOpen}
			onClose={() => setSetupOpen(false)}
			onDone={() => {
				setSetupOpen(false);
				setConfigured(true);
				// Save only saves (owner ruling 2026-10-09): the draft went
				// home into the composer at refusal time and STAYS there —
				// the learner sends it themselves.
			}}
		/>
		</ChatActionsContext.Provider>
	);
}
