"use client";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import { Select, Textarea } from "@/ui/easyui/Form";
import type { LessonMode } from "../core/lesson";
import { useDraft } from "./draft-context";
import { AttachButton, useAttachments } from "./composer/attach";
import { withAttachments } from "../core/attachments";

export function Composer({ busy, ready, mode, setMode, send, stop, enterToSend, connect }: {
  busy: boolean; ready: boolean; mode: LessonMode; setMode: (mode: LessonMode) => void;
  send: (text: string) => Promise<boolean>; stop: () => void; enterToSend: boolean; connect: () => void;
}) {
  const saved = useDraft(mode);
  const draft = saved.text;
  const setDraft = (text: string) => saved.update({ text });
  const attachments = useAttachments();
  async function submit() {
    if (busy || !draft.trim() || attachments.uploading) return;
    if (!ready) { connect(); return; }
    const original = draft; const files = attachments.files;
    setDraft(""); attachments.clear();
    if (!await send(withAttachments(original, files))) { setDraft(original); attachments.restore(files); }
  }
  return <div className="composer-wrap">
    <div className="composer-box">
      {attachments.files.map(file => <div key={file.path} className="attachment" data-testid="attachment-chip"><Paperclip size={13}/><span>{file.name}</span><Button variant="ghost" size="sm" aria-label={`Remove ${file.name}`} onClick={() => attachments.remove(file.path)}><X size={13}/></Button></div>)}
      <Textarea aria-label="Message your tutor" placeholder="Ask about anything — or start a challenge…"
        value={draft} maxLength={6000} onChange={event => setDraft(event.target.value)} className="composer-input"
        onKeyDown={event => { if (enterToSend && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }}/>
      <div className="composer-toolbar">
        <div className="row gap-2">
          <AttachButton attachments={attachments} disabled={busy} className="grid size-10 place-items-center rounded-lg border-2 border-[var(--stroke)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-40"/>
          <Select aria-label="Learning mode" value={mode} disabled={busy} onChange={event => setMode(event.target.value as LessonMode)} options={[{ value: "learn", label: "Learn" }, { value: "practice", label: "Practice" }]} className="mode-select"/>
        </div>
        {busy ? <Button size="icon" variant="secondary" aria-label="Stop response" onClick={stop}><Square size={15} fill="currentColor"/></Button>
          : <Button size="icon" aria-label={ready ? "Send message" : "Connect a model to send"} disabled={!draft.trim()} onClick={() => void submit()} className="send-button"><ArrowUp size={19}/></Button>}
      </div>
    </div>
    {attachments.error && <div className="composer-caption"><span role="alert" className="error-text">{attachments.error}</span></div>}
  </div>;
}
