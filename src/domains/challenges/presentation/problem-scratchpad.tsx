"use client";

import dynamic from "next/dynamic";
import { PencilLine, X } from "lucide-react";
import { useState, type ReactNode } from "react";

const ScratchpadCanvas = dynamic(() => import("./scratchpad-canvas"), {
  ssr: false,
  loading: () => <div className="scratchpad-loading">Loading drawing tools…</div>,
});

export function ProblemScratchpad({ challengeId, questionId, children }: {
  challengeId: string;
  questionId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <div className={`problem-workspace${open ? " scratchpad-open" : ""}`}>
    <div className="problem-main">
      <button className="scratchpad-toggle" type="button" aria-expanded={open} aria-controls="problem-scratchpad" onClick={() => setOpen(value => !value)}>
        <PencilLine size={16}/>{open ? "Hide scratchpad" : "Open scratchpad"}
      </button>
      {children}
    </div>
    {open && <aside className="scratchpad-panel" id="problem-scratchpad" aria-label="Scratchpad">
      <div className="scratchpad-heading"><div><strong>Scratchpad</strong><span>Work out this problem here</span></div><button type="button" aria-label="Close scratchpad" onClick={() => setOpen(false)}><X size={17}/></button></div>
      <ScratchpadCanvas key={`${challengeId}:${questionId}`} storageKey={`neuroplast:scratchpad:v1:${challengeId}:${questionId}`}/>
    </aside>}
  </div>;
}
