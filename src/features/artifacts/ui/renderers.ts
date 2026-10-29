import type { ComponentType } from "react";
import type { ArtifactPartProps } from "@/features/learning/core/chat";
import { DemoCard } from "@/features/artifacts/ui/demo-card";
import { JobCard, PdfJobCard } from "@/features/artifacts/ui/job-card";
import { VisualCard } from "@/features/artifacts/ui/visual-card";
import { ProbeDoneCard } from "@/features/learning/ui/messages/probe-done-card";
import { ProblemCard, ConcludeCard } from "@/features/learning/ui/docks/practice-cards";

/**
 * Artifact renderer registry — the extension point for tool-part UI.
 *
 * chat.tsx renders any tool part it doesn't specially handle (i.e. not
 * quiz/ask) by looking the tool name up here. Add your renderer — do NOT
 * edit chat.tsx.
 *
 * Typical shape: while the part is input-available render an activity card
 * (the chat view's jobs feed reads GET /api/jobs?chatId=…; on completion call
 * ChatActionsContext.syncFromServer()); when output-available render the
 * artifact itself from part.output.
 */
export const artifactRenderers: Record<string, ComponentType<ArtifactPartProps>> = {
	research: JobCard,
	pdf: PdfJobCard, // sources v0 — live smoke 2026-09-19 caught the gap: without this the tool-pdf dispatch part rendered nothing
	// plan_* parts render nothing inline by design: the phase seam is a
	// message-level boundary, drawn by PhaseDivider in chat.tsx (the old
	// part-level plan_init divider retired with it).
	// Artifacts (W6 fills in the components):
	demo: DemoCard,
	visual: VisualCard,
	// The probe conclusion: the assessment belongs to the learner as much as
	// to the transcript. Plain v1 card.
	probe_done: ProbeDoneCard,
	// Background steps (reading files, looking over past sessions) render
	// nothing: they are the tutor's own legwork, not part of the lesson.
	// The practice pair (2026-10-04): the pose renders the statement ONLY
	// (the commitment lives in the call's arguments and never renders);
	// the conclusion carries the outcome + verdict + the reveal.
	problem: ProblemCard,
	conclude: ConcludeCard,
};
