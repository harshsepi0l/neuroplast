"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Ellipsis, Search } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import { Input } from "@/ui/easyui/Form";
import { useSessions } from "./session-context";
import { DeleteSessionDialog } from "./session/delete-session-dialog";
import { CoverageMenuBlock } from "@/features/knowledge/ui/extraction-coverage";
import type { ChatListItem } from "../core/chat";
export function SessionsPage() {
  const { sessions, loading, error, refresh } = useSessions(); const router = useRouter();
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState<string | null>(null); const [deleting, setDeleting] = useState<ChatListItem | null>(null);
  const [renaming, setRenaming] = useState<ChatListItem | null>(null); const [title, setTitle] = useState(""); const [failure, setFailure] = useState("");
  const filtered = sessions.filter(session => session.title.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || session.kind === filter));
  async function rename() {
    const response = await fetch(`/api/chats/${renaming!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!response.ok) { setFailure("The session could not be renamed. Please try again."); return; }
    setRenaming(null); setFailure(""); await refresh();
  }
  return <div className="integrated-scroll"><section className="settings-page"><div className="eyebrow">OLDER LEARNING RECORDS</div><h1>Session history.</h1><p className="page-intro">Your earlier tutor and practice sessions remain available here.</p>
    <Input aria-label="Search sessions" placeholder="Search sessions…" leftIcon={<Search size={16}/>} value={search} onChange={event => setSearch(event.target.value)}/>
    <div className="session-filters">{[{ id: "all", label: "All" }, { id: "teach", label: "Learning" }, { id: "practice", label: "Practice" }].map(item => <Button key={item.id} variant={filter === item.id ? "secondary" : "ghost"} size="sm" onClick={() => setFilter(item.id)}>{item.label}</Button>)}</div>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="sessions-grid">{filtered.map(session => <article className="saved-session" key={session.id}><Button variant="secondary" className="session-card" onClick={() => router.push(`/chat/${session.id}`)}><span className="small-label">{session.kind === "practice" ? "PRACTICE" : "LEARNING"} · {new Date(session.updatedAt).toLocaleDateString()}</span><strong>{session.title}</strong><span className="muted">{session.busy ? "Responding…" : session.pendingQuestion || session.pendingProblem ? "Waiting for your answer" : `${session.messageCount} messages`}<ArrowRight size={14}/></span></Button>
      <Button className="session-options" variant="ghost" size="icon" aria-label={`Actions for ${session.title}`} aria-expanded={menu === session.id} onClick={() => setMenu(menu === session.id ? null : session.id)}><Ellipsis size={16}/></Button>
      {menu === session.id && <><button className="menu-dismiss" aria-label="Close session menu" onClick={() => setMenu(null)}/><div className="dropdown" role="menu"><Button role="menuitem" variant="ghost" onClick={() => { setRenaming(session); setTitle(session.title); setMenu(null); }}>Rename</Button><a role="menuitem" className="export-link" href={`/api/chats/${session.id}/markdown`} download onClick={() => setMenu(null)}>Export Markdown</a><Button role="menuitem" variant="ghost" onClick={() => { setDeleting(session); setMenu(null); }}>Delete session</Button><CoverageMenuBlock chatId={session.id}/></div></>}
    </article>)}{!filtered.length && <div className="empty-sessions"><BookOpen size={28}/><p>{loading ? "Loading sessions…" : search ? "No sessions match your search." : "No older sessions yet."}</p><Button variant="secondary" onClick={() => router.push("/")}>View challenges</Button></div>}</div>
    <DeleteSessionDialog chat={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); void refresh(); }}/>
    {renaming && <div className="modal-scrim"><form className="confirm-dialog" role="dialog" aria-modal="true" aria-label="Rename session" onSubmit={event => { event.preventDefault(); void rename().catch(() => setFailure("The session could not be renamed.")); }}><h2>Rename session</h2><Input aria-label="Session title" value={title} onChange={event => setTitle(event.target.value)} autoFocus/>{failure && <p className="error-text" role="alert">{failure}</p>}<div className="connection-actions"><Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button><Button type="submit" disabled={!title.trim()}>Save</Button></div></form></div>}
  </section></div>;
}
