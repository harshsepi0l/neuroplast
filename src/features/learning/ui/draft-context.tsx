"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { LessonMode } from "../core/lesson";
export type StudyAttachment = { name: string; text: string };
export type KnowledgePick = { id: string; name: string; statement: string };
type Draft = { text: string; file: StudyAttachment | null; picks: KnowledgePick[] };
const empty = (): Draft => ({ text: "", file: null, picks: [] });
const DraftContext = createContext<{ drafts: Record<LessonMode, Draft>; update: (mode: LessonMode, delta: Partial<Draft>) => void }>({ drafts: { learn: empty(), practice: empty() }, update: () => {} });
export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<Record<LessonMode, Draft>>({ learn: empty(), practice: empty() });
  useEffect(() => { const reset = () => setDrafts({ learn: empty(), practice: empty() }); window.addEventListener("neuroplast:new-draft", reset); return () => window.removeEventListener("neuroplast:new-draft", reset); }, []);
  function update(mode: LessonMode, delta: Partial<Draft>) { setDrafts(previous => ({ ...previous, [mode]: { ...previous[mode], ...delta } })); }
  return <DraftContext.Provider value={{ drafts, update }}>{children}</DraftContext.Provider>;
}
export function useDraft(mode: LessonMode) { const { drafts, update } = useContext(DraftContext); return { ...drafts[mode], update: (delta: Partial<Draft>) => update(mode, delta) }; }
