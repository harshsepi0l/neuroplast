"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownIcon, ChevronRightIcon, PlayIcon } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import { useEnterSubmits } from "@/features/learning/ui/composer/enter-submits";
import { MessageResponse } from "@/features/learning/ui/messages/message";
import { cn } from "@/lib/utils";
import { buildAnswer, normalizeQuizType, CONFIDENCE_STOPS, DEFAULT_CONFIDENCE_INDEX, emptyDockSelection, normalizeOptions, resolveCorrect, seededRandom, shuffleOptions, toggleOption, toggleOther, type AnswerRequest, type AskToolInput, type DockSelection, type ExplainToolInput, type QuestionAnswerData, type QuestionData, type QuestionMode, type QuizToolInput, type SelectMode } from "@/features/learning/core/question-core";
import { toolQuestionKind } from "@/features/learning/core/pending";
import { parseAskInput, parseQuizInput, parseExplainInput } from "@/features/learning/core/tool-parts";
import { type Phase3 } from "@/features/learning/core/phases";


/** The confidence choices (indices into CONFIDENCE_STOPS: 30/70/90%).
 *  None is picked at first; an untouched answer sends 50, as before. */
const CONFIDENCE_PILLS: readonly { idx: number; label: string }[] = [
	{ idx: 1, label: "Guessing" },
	{ idx: 3, label: "Fairly sure" },
	{ idx: 4, label: "Certain" },
];
/**
 * The question dock — a pending quiz/ask REPLACES the chat composer: the
 * persistent bottom blob morphs into the question. Two voices meet here:
 * the teacher's (question, options, explanation) and the learner's —
 * "Your thinking", a labeled composer-twin field for dumping reasoning,
 * with Submit docked inside it exactly like the chat composer's send.
 *
 * The thinking field is the transfer channel of the whole product (wave-2):
 * never called "optional", Enter makes a NEWLINE (it is for dumping — soon
 * typed freely), submission is the button only, and its size scales
 * with the phase (probing stays quick; teaching invites depth). The
 * "Other…" option is an editable option ROW — circle + inline input,
 * styled like its siblings — so picking Other never displaces thinking.
 *
 * Collapse behavior (scroll-up → slim bar) is owned by the DockOverlay in the
 * chat view, which also owns the persistent shell and its height morph. This
 * component is content only. The expanded form stays MOUNTED while collapsed
 * (hidden, not unmounted) so a half-made selection survives scrolling.
 */

export interface QuestionDockProps {
	toolName: "quiz" | "probe" | "ask_user_question" | "explain" | "recall";
	toolCallId: string;
	input: QuizToolInput | AskToolInput | ExplainToolInput;
	/** Collapse state, owned by the DockOverlay (it drives the shell's height morph). */
	expanded: boolean;
	/**
	 * Teach-phase check awaiting its reveal (vision §2, W5): while collapsed,
	 * the bar is the "Check your understanding" invitation instead of the
	 * scroll-collapse strip. Owned by the DockOverlay; false once the learner
	 * has revealed (afterwards the normal collapse machine rules apply).
	 */
	reveal?: boolean;
	onExpand: () => void;
	onSubmit: (output: QuestionAnswerData) => void;
	/** The question's number in the session — the label reads "Check 3". */
	number?: number;
	/** The keyboard machine (wave B) is armed only while the dock is
	 *  expanded — the collapsed bar keeps its native Enter-to-expand. */
	active?: boolean;
	/** Session phase at the question — scales the thinking field: probing
	 *  stays quick (one row), teaching invites dumping (three rows). */
	phase?: Phase3;
	/** Compaction is running for this chat (owner round 14): the answer
	 *  POST would block on the server's compaction gate — disable submit
	 *  and say so in the hint row. The server registry is the real gate;
	 *  this is the affordance. */
	compactionRunning?: boolean;
}

export function QuestionDock({
	toolName,
	toolCallId,
	input,
	expanded,
	reveal = false,
	onExpand,
	onSubmit,
	number,
	phase = "probe",
	compactionRunning = false,
}: QuestionDockProps) {
	// The probe-phase names (owner, 2026-10-09) canonicalize onto their
	// teach twins for every dock concern — parse dispatch, labels, kinds:
	// the probe quiz ("probe") is quiz-shaped, the probe free-recall
	// ("recall") is explain-shaped. Old records keep the teach names.
	const canonical =
		toolName === "probe" ? "quiz" : toolName === "recall" ? "explain" : toolName;
	// The chip's display name carries the tool's OWN name (owner
	// 2026-10-09): probe-phase questions label Probe/Recall in the
	// composer; teach tools keep the standing labels.
	const toolLabel = toolName === "probe" ? "Probe" : toolName === "recall" ? "Recall" : undefined;
	// Parse, don't cast (src/features/learning/core/tool-parts.ts): the model authored this
	// input, and only the schema the tool declared vouches for its shape.
	// The dock mounts on input-available parts (already validated at the
	// bridge), so this is pure defense in depth — but it is STRUCTURAL now:
	// anything that slips through renders the quiet fallback, never a
	// crash on `.map` over model-authored bytes.
	const parsed =
		canonical === "quiz" ? parseQuizInput(input) : canonical === "explain" ? parseExplainInput(input) : parseAskInput(input);
	if (!parsed) {
		return (
			<div data-testid="malformed-question" className="rounded-xl border border-dashed bg-card/60 p-3 text-sm text-muted-foreground">
				This question arrived malformed — the transcript keeps the retry.
			</div>
		);
	}
	return (
		<>
			{!expanded && (
				<QuestionDockBar
					toolName={canonical}
					question={parsed.question}
					onExpand={onExpand}
					variant={reveal ? "reveal" : "collapsed"}
					toolLabel={toolLabel}
					label={
						(canonical === "quiz" || canonical === "explain") &&
						normalizeQuizType((parsed as { type?: unknown }).type) === "predict"
							? "Prediction"
							: undefined
					}
				/>
			)}
			<div className={expanded ? "dock-variant" : "invisible h-0 overflow-hidden"}>
				<QuestionDockForm
					toolName={toolName}
					toolCallId={toolCallId}
					input={parsed}
					phase={phase}
					active={expanded}
					onSubmit={onSubmit}
					number={number}
					compactionRunning={compactionRunning}
				/>
			</div>
		</>
	);
}

/** A plain-text teaser of a question for the collapsed bar: unwrap math, flatten common LaTeX. */
function teaserText(q: string): string {
	return q
		.replace(/\\\(([\s\S]*?)\\\)/g, "$1") // \(...\) inline math
		.replace(/\\\[([\s\S]*?)\\\]/g, "$1") // \[...\] display math
		.replace(/\$\$?([^$]*)\$\$?/g, "$1") // standard $...$/$$...$$ math
		.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
		.replace(/\\([a-zA-Z]+)/g, "$1")
		.replace(/[{}]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** The collapsed strip. Two species (W5): "collapsed" is the scroll minimization
 *  (kind chip + one-liner + Answer ↓); "reveal" is the teach-check invitation —
 *  a distinct, more inviting affordance, because it asks the learner to start
 *  something, not to resume something. */
export function QuestionDockBar({
	toolName,
	question,
	onExpand,
	variant = "collapsed",
	label,
	toolLabel,
}: {
	toolName: "quiz" | "ask_user_question" | "explain";
	question: string;
	onExpand: () => void;
	variant?: "collapsed" | "reveal";
	/** The kind chip's text (owner 2026-10-03): "Prediction" when a
	 *  predict-type quiz minimizes by scroll — predictions never use the
	 *  reveal variant, but the scroll-collapse strip can still hide them. */
	label?: string;
	/** The chip's TOOL display name (owner 2026-10-09): probe-phase calls
	 *  label Probe/Recall — the phase boundary visible in the composer. */
	toolLabel?: string;
}) {
	if (variant === "reveal") {
		return (
			<button
				type="button"
				data-testid="teach-check-reveal"
				onClick={onExpand}
				className="dock-variant flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
			>
				<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
					<PlayIcon className="size-3.5" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-medium">Check your understanding</span>
					<span className="block truncate text-xs text-muted-foreground">{teaserText(question)}</span>
				</span>
				<span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
					Open <ChevronRightIcon className="size-3.5" />
				</span>
			</button>
		);
	}
	return (
		<button
			type="button"
			data-testid="question-dock-bar"
			onClick={onExpand}
			className="dock-variant flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/40"
		>
			<span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{label ??
							toolLabel ??
							(toolName === "quiz" ? "Check" : toolName === "explain" ? "Explain" : "Question")}
			</span>
			<span className="min-w-0 flex-1 truncate text-muted-foreground">{teaserText(question)}</span>
			<span className="flex shrink-0 items-center gap-1 text-xs font-medium">
				Answer <ArrowDownIcon className="size-3.5" />
			</span>
		</button>
	);
}

/** The expanded question: label, question, options, and the unified bottom row. */
function QuestionDockForm({
	toolName,
	toolCallId,
	input,
	phase = "probe",
	active,
	onSubmit,
	number,
	compactionRunning = false,
}: Omit<QuestionDockProps, "expanded" | "onExpand" | "reveal">) {
	const kind = toolQuestionKind(toolName);

	// Canonical QuestionData, built once per question. Quiz options are
	// deterministically shuffled (seeded by toolCallId) so position never leaks
	// correctness AND server/client render the same order (hydration-safe);
	// the display order is snapshotted into the answer record at submit time.
	const qd = useMemo<QuestionData>(() => {
		const quizInput = kind === "quiz" ? (input as QuizToolInput) : null;
		const askInput = kind === "ask" ? (input as AskToolInput) : null;
		const explainInput = kind === "explain" ? (input as ExplainToolInput) : null;
		const multi = input instanceof Object && "multiSelect" in input ? input.multiSelect === true : false;
		const mode: QuestionMode =
			kind === "quiz"
				? multi
					? "multi-select"
					: "single-select"
				: askInput?.options?.length
					? multi
						? "multi-select"
						: "single-select"
						: "text";
		const options = normalizeOptions(
			(quizInput?.options ?? askInput?.options ?? []) as { label: string; value?: string }[],
		);
		const ordered = kind === "quiz" && options.length > 0 ? shuffleOptions(options, seededRandom(toolCallId)) : options;
		const q: QuestionData = {
			id: toolCallId,
			kind,
			// The role (owner 2026-10-03): predict questions gate by it in the
			// view (never collapsed) and the answered card tucks the explanation.
			questionType: kind === "quiz" ? normalizeQuizType((input as { type?: unknown }).type) : undefined,
			question: input.question,
			context: input.details,
			mode,
			options: ordered,
			createdAt: new Date().toISOString(),
		};
		if (quizInput) {
			const resolved = resolveCorrect(quizInput.correctAnswer, ordered);
			if (resolved.error) console.error("[quiz] correctAnswer did not resolve:", resolved.error);
			q.correctIndices = resolved.indices;
			q.explanation = quizInput.explanation;
		}
		if (explainInput) {
			// The commitment rides the question data (never sent to the
			// client before answering) and snapshots into the answer at submit.
			// One field, reasoning included — no separate explanation
			// (owner ruling 2026-09-27).
			q.committedAnswer = explainInput.correctAnswer;
		}
		return q;
	}, [toolCallId, kind, input]);

	// The selection state machine lives in question-core (pure, tested):
	// single-select displaces, multi-select coexists — picking the ask
	// "Other…" row in a multi-select must never clear already-picked
	// options, and picking an option must never clear a typed custom answer.
	const [sel, setSel] = useState<DockSelection>(emptyDockSelection());
	// The learner's transfer channel — thinking, never "a note".
	const [thinking, setThinking] = useState("");
	const [other, setOther] = useState("");
	const [text, setText] = useState("");
	/* Refs mirror the two text fields; submit reads these, kept current at
	 * every write site. */
	const thinkingTextRef = useRef("");
	const answerTextRef = useRef("");
	// Confidence (owner, 2026-10-01): an index into CONFIDENCE_STOPS,
	// resting at 50 — a real coin flip by definition, untouched or
	// deliberate (the same number, the same meaning). The dock unmounts
	// between questions, so each question starts fresh at 50.
	const [confIdx, setConfIdx] = useState<number>(DEFAULT_CONFIDENCE_INDEX);
	// The reasoning field stays folded behind "+ Add your reasoning" until
	// asked for (or Tab reaches it) — the card stays quiet by default.
	const [showReasoning, setShowReasoning] = useState(false);
	const focusReasoningRef = useRef(false);
	useEffect(() => {
		if (showReasoning && focusReasoningRef.current) {
			focusReasoningRef.current = false;
			thinkingRef.current?.focus();
		}
	}, [showReasoning]);
	const openReasoning = () => {
		focusReasoningRef.current = true;
		if (showReasoning) thinkingRef.current?.focus();
		else setShowReasoning(true);
	};
	const selectMode: SelectMode = qd.mode === "multi-select" ? "multi-select" : "single-select";

	const toggle = (idx: number) => setSel(toggleOption(selectMode, sel, idx));

	const canSubmit =
		qd.mode === "text"
			? text.trim().length > 0
			: sel.dontKnow || (sel.otherSelected && other.trim().length > 0) || sel.selected.size > 0;

	const submit = () => {
		if (!canSubmit || compactionRunning) return;
		doSubmit();
	};
	const doSubmit = () => {
		if (!canSubmit) return;
		const req: AnswerRequest = {
			dontKnow: sel.dontKnow,
			values: [...sel.selected].map((i) => qd.options[i]!.value),
			other: sel.otherSelected ? other : undefined,
			text: qd.mode === "text" ? answerTextRef.current : undefined,
			thinking: qd.mode !== "text" ? thinkingTextRef.current.trim() || undefined : undefined,
			// Always sent on quiz answers (owner: 50 must mean 50, never
			// "untouched"); buildAnswer drops it on "I don't know".
			confidence: kind === "quiz" ? CONFIDENCE_STOPS[confIdx] : undefined,
		};
		onSubmit(buildAnswer(qd, req, toolName));
	};

	/* ENTER SUBMITS FROM ANYWHERE (owner round 6, 2026-10-05): the same
	 * law as the practice dock — the answer need not be focused. */
	useEnterSubmits(submit);

	// Selecting Other never clears the thinking field — two channels, the
	// answer and the reasoning behind it, side by side.
	const selectOther = () => setSel(toggleOther(selectMode, sel));

	/* ── The keyboard machine (shortcut wave B, owner rounds 2026-09-17) ──
	   ↑/↓ walk EVERY answerable row in order — options first, then the
	   quiz's "I don't know" or the ask's "Other…" (whichever exists) —
	   CLAMPED at the ends, no wrap (owner: faster to navigate when the
	   walk stops at the last row). Space acts on the walked row exactly
	   like a click (multi toggles, single displaces; Other also focuses
	   its input for typing), Enter submits once an answer exists.
	   Tab toggles FOCUS between the thinking field and the answer rows
	   (owner round 3) — nothing else; Shift+Tab is NOT ours (the global
	   thinking-level cycle owns it). Two guards keep native behavior
	   intact: keys from a TYPING SURFACE keep their meaning (arrows move
	   the caret, space types), and modifier combos are never ours
	   (Alt+arrows cycle sessions — they must not ALSO walk the rows).
	   The listener is document-level and lives only while the dock is
	   expanded — collapsed, the bar's native Enter expands it. */
	const [kbdIdx, setKbdIdx] = useState<number | null>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const otherInputRef = useRef<HTMLInputElement>(null);
	const thinkingRef = useRef<HTMLTextAreaElement>(null);
	// One row past the options is the trailing row: quiz → don't-know,
	// ask → Other (a question never has both). Text mode (ask/explain)
	// has no rows — the composer IS the answer surface.
	const optionCount = qd.mode === "text" ? 0 : qd.options.length;
	const rowCount = qd.mode === "text" ? 0 : optionCount + 1;

	const kbdAct = (idx: number) => {
		if (idx < optionCount) toggle(idx);
		else if (kind === "quiz")
			setSel((prev) => ({ ...prev, selected: new Set(), otherSelected: false, dontKnow: !prev.dontKnow }));
		else {
			// Space on the ask's Other row (owner refinement round,
			// 2026-09-24): SELECTING it focuses the input for typing, but
			// the Space that DESELECTS an already-selected Other must never
			// drop the user back into the typing field — the core's
			// toggleOther has no single-select off-path (it displaces), so
			// the off-path lives here: clear the pick, keep the typed text,
			// focus stays where it is. Re-selecting is the way back into
			// the field.
			if (sel.otherSelected) setSel((prev) => ({ ...prev, otherSelected: false, dontKnow: false }));
			else {
				otherInputRef.current?.focus();
				selectOther();
			}
		}
	};

	// Focus the walked row's focusable element — the Other row is a div,
	// so its inline input is the focus target there.
	const focusRow = (idx: number) => {
		const row = rootRef.current?.querySelector(`[data-kbdrow="${idx}"]`) as HTMLElement | null;
		if (!row) return;
		const el = (row.querySelector("input") as HTMLElement | null) ?? row;
		el.focus();
	};

	useEffect(() => {
		if (!active || rowCount === 0) return;
		const onKeyDown = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null;
			// A TYPING field is where keys mean text (owner round 4): the
			// thinking/answer fields, search boxes, renames — never a range
			// input, whose focus after a click or drag must not kill the
			// arrow cycling. Everywhere else the arrows act.
			const typing =
				!!t &&
				((t.tagName === "INPUT" && (t as HTMLInputElement).type !== "range") ||
					t.tagName === "TEXTAREA" ||
					t.isContentEditable);
			// Alt/Cmd/Ctrl combos are never ours (Alt+arrows cycle sessions
			// globally — they must not ALSO walk the question rows).
			const modded = e.altKey || e.metaKey || e.ctrlKey;
			// Plain Tab toggles focus: rows → thinking. The confidence
			// slider takes NO focus at all (owner, UI round 2026-10-01) —
			// global ←/→ own its keyboard, so it never joins the chain.
			// Shift+Tab falls through (the global thinking-level cycle owns
			// it), so the shift check matters.
			if (e.key === "Tab" && !e.shiftKey && !modded) {
				e.preventDefault();
				e.stopPropagation();
				if (t?.closest?.("[data-kbdrow]")) openReasoning();
				else {
					const idx = kbdIdx ?? 0;
					setKbdIdx(idx);
					focusRow(idx);
				}
				return;
			}
			// Keys from a typing surface keep their meaning (arrows move
			// the caret, space types).
			if (typing || modded) return;
			if (e.key === "ArrowDown") {
				e.preventDefault();
				const next = Math.min((kbdIdx ?? -1) + 1, rowCount - 1);
				setKbdIdx(next);
				// Focus follows the walk while the user is IN the rows (Tab
				// put them there) so focused and walked never diverge.
				if (t?.closest?.("[data-kbdrow]")) focusRow(next);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				const next = Math.max((kbdIdx ?? rowCount) - 1, 0);
				setKbdIdx(next);
				if (t?.closest?.("[data-kbdrow]")) focusRow(next);
			} else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				// Global confidence cycling (owner, UI round 2026-10-01): the
				// SAME pattern as ↑/↓ over the rows — works wherever focus
				// sits, no click-in, no focus ring. Dead on "I don't know"
				// (the slider grays out and nothing is sent).
				if (kind !== "quiz" || sel.dontKnow) return;
				e.preventDefault();
				setConfIdx((i) => {
					const at = CONFIDENCE_PILLS.findIndex((p) => p.idx === i);
					const next = at < 0 ? 1 : Math.min(CONFIDENCE_PILLS.length - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)));
					return CONFIDENCE_PILLS[next]!.idx;
				});
			} else if (e.key === " ") {
				if (kbdIdx === null) return; // plain Space keeps scrolling the page
				e.preventDefault();
				kbdAct(kbdIdx);
			} else if (e.key === "Enter") {
				if (kbdIdx === null || !canSubmit) return;
				e.preventDefault();
				submit();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	});

	// Keep the walked row visible (the question area scrolls internally).
	useEffect(() => {
		if (kbdIdx === null) return;
		rootRef.current
			?.querySelector(`[data-kbdrow="${kbdIdx}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [kbdIdx]);

	const label =
		toolName === "probe"
			? "Probe"
			: toolName === "recall"
				? "Recall"
				: kind === "quiz"
					? qd.questionType === "predict"
						? "Prediction"
						: "Check"
					: kind === "explain"
						? "Explain"
						: "Question";
	const answered = sel.selected.size > 0 || sel.otherSelected;
	const rowClass = (selected: boolean, walked: boolean) =>
		cn(
			"flex min-h-12 w-full items-center gap-3.5 rounded-lg px-3 py-2 text-left outline-none transition-colors",
			selected ? "bg-primary/15" : "hover:bg-accent/60",
			walked && !selected && "bg-accent/60",
		);
	const badgeClass = (selected: boolean) =>
		cn(
			"grid size-7 shrink-0 place-items-center rounded-md border font-mono text-xs",
			selected ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border/70 text-muted-foreground",
		);
	const letter = (i: number) => String.fromCharCode(65 + i);

	return (
		<div ref={rootRef} data-testid="question-dock" className="border-l-[3px] py-1 pl-5" style={{ borderLeftColor: "var(--brand)" }}>
			<div data-session-find-root="">
				<div className="mb-2 font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{label}
					{number !== undefined && ` ${number}`}
					{qd.mode === "multi-select" && " · select all that apply"}
				</div>
				<div className="mb-3 font-semibold leading-snug [&_*]:text-[calc(var(--neuroplast-prose-size)*1.3)]">
					<MessageResponse>{qd.question}</MessageResponse>
				</div>
				{qd.context && (
					<div className="mb-3 text-muted-foreground">
						<MessageResponse>{qd.context}</MessageResponse>
					</div>
				)}

				{qd.mode !== "text" && (
					<div className="flex flex-col gap-0.5" role={qd.mode === "multi-select" ? "group" : "radiogroup"}>
						{qd.options.map((opt, i) => {
							const isSel = sel.selected.has(i);
							return (
								<button
									key={opt.value}
									type="button"
									role={qd.mode === "multi-select" ? "checkbox" : "radio"}
									aria-checked={isSel}
									data-kbdrow={i}
									onClick={() => toggle(i)}
									className={rowClass(isSel, i === kbdIdx)}
								>
									<span aria-hidden className={badgeClass(isSel)}>{letter(i)}</span>
									<span className="min-w-0">
										<MessageResponse className="[&_*]:text-[calc(var(--neuroplast-prose-size)*1.06)]">{opt.label}</MessageResponse>
										{kind !== "quiz" && opt.description && (
											// QUIZ options render NO description (owner ruling
											// 2026-09-26): the model used them to telegraph
											// correctness. Ask descriptions are full markdown.
											<MessageResponse className="neuroplast-prose block text-sm text-muted-foreground">
												{opt.description}
											</MessageResponse>
										)}
									</span>
								</button>
							);
						})}

						{kind === "ask" && (
							<div
								role={qd.mode === "multi-select" ? "checkbox" : "radio"}
								aria-checked={sel.otherSelected}
								data-testid="other-option"
								data-kbdrow={optionCount}
								onClick={selectOther}
								className={rowClass(sel.otherSelected, kbdIdx === optionCount)}
							>
								<span aria-hidden className={badgeClass(sel.otherSelected)}>…</span>
								<input
									ref={otherInputRef}
									value={other}
									onChange={(e) => {
										setOther(e.target.value);
										// Typing selects the row — displacing in
										// single-select, alongside the siblings in multi.
										setSel((prev) => (prev.otherSelected ? prev : toggleOther(selectMode, prev)));
									}}
									onKeyDown={(e) => {
										// Esc leaves the input; the row stays selected and the
										// arrow walk resumes from it. Claimed so the window
										// chain doesn't read it as abort-turn.
										if (e.key === "Escape") {
											e.preventDefault();
											e.stopPropagation();
											e.currentTarget.blur();
											setKbdIdx(optionCount);
										}
										// Enter submits: a one-line field, already selected.
										if (e.key === "Enter") {
											e.preventDefault();
											submit();
										}
									}}
									placeholder="Something else…"
									className="neuroplast-input w-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
									onClick={(e) => e.stopPropagation()}
								/>
							</div>
						)}
					</div>
				)}
			</div>

			<form
				className="mt-3 flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				{qd.mode === "text" && (
					<div data-testid="answer-field" className="rounded-lg border border-border/70 bg-background/60 focus-within:border-primary/60">
						<label className="sr-only" htmlFor={`answer-${toolCallId}`}>Your answer</label>
						<textarea
							id={`answer-${toolCallId}`}
							value={text}
							onChange={(e) => {
								answerTextRef.current = e.target.value;
								setText(e.target.value);
							}}
							onKeyDown={(e) => {
								// Esc leaves the field — claimed so the window chain
								// doesn't also dismiss the question or abort a turn.
								if (e.key === "Escape") {
									e.preventDefault();
									e.stopPropagation();
									e.currentTarget.blur();
									return;
								}
								// Enter submits, Shift+Enter is a newline; ⌘/Ctrl+Enter too.
								if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
									e.preventDefault();
									submit();
								}
							}}
							placeholder="Type your answer…"
							rows={1}
							className="field-sizing-content neuroplast-input max-h-48 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 outline-none placeholder:text-muted-foreground"
						/>
					</div>
				)}

				{/* How sure: four words instead of a slider, shown once there is
				    an answer to be sure about. ←/→ step between them. */}
				{kind === "quiz" && answered && !sel.dontKnow && (
					<div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="How sure are you?" data-testid="confidence-pills">
						<span className="mr-1 text-sm text-muted-foreground">How sure?</span>
						{CONFIDENCE_PILLS.map((pill) => (
							<button
								key={pill.idx}
								type="button"
								role="radio"
								aria-checked={confIdx === pill.idx}
								onClick={() => setConfIdx(pill.idx)}
								className={cn(
									"min-h-8 rounded-full border px-3 text-sm transition-colors",
									confIdx === pill.idx ? "border-foreground bg-foreground font-semibold text-background" : "border-border/70 hover:bg-accent/60",
								)}
							>
								{pill.label}
							</button>
						))}
					</div>
				)}

				{qd.mode !== "text" && showReasoning && (
					<div data-testid="thinking-field" className="rounded-lg border border-border/70 bg-background/60 focus-within:border-primary/60">
						<label className="sr-only" htmlFor={`thinking-${toolCallId}`}>Your reasoning</label>
						<textarea
							id={`thinking-${toolCallId}`}
							ref={thinkingRef}
							value={thinking}
							onChange={(e) => {
								thinkingTextRef.current = e.target.value;
								setThinking(e.target.value);
							}}
							onKeyDown={(e) => {
								if (e.key === "Escape") {
									e.preventDefault();
									e.stopPropagation();
									e.currentTarget.blur();
									return;
								}
								// Enter submits, Shift+Enter is a newline; ⌘/Ctrl+Enter too.
								if (e.key === "Enter" && (!e.shiftKey || e.metaKey || e.ctrlKey)) {
									e.preventDefault();
									submit();
								}
							}}
							placeholder="Why this answer? Whatever comes to mind."
							rows={1}
							className={cn(
								"field-sizing-content neuroplast-input max-h-48 w-full resize-none bg-transparent px-3 py-2.5 outline-none placeholder:text-muted-foreground/70",
								phase === "teach" ? "min-h-[4.5rem]" : "min-h-11",
							)}
						/>
					</div>
				)}

				<div className="flex flex-wrap items-center justify-between gap-3">
					{qd.mode !== "text" && !showReasoning ? (
						<button type="button" onClick={openReasoning} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
							+ Add your reasoning
						</button>
					) : (
						<span className="text-sm text-muted-foreground">{compactionRunning ? "compacting session…" : ""}</span>
					)}
					<div className="ml-auto flex items-center gap-4">
						{kind === "quiz" && (
							<button
								type="button"
								onClick={() =>
									setSel((prev) => ({ ...prev, selected: new Set(), otherSelected: false, dontKnow: !prev.dontKnow }))
								}
								data-kbdrow={optionCount}
								aria-pressed={sel.dontKnow}
								className={cn(
									"rounded-md px-1 text-sm underline underline-offset-4 outline-none",
									sel.dontKnow ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
									kbdIdx === optionCount && "ring-1 ring-border",
								)}
							>
								I don't know
							</button>
						)}
						<Button type="submit" disabled={!canSubmit || compactionRunning} className="h-10 rounded-lg px-5 text-sm font-semibold">
							Submit
						</Button>
					</div>
				</div>
			</form>
		</div>
	);
}
