import { useEffect, useLayoutEffect } from "react";

/** One width for everything: transcript, cards, and the bottom blob share this column. */
/**
 * Width tokens (wave-5 reskin, owner decision): the teaching PROSE spans the
 * full session width with a thin px-6 margin; the composer/question DOCK is
 * deliberately narrower (~46rem centered) per the reference. Same ELEMENT,
 * same place — width polish only.
 */
export const COLUMN = "mx-auto w-full max-w-none px-6";
export const DOCK = "mx-auto w-full max-w-[46rem] px-4";
// The DOCK container's fixed width (46rem) and the plan marginalia's
// geometry (owner, plan-placement round): the bare diagram sits in the
// dock band's RIGHT flank — MARGIN_GAP from the DOCK container's edge and
// the same from the column's right edge. The box width is pure CSS, so
// the diagram shrinks CONTINUOUSLY with the flank; MARGIN_MIN_W is only
// the fade floor (owner, resize round) — below it the marginalia fades
// out over the normal transition instead of popping away, and it stays
// mounted while the question owns the band so widening fades it back.
export const DOCK_W = 46 * 16;
export const MARGIN_GAP = 16;
export const MARGIN_MIN_W = 220;
// The dock overlay's gradient band (h-24) — part of the reserved tail.
export const GRADIENT_H = 96;
// Fold thresholds (owner, scroll round 1, tuned round 3): pixel distance
// from the bottom — position, not velocity. Leave the bottom → the box
// folds (visual only); reach it again → it re-opens. 96 (was 64, owner
// round 3) tolerates a small peek upward without folding; the dead band
// vs EXPAND_DIST absorbs trackpad drift.
export const COLLAPSE_DIST = 96;
export const EXPAND_DIST = 16;

/** useLayoutEffect that is silent during SSR (client components still render on the server in Next). */
export const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
