"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Network, Sparkles, X } from "lucide-react";
import { Button } from "@/shared/ui/easyui/Button";
import { Composer } from "./composer";
import { useModelCatalog } from "./tutoring/model-picker";
import { useDraft } from "./draft-context";
import { stageOpeningMessage } from "./opening-message";
import type { LessonMode } from "../domain/lesson";
const suggestions = ["Understand a difficult topic", "Practice something new", "Explore an idea"];

export function LearningStart({ initialMode = "learn" }: { initialMode?: LessonMode }) {
  const router = useRouter(); const [mode, setMode] = useState<LessonMode>(initialMode);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const { catalog } = useModelCatalog(); const draft = useDraft(mode);
  const ready = Boolean(catalog?.defaults && catalog.providers.some(provider => provider.id === catalog.defaults?.model.provider && provider.keyPresent));
  async function send(text: string) {
    if (busy) return false;
    if (!ready) { router.push("/connections"); return false; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: text.split("\n")[0], ...(mode === "practice" ? { kind: "practice", graphContext: { propositions: draft.picks } } : {}) }) });
      const body = await response.json(); if (!response.ok || !body.id) throw new Error(body.error || "Your session could not be started.");
      stageOpeningMessage(body.id, text);
      router.push(`/chat/${body.id}`); return true;
    } catch (failure) { setError((failure as Error).message); setBusy(false); return false; }
  }
  return <div className="learning-pane">
    {error && <div className="error-banner" role="alert"><span>{error}</span><Button variant="ghost" size="sm" aria-label="Dismiss message" onClick={() => setError("")}><X size={15}/></Button></div>}
    <section className="welcome"><div className="welcome-mark"/><h1>{mode === "practice" ? <>Ready to put it<br/><span>into practice?</span></> : <>What would you like<br/><span>to understand?</span></>}</h1><p>Work through a question, explore a new idea,<br className="desktop-break"/> or practice until it clicks.</p>
      <div className="suggestions">{suggestions.map(text => <Button key={text} variant="secondary" size="sm" disabled={busy} onClick={() => draft.update({ text })}>{text}<ArrowRight size={13}/></Button>)}</div>
      <div className="welcome-footnote"><Sparkles size={13}/><span>{ready ? "Your tutor is ready. What are you curious about?" : "Add a provider key or connect Grok to bring your tutor online."}</span></div>
    </section>
    {mode === "practice" && <div className="practice-context"><Button variant="ghost" size="sm" leftIcon={<Network size={14}/>} onClick={() => router.push("/knowledge")}>{draft.picks.length ? `${draft.picks.length} knowledge topics selected` : "Practice from your knowledge"}</Button>{draft.picks.length > 0 && <Button variant="ghost" size="sm" onClick={() => draft.update({ picks: [] })}>Clear</Button>}</div>}
    <Composer busy={busy} ready={ready} mode={mode} setMode={setMode} send={send} stop={() => {}} enterToSend connect={() => router.push("/connections")}/>
  </div>;
}
