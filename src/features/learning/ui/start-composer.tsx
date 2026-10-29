"use client";
import { useRef, useState } from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import { Select, Textarea } from "@/ui/easyui/Form";
import type { LessonMode } from "../core/lesson";
import { useDraft } from "./draft-context";

export function Composer({ busy, ready, mode, setMode, send, stop, enterToSend, connect }: {
  busy: boolean; ready: boolean; mode: LessonMode; setMode: (mode: LessonMode) => void;
  send: (text: string) => Promise<boolean>; stop: () => void; enterToSend: boolean; connect: () => void;
}) {
  const saved = useDraft(mode);
  const draft = saved.text; const file = saved.file;
  const setDraft = (text: string) => saved.update({ text });
  const setFile = (file: { name: string; text: string } | null) => saved.update({ file });
  const [error, setError] = useState(""); const picker = useRef<HTMLInputElement>(null);
  async function submit() {
    if (busy || !draft.trim()) return;
    if (!ready) { connect(); return; }
    const message = draft.trim() + (file ? `\n\n--- Study material: ${file.name} ---\n${file.text}\n--- End study material ---` : "");
    const original = draft; const attachment = file; setDraft(""); setFile(null);
    if (!await send(message)) { setDraft(original); setFile(attachment); }
  }
  return <div className="composer-wrap">
    <div className="composer-box">
      {file && <div className="attachment"><Paperclip size={13}/><span>{file.name}</span><Button variant="ghost" size="sm" aria-label="Remove attachment" onClick={() => setFile(null)}><X size={13}/></Button></div>}
      <Textarea aria-label="Message your tutor" placeholder="Ask about anything — or start a challenge…"
        value={draft} maxLength={6000} onChange={event => setDraft(event.target.value)} className="composer-input"
        onKeyDown={event => { if (enterToSend && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }}/>
      <div className="composer-toolbar">
        <div className="row gap-2">
          <Button variant="ghost" size="icon" aria-label="Attach study notes" title="Attach a text or Markdown file" disabled={busy} onClick={() => picker.current?.click()}><Paperclip size={17}/></Button>
          <input ref={picker} type="file" className="sr-only" accept=".txt,.md,.markdown" onChange={async event => {
            const selected = event.target.files?.[0]; event.target.value = ""; if (!selected) return;
            if (selected.size > 24_000) { setError("Choose a text or Markdown file smaller than 24 KB."); return; }
            try { const text = await selected.text(); if (text.length > 16_000) throw new Error("Keep attached notes under 16,000 characters."); setFile({ name: selected.name, text }); setError(""); }
            catch (failure) { setError(failure instanceof Error ? failure.message : "The file could not be read."); }
          }}/>
          <Select aria-label="Learning mode" value={mode} disabled={busy} onChange={event => setMode(event.target.value as LessonMode)} options={[{ value: "learn", label: "Learn" }, { value: "practice", label: "Practice" }]} className="mode-select"/>
        </div>
        {busy ? <Button size="icon" variant="secondary" aria-label="Stop response" onClick={stop}><Square size={15} fill="currentColor"/></Button>
          : <Button size="icon" aria-label={ready ? "Send message" : "Connect a model to send"} disabled={!draft.trim()} onClick={() => void submit()} className="send-button"><ArrowUp size={19}/></Button>}
      </div>
    </div>
    <div className="composer-caption">{error ? <span role="alert" className="error-text">{error}</span> : <><span>{ready ? "Grok can make mistakes. Check important details." : "Your draft stays here while you connect."}</span><span>{enterToSend ? "↵ send · ⇧↵ new line" : "Click ↑ to send"}</span></>}</div>
  </div>;
}
