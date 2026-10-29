"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Network, X } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import { Composer } from "./start-composer";
import { useModelCatalog } from "./composer/model-picker";
import { useDraft } from "./draft-context";
import { stageOpeningMessage } from "./opening-message";
import type { LessonMode } from "../core/lesson";
/** Creates a Learn or Practice session that opens with `text`; returns its id. */
export async function startSession(text: string, mode: LessonMode, picks: unknown[] = []): Promise<string> {
  const response = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: text.split("\n")[0], ...(mode === "practice" ? { kind: "practice", graphContext: { propositions: picks } } : {}) }) });
  const body = await response.json(); if (!response.ok || !body.id) throw new Error(body.error || "Your session could not be started.");
  stageOpeningMessage(body.id, text);
  return body.id;
}

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
      router.push(`/chat/${await startSession(text, mode, draft.picks)}`); return true;
    } catch (failure) { setError((failure as Error).message); setBusy(false); return false; }
  }
  return <div className="learning-pane">
    {error && <div className="error-banner" role="alert"><span>{error}</span><Button variant="ghost" size="sm" aria-label="Dismiss message" onClick={() => setError("")}><X size={15}/></Button></div>}
    <section className="welcome"><h1>{mode === "practice" ? <>Ready to put it<br/><span>into practice?</span></> : <>What would you like<br/><span>to understand?</span></>}</h1>
      <div className="suggestions">{suggestions.map(text => <Button key={text} variant="secondary" size="sm" disabled={busy} onClick={() => draft.update({ text })}>{text}<ArrowRight size={13}/></Button>)}</div>
      {!ready && <div className="welcome-footnote"><span>Connect a model to start.</span></div>}
    </section>
    {mode === "practice" && <div className="practice-context"><Button variant="ghost" size="sm" leftIcon={<Network size={14}/>} onClick={() => router.push("/knowledge")}>{draft.picks.length ? `${draft.picks.length} knowledge topics selected` : "Practice from your knowledge"}</Button>{draft.picks.length > 0 && <Button variant="ghost" size="sm" onClick={() => draft.update({ picks: [] })}>Clear</Button>}</div>}
    <Composer busy={busy} ready={ready} mode={mode} setMode={setMode} send={send} stop={() => {}} enterToSend connect={() => router.push("/connections")}/>
  </div>;
}
