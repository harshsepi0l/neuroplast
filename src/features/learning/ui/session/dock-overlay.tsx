"use client";
import { useEffect, useRef, useState } from "react";
import { visibleQueuedSteers } from "@/features/learning/ui/session/session-core";
import { Hint } from "@/ui/primitives/hint";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { Conversation, ConversationScrollButton } from "@/features/learning/ui/messages/conversation";
import { dockStateKey } from "@/features/learning/ui/docks/dock-state-key";
import { QueuedSteersBody, type QueuedSteerLine } from "@/features/learning/ui/composer/queued-steers";
import { finishDictation } from "@/features/learning/ui/composer/dictation";
import { StatsBar } from "@/features/learning/ui/session/stats-bar";
import { QuestionDock } from "@/features/learning/ui/docks/question-dock";
import { PracticeDock } from "@/features/learning/ui/docks/practice-dock";
import type { TurnUsage } from "@/features/learning/core/chat";
import type { Phase3 } from "@/features/learning/core/phases";
import type { QuestionAnswerData } from "@/features/learning/core/question-core";
import type { SessionPricing } from "@/features/learning/core/prices";
import { findPendingToolCall } from "@/features/learning/core/pending";
import { ReadingThinkingField } from "@/features/learning/ui/messages/reading-thinking";
import { probeArrivalExpanded, revealArrival, shouldStampGeometryMute } from "./chat-logic";
import { COLLAPSE_DIST, COLUMN, DOCK, DOCK_W, EXPAND_DIST, GRADIENT_H, MARGIN_GAP, MARGIN_MIN_W, useIsoLayoutEffect } from "./chat-layout";

/**
 * The floating blob: ONE persistent shell, OVERLAID at the bottom of the
 * column (absolute — a sibling of the scroller, the use-stick-to-bottom
 * pattern; it replaced the old in-flow sticky dock, which died of the
 * fold-latency problem below). Contents swap between the chat composer and
 * the question dock; shell height morphs between variants (WAAPI, quick). A
 * spacer at the end of the transcript (rendered by ChatView from onReserve
 * reports) holds the dock's flow-space, so at-rest content scrolls fully
 * clear of the overlay.
 *
 * Why an overlay (owner, scroll round 1): an in-flow dock IS scroll geometry
 * — folding it shrinks the scroll content, so the fold had to wait until the
 * learner was a full dock-height past the bottom (any closer and the browser
 * clamp pinned them back, re-expanding the box: the oscillation). Decoupled
 * from the flow, the fold is VISUAL ONLY: it fires as soon as the learner
 * leaves the bottom, and the reserved tail only ever GROWS while a question
 * is open (a shrinking tail would reintroduce the clamp).
 *
 * Collapse: scroll up past COLLAPSE_DIST and the dock folds into a slim bar;
 * click it (or scroll back to the bottom) to re-expand. The question form
 * stays MOUNTED while collapsed (hidden, not unmounted) so a half-made
 * selection survives.
 */
export function DockOverlay({
	pending,
	practice,
	compactionRunning,
	onSubmitThinking,
	requiresReveal,
	readingThinking,
	onReadingThinking,
	phase,
	turns,
	contextTokens,
	pricing,
	composer,
	onSubmitAnswer,
	chatId,
	onReserve,
	plan,
	onOpenPlan,
	dictationSlot,
	dictationCancel,
	setupCta,
	queuedSteers,
}: {
	pending: ReturnType<typeof findPendingToolCall>;
	/** Compaction running for this chat (round 14) — the docks' submit
	 *  affordance gate (the server's registry is the real one). */
	compactionRunning: boolean;
	/** The ACTIVE practice problem (practice sessions, 2026-10-04):
	 *  {toolCallId, input} — dock ownership exactly like a pending
	 *  question (the composer is replaced); null in teaching sessions. */
	practice: { toolCallId: string; input: unknown } | null;
	/** (commit, text) — the practice dock's two submit lanes. */
	onSubmitThinking: (text: string) => void;
	/** Teach-phase pending question: arrives collapsed behind the reveal button (W5). */
	requiresReveal: boolean;
	/** The reading-thinking draft (owner 2026-10-03) — owned by ChatView so
	 *  the submit + dismissal seams (outside this overlay) can merge it. */
	readingThinking: string;
	onReadingThinking: (v: string) => void;
	/** Session phase at the pending question — scales the thinking field. */
	phase: Phase3;
	/** The session's usage log — the stats bar beneath the composer folds it. */
	turns: TurnUsage[];
	contextTokens: number | null;
	pricing?: SessionPricing;
	composer: React.ReactNode;
	onSubmitAnswer: (output: QuestionAnswerData) => void;
	/** The model control's pass-through (the stats bar hosts it). */
	chatId: string;
	/** Reports the dock's settled height (block + gradient) — ChatView's
	 *  dockReserve state feeds the transcript's spacer from it. */
	onReserve: (h: number) => void;
	/** The plan marginalia's content (the bare diagram) — rendered only
	 *  while a question owns the band. Null until a plan exists. */
	plan?: React.ReactNode;
	/** Opens the full-DAG popup (the marginalia + chip share it). */
	onOpenPlan: () => void;
	/** The dictation strip (STT wave): rendered in the stats bar's middle
	 *  slot — the mic button + live meter (components/dictation.tsx). */
	dictationSlot?: React.ReactNode;
	/** Esc in a pending question's field stops dictation (the strip is the
	 *  stats bar's; the stop belongs to the page-owned hook, threaded down). */
	dictationCancel?: () => void;
	/** The queued-steer indicator's lines (composer steering, 2026-10-03):
	 *  already filtered by visibleQueuedSteers — only undrained steers. */
	queuedSteers: QueuedSteerLine[];
	/** The persistent setup CTA (BYOK, owner 2026-09-22): the same pill
	 *  home and /chat/new carry, above the composer while slots are unset. */
	setupCta?: React.ReactNode;
}) {
	const { isAtBottom, scrollToBottom, scrollRef } = useStickToBottomContext();
	// Render-fresh bottom state (flicker round): the arrival block below reads
	// it DURING RENDER — the same value the after-paint effect used to read a
	// frame too late. Assigned per render like the other refs below.
	const atBottomRef = useRef(isAtBottom);
	atBottomRef.current = isAtBottom;
	// Teach-phase mount (session reload with a pending check): the dock starts
	// as the collapsed invitation too — the check must not pop open on reload.
	const [expanded, setExpanded] = useState(!requiresReveal);
	// Reveal state (W5): false until the learner clicks the invitation. While
	// false, the scroll machine must NOT auto-expand at the bottom — the
	// learner reads the teaching first and opens the check when ready. Once
	// revealed, the normal collapse machine rules apply untouched.
	const [revealed, setRevealed] = useState(false);
	const revealPending = requiresReveal && !revealed;

	const pendingId = pending?.toolCallId ?? null;
	const initialPendingRef = useRef(pendingId);

	// Teach-question ARRIVAL state, applied during render — BEFORE the
	// first paint (owner, scroll-honesty round 2026-09-25). Until now the
	// stale expanded=true left by the previous question painted one frame
	// of the OPEN question: the dock measured itself tall, permanently
	// reserved that height, and the collapse after the paint could never
	// give it back (fold immunity) — so a collapsed teach question scrolled
	// the transcript as if it had opened. Resetting here means the paint
	// measures the bar, the reserve keeps the composer's height, and the
	// only motion is the teaching text itself.
	const prevPendingIdRef = useRef(pendingId);
	if (pendingId !== prevPendingIdRef.current) {
		const wasQuestion = prevPendingIdRef.current !== null;
		prevPendingIdRef.current = pendingId;
		if (pendingId && requiresReveal) {
			const arrival = revealArrival(wasQuestion);
			setExpanded(arrival.expanded);
			setRevealed(arrival.revealed);
		} else if (pendingId) {
			// Probe arrival (flicker round): open iff following at the bottom.
			// Painted in THIS render — no stale-open frame, no after-paint flip.
			setExpanded(probeArrivalExpanded(atBottomRef.current));
		}
	}

	// New question MID-SESSION (flicker round): the open/closed state itself
	// is decided DURING RENDER above; this effect only owns the reveal
	// scroll for the at-bottom arrival — and now under the SAME fold
	// suppression the teach reveal uses (the arrival's growth used to
	// out-run the scroll catch-up, the position machine read the lag as the
	// learner leaving, and the dock flashed open → bar → open; reproduced
	// frame-by-frame 2026-09-26, d peaked ~405px). On session mount the dock
	// starts in its initial state — no scroll, no morph.
	useEffect(() => {
		if (!pendingId || pendingId === initialPendingRef.current) return;
		if (!requiresReveal && atBottomRef.current) void suppressFoldDuringReveal();
		// fire only when a NEW question lands
	}, [pendingId]);

	// ── Fold machine (position, not velocity — owner, scroll round 1) ──
	// The dock is an overlay: folding is visual-only and scroll geometry never
	// moves, so the thresholds can hug the bottom. Leave it → fold; reach it
	// again → re-open. The dead band keeps trackpad drift from chattering.
	const expandedRef = useRef(expanded);
	expandedRef.current = expanded;
	// Dock ownership (the fold machine, the reserve immunity, the arrival
	// states): a pending question OR an active practice problem — either
	// replaces the composer and owns the band.
	const pendingRef = useRef(!!pending || !!practice);
	pendingRef.current = !!pending || !!practice;
	const requiresRevealRef = useRef(requiresReveal);
	requiresRevealRef.current = requiresReveal;
	const revealedRef = useRef(revealed);
	revealedRef.current = revealed;

	// The plan marginalia's flank width (owner, plan-placement round): from
	// the DOCK container's right edge to the block's right edge — the bare
	// diagram's canvas. Tracked LIVE by a ResizeObserver on the block
	// (owner, resize round): every geometry change — window resize, sidebar
	// toggle, scrollbar appearance, the box's own rewrap — reports the real
	// width instantly, so the fade floor never lags behind reality (the old
	// render-time measurement went stale during drag-resizes and the mount
	// decision popped late).
	const [flankW, setFlankW] = useState(0);
	const flankWRef = useRef(0);
	// Part A of the same round (the resize mute): any block size change
	// stamps this — the fold machine ignores scroll events for a beat after,
	// because a resize/rewrap re-clamps scrollTop and emits PHANTOM scroll
	// events mid-transient (the box flickered to the bar and back).
	// Width changes stamp HERE (column resizes); height growth stamps at
	// the OFFER (see offer below) — the spacer growing is the phantom-scroll
	// source, not the field stretching. SHRINKS never stamp anywhere: the
	// fold's own morph shrinks the block and gives back the reserve, and
	// stamping that self-mutes the at-bottom re-expand — the box got stuck
	// collapsed (resize round).
	const geometryAtRef = useRef(0);
	useIsoLayoutEffect(() => {
		const block = blockRef.current;
		if (!block) return;
		const measure = () => {
			const next = Math.round(block.offsetWidth / 2 - DOCK_W / 2 - 2 * MARGIN_GAP);
			if (Math.abs(next - flankWRef.current) > 1) {
				flankWRef.current = next;
				setFlankW(next);
				geometryAtRef.current = Date.now();
			}
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(block);
		return () => ro.disconnect();
	}, []);

	// The overlay must not paint over the scroller's scrollbar (owner, scroll
	// round 2): the scroller reserves symmetric gutters (scrollbar-gutter:
	// stable both-edges), so inset the overlay's right edge by the gutter —
	// zero on macOS overlay scrollbars, the real width on classic platforms.
	// The same measure owns the QUESTION/PROBLEM HEIGHT CAP (owner round,
	// 2026-10-05): the old fixed fractions (55dvh / 40vh) cut long problems
	// off absurdly short — the cap is now the AVAILABLE COLUMN (the
	// scroller already starts below the top bar) minus a 2rem breathing
	// gap, carried as --dock-max-h for the docks' scroll areas.
	const [sbInset, setSbInset] = useState(0);
	const [dockMaxH, setDockMaxH] = useState<number | null>(null);
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const measure = () => {
			setSbInset(Math.round((el.offsetWidth - el.clientWidth) / 2));
			setDockMaxH(Math.max(el.clientHeight - 32, 160));
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [scrollRef]);

	// GROWTH MUTE (owner round, 2026-10-05 — the generation churn): during a
	// live turn the transcript content grows and stick-to-bottom chases it;
	// the transient distance-from-bottom used to read as the learner
	// leaving, folding the dock open↔bar ("disappear and appear again").
	// A ResizeObserver on the scroller's content stamps the SAME mute the
	// dock's own resizes use — growth frames can never fold. Shrinks stamp
	// nothing (the fold's own morph shrinks the reserve; muting that would
	// self-mute the at-bottom re-expand).
	const growthAtRef = useRef(0);
	useEffect(() => {
		const el = scrollRef.current;
		const content = el?.firstElementChild as HTMLElement | null | undefined;
		if (!el || !content) return;
		let prevH = content.getBoundingClientRect().height;
		const ro = new ResizeObserver(() => {
			const h = content.getBoundingClientRect().height;
			if (h > prevH + 0.5) growthAtRef.current = Date.now();
			prevH = Math.max(prevH, h);
		});
		ro.observe(content);
		return () => ro.disconnect();
	}, [scrollRef]);

	// Wheel over the dock must still scroll the transcript (owner, scroll
	// round 2): the overlay is a SIBLING of the scroller, so the browser's
	// native scroll chaining stops at the overlay (the old in-flow dock
	// chained for free). Internal scrollers — the question area, textarea
	// overflow, the model menus — keep native scrolling, including their
	// own edge chaining; only when nothing under the cursor can take the
	// delta do we forward it to the transcript.
	useEffect(() => {
		const root = blockRef.current;
		const el = scrollRef.current;
		if (!root || !el) return;
		const canScroll = (n: HTMLElement, dir: number) => {
			if (n.scrollHeight - n.clientHeight < 2) return false; // not scrollable
			return dir < 0 ? n.scrollTop > 0 : n.scrollTop < n.scrollHeight - n.clientHeight - 0.5;
		};
		const onWheel = (e: WheelEvent) => {
			if (e.deltaY === 0) return;
			for (let n = e.target as HTMLElement | null; n && n !== root; n = n.parentElement) {
				if (n instanceof HTMLElement && canScroll(n, e.deltaY)) return; // native
			}
			e.preventDefault();
			el.scrollTop += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
		};
		root.addEventListener("wheel", onWheel, { passive: false });
		return () => root.removeEventListener("wheel", onWheel);
	}, [scrollRef]);

	// ── The reserve: the spacer's height, reported upward ──
	// Grows immediately (typing, new variants). NEVER drops while a question
	// is open — a shrinking reserved tail is scroll geometry and the browser
	// clamp would pin a nearby learner to the bottom (the old oscillation).
	// In chat mode drops apply (the composer's typing shrink is today's
	// harmless in-flow behavior; nothing auto-expands there).
	const reserveRef = useRef(0);
	const blockRef = useRef<HTMLDivElement>(null);
	const offer = (blockH: number) => {
		const next = blockH + GRADIENT_H;
		if (next <= reserveRef.current + 0.5 && pendingRef.current) return; // fold immunity
		// Reserve GROWTH is the phantom-scroll SOURCE (flicker round,
		// 2026-09-26): the spacer's height lands in this commit, the smooth
		// catch-up lags it by the growth amount, and the position machine
		// used to read that lag as the learner leaving — form → bar → form
		// (the dictation flush, reproduced d≈152 > COLLAPSE_DIST). Stamp the
		// mute right where the spacer grows: it covers the scroll events of
		// THIS growth no matter how long after the field stretched (the
		// field grows on its own render; the offer lands on the NEXT
		// DockOverlay render — ~1s apart live). Shrinks never stamp (the
		// fold's own give-back must not self-mute the re-expand).
		if (shouldStampGeometryMute(next, reserveRef.current, pendingRef.current)) geometryAtRef.current = Date.now();
		reserveRef.current = next;
		onReserve(next);
	};

	// Explicit expand (bar click): the smooth scroll to the bottom takes
	// hundreds of ms, during which the position is still legitimately inside
	// the collapse zone — the machine would instantly re-collapse the dock
	// (open → snap shut → reopen at the bottom, the flicker). Suppress the
	// collapse branch until the reveal scroll settles or is interrupted.
	// (Flicker round, 2026-09-26: extracted — the probe arrival at the
	// bottom is the SAME motion class and needs the same cover; the owner's
	// phrasing: the arrival's open and its scroll-to-bottom "should be the
	// same kind of motion".)
	const expandIntentRef = useRef(false);
	const intentTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const suppressFoldDuringReveal = () => {
		expandIntentRef.current = true;
		clearTimeout(intentTimerRef.current);
		intentTimerRef.current = setTimeout(() => {
			expandIntentRef.current = false;
		}, 2000);
		return Promise.resolve(scrollToBottom()).finally(() => {
			clearTimeout(intentTimerRef.current);
			expandIntentRef.current = false;
		});
	};
	const expandAndReveal = () => {
		setRevealed(true); // the teach-check invitation was accepted (W5)
		setExpanded(true);
		void suppressFoldDuringReveal();
	};
	const expandAndRevealRef = useRef(expandAndReveal);
	expandAndRevealRef.current = expandAndReveal;
	// ENTER OPENS THE WAITING CHECK (owner, keyboard round 2026-10-06):
	// while a question waits with the dock CLOSED — behind its reveal
	// invitation or collapsed by scroll — Enter is never dead. Any live
	// dictation FINISHES FIRST (the flush lands in the reading-thinking
	// field, its live claim — the nothing-gets-lost law), then the check
	// opens. A typing surface or a focused button owns its own Enter (the
	// reading-thinking field opens from INSIDE when the check is closed;
	// a focused button activates natively) — this listener claims only
	// the dead case: plain focus with Enter doing nothing.
	useEffect(() => {
		if (!pending || expanded) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Enter" || e.altKey) return;
			if (e.shiftKey && !e.metaKey && !e.ctrlKey) return;
			const t = e.target as HTMLElement | null;
			if (
				t &&
				((t.tagName === "INPUT" && (t as HTMLInputElement).type !== "range") ||
				t.tagName === "TEXTAREA" ||
				t.isContentEditable ||
				t.closest("button"))
			)
				return;
			e.preventDefault();
			void finishDictation().then(() => {
				expandAndRevealRef.current();
			});
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [pending, expanded]);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const onScroll = () => {
			if (!pendingRef.current) return;
			// Resize mute (owner, resize round): a geometry change re-clamps
			// scrollTop and the browser emits the clamp as a scroll event —
			// reading the transient position folded the box to the bar for a
			// flicker. Real scrolling resumes after the brief mute window.
			if (Date.now() - geometryAtRef.current < 400) return;
			// Growth mute (owner round, 2026-10-05): the transcript growing
			// under a live turn is not the learner leaving.
			if (Date.now() - growthAtRef.current < 400) return;
			const d = el.scrollHeight - el.clientHeight - el.scrollTop;
			if (expandedRef.current) {
				// INTENT-GATED FOLD (owner ruling, 2026-10-05): distance alone
				// folded on stick-to-bottom's catch-up transients; a real fold
				// needs the distance AND stick-to-bottom agreeing the learner
				// left the bottom.
				if (d > COLLAPSE_DIST && !expandIntentRef.current && !atBottomRef.current) setExpanded(false);
			} else if (d < EXPAND_DIST) {
				// Teach checks stay collapsed until the learner opens them (W5): the
				// at-bottom auto-expand would pop the form over the teaching.
				if (requiresRevealRef.current && !revealedRef.current) return;
				setExpanded(true);
				void scrollToBottom();
			}
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [scrollRef, scrollToBottom]);

	// The settled block height (gradient excluded), offered to the spacer.
	// Only ever called with NATURAL heights — never the animated mid-morph
	// value (the iso effect's getAnimations guard wraps every call).
	const measureBlock = () => {
		const b = blockRef.current;
		if (b) offer(b.getBoundingClientRect().height);
	};

	const mode = pending
		? `question:${pending.toolCallId}`
		: practice
			? `practice:${practice.toolCallId}`
			: "chat";
	// The opening variant of a session appears instantly — the fade/rise is
	// reserved for mid-session transitions.
	const initialModeRef = useRef(mode);

	// Height morph: animate the shell from its previous height to its new one
	// whenever the variant (chat ↔ question ↔ collapsed bar) changes. Typing
	// growth keeps the same stateKey and is NOT animated.
	const shellRef = useRef<HTMLDivElement>(null);
	// The fold's CONTENT fade (owner round, 2026-10-05): the shell height
	// morphs, but the bar↔form content used to hard-swap. A WAAPI fade/rise
	// on the toggle — no remount, so the question form's state survives.
	const contentRef = useRef<HTMLDivElement>(null);
	const prevExpandedForFadeRef = useRef(expanded);
	useIsoLayoutEffect(() => {
		if (prevExpandedForFadeRef.current === expanded) return;
		prevExpandedForFadeRef.current = expanded;
		contentRef.current?.animate(
			[{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
			{ duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
		);
	}, [expanded]);
	// The height-morph key (components/dock-state-key.ts): the expanded
	// term (the fold) belongs to EVERY docked variant — question AND
	// practice (owner fix, 2026-10-06). Typing growth keeps the key and
	// never animates; the fold/unfold morphs like teaching always has.
	const stateKey = dockStateKey(mode, !!pending || !!practice, expanded);
	const prevRef = useRef<{ key: string; height: number } | null>(null);
	useIsoLayoutEffect(() => {
		const el = shellRef.current;
		if (!el) return;
		const p = prevRef.current;
		if (p && p.key === stateKey) {
			// Same variant: keep the settled height fresh, but never measure while
			// a morph is in flight — getBoundingClientRect would read the ANIMATED
			// value and corrupt the start height of the next morph.
			if (el.getAnimations().length === 0) {
				const h = el.getBoundingClientRect().height;
				p.height = h;
				measureBlock(); // typing growth → the spacer grows with the box
			}
			return;
		}
		el.getAnimations().forEach((a) => a.cancel()); // flush to natural height before measuring
		const h = el.getBoundingClientRect().height;
		// Variant change → re-reserve. Growth applies instantly; a drop (the
		// fold, or question → composer) is filtered by the offer policy.
		measureBlock();
		if (p && Math.abs(p.height - h) > 1) {
			el.animate([{ height: `${p.height}px` }, { height: `${h}px` }], {
				duration: 120,
				easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
			});
		}
		prevRef.current = { key: stateKey, height: h };
	});

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ right: sbInset }}>
			<div className="h-24 bg-gradient-to-t from-background via-background/85 to-transparent" />
			<div ref={blockRef} className="relative bg-background pb-5" style={{ "--dock-max-h": dockMaxH ? `${dockMaxH}px` : undefined } as React.CSSProperties}>
				<div className={DOCK}>
					{setupCta}
					{/* The queued-steer indicator (owner spec 2026-10-03): quiet
					    one-liners above the shell - right-aligned to where its corner
					    rounding starts, truncated, no background, no container. A
					    line dies when its card lands (visibleQueuedSteers). */}
					<QueuedSteersBody steers={queuedSteers} />
					{/* The reading-thinking field (owner 2026-10-03): mounted while a
					    teach-phase check waits — the same cue that collapses it. It
					    claims dictated speech until the learner reveals the check
					    (the dock reclaims then). Rides the check answer on submit. */}
					{pending && requiresReveal && (
						<ReadingThinkingField
							value={readingThinking}
							onChange={onReadingThinking}
							onEscape={dictationCancel}
							onOpen={
								!expanded
									? () => {
											void finishDictation().then(() => {
												expandAndRevealRef.current();
											});
										}
									: undefined
							}
							claim={revealPending}
						/>
					)}
					<div ref={shellRef} className="pointer-events-auto overflow-hidden rounded-2xl border bg-card shadow-lg">
						<div
						ref={contentRef}
						key={mode}
						className={mode === initialModeRef.current ? undefined : "dock-variant"}
					>
							{pending ? (
								<QuestionDock
									toolName={pending.tool as "quiz" | "probe" | "ask_user_question" | "explain" | "recall"}
									toolCallId={pending.toolCallId}
									input={pending.input as never}
									expanded={expanded}
									reveal={revealPending}
									phase={phase}
									onExpand={expandAndReveal}
									onSubmit={onSubmitAnswer}
									onEscape={dictationCancel}
									dictationClaim={!revealPending}
									compactionRunning={compactionRunning}
								/>
							) : practice ? (
								<PracticeDock
									problemCallId={practice.toolCallId}
									input={practice.input as { statement: string }}
									expanded={expanded}
									onExpand={() => {
										setExpanded(true);
										void suppressFoldDuringReveal();
									}}
									onSubmit={onSubmitThinking}
									onEscape={dictationCancel}
									compactionRunning={compactionRunning}
								/>
							) : (
								composer
							)}
						</div>
					</div>
					{/* The stats row: beneath the composer/question shell, not
					    flush to the screen bottom — static height, outside the
					    morphing shell so it never joins a height animation. */}
					<StatsBar
						turns={turns}
						contextTokens={contextTokens}
						pricing={pricing}
						dictationSlot={dictationSlot}
						chatId={chatId}
					/>
					{/* The scroll-down disc (moved here from the Conversation,
					    owner refinement round 2026-09-24): anchored to the BLOCK's
					    top edge — above the composer shell AND the stats row, in
					    the gradient's transparent band — so it never overlaps
					    any dock element. Because the anchor is the block itself
					    (not the scroller's bottom), it rides every height change
					    LIVE: typing growth, a pending question expanding the
					    band, the 180ms fold morph. pointer-events-auto: the
					    overlay is none by default. The isAtBottom/scrollToBottom
					    context still reaches it — DockOverlay is a Conversation
					    child. */}
					<ConversationScrollButton className="pointer-events-auto bottom-full mb-2" />
				</div>
				{/* The plan marginalia (owner, plan-placement round): the bare
				    diagram in the band's right flank — boundaless, meet-fitted, part
				    of the lesson's page rather than a floating widget. Mounted only
				    while a question owns the band (its reserved height is the canvas);
				    folding the dock fades + blurs it out of existence, so reading
				    the transcript in full wipes the margin clean. Click → popup.
				    Width (owner, resize round): the box shrinks continuously with
				    the flank; below MARGIN_MIN_W it FADES (never pops away — no
				    mid-question unmount), and widening past the floor fades it
				    back in. */}
				{pending && plan && (
					<Hint label="Open the full plan" side="bottom">
<button
						type="button"
						data-testid="plan-marginalia"
						onClick={onOpenPlan}
						style={{ left: `calc(50% + ${DOCK_W / 2 + MARGIN_GAP}px)` }}
						className={`absolute bottom-5 right-4 top-0 cursor-pointer transition-[filter,opacity] duration-300 ease-out ${
							expanded && flankW >= MARGIN_MIN_W
								? "pointer-events-auto opacity-100 blur-0"
								: "pointer-events-none opacity-0 blur-md"
						}`}
					>
						{plan}
					</button>
</Hint>
				)}
			</div>
		</div>
	);
}
