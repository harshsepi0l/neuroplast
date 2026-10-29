"use client";

import dynamic from "next/dynamic";
import { PencilLine } from "lucide-react";
import { useState, type ReactNode } from "react";
import { scratchpadKey } from "./print-drawings";

const ScratchpadCanvas = dynamic(() => import("./scratchpad-canvas"), {
  ssr: false,
  loading: () => <div className="scratchpad-loading">Loading drawing tools…</div>,
});

/** A problem with an on-demand scratchpad that unfolds below it, full column width. */
export function ProblemScratchpad({ challengeId, questionId, children }: {
  challengeId: string;
  questionId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `scratchpad-${questionId}`;
  return <div className={`problem-workspace${open ? " scratchpad-open" : ""}`}>
    {children}
    <button className="scratchpad-toggle" type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <PencilLine size={16}/>{open ? "Hide scratchpad" : "Scratchpad"}
    </button>
    {open && <div className="scratchpad-panel" id={panelId} role="region" aria-label="Scratchpad">
      <ScratchpadCanvas key={`${challengeId}:${questionId}`} storageKey={scratchpadKey(challengeId, questionId)}/>
    </div>}
    <div className="print-only print-drawing" data-print-drawing={scratchpadKey(challengeId, questionId)}/>
  </div>;
}
