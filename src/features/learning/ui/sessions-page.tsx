"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Ellipsis, Search } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import { Input } from "@/ui/easyui/Form";
import { useSessions } from "./session-context";
import { DeleteSessionDialog } from "./session/delete-session-dialog";
import { CoverageMenuBlock } from "@/features/knowledge/ui/extraction-coverage";
import type { ChatListItem } from "../core/chat";
import type { ChallengeSummary } from "@/features/challenges/core/contracts";
import { loadChallengeList } from "@/features/challenges/ui/challenge-api";

function challengeStatus(challenge: ChallengeSummary): string {
  if (!challenge.submittedAt) return "In progress";
  return `${challenge.score}/100${challenge.goalMet ? " · cleared" : ""}`;
}
export function SessionsPage() {
  const { sessions, loading, error, refresh } = useSessions(); const router = useRouter();
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState<string | null>(null); const [deleting, setDeleting] = useState<ChatListItem | null>(null);
  const [renaming, setRenaming] = useState<ChatListItem | null>(null); const [title, setTitle] = useState(""); const [failure, setFailure] = useState("");
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]); const [removing, setRemoving] = useState<ChallengeSummary | null>(null);
  const loadChallenges = useCallback(() => loadChallengeList().then(setChallenges).catch(() => setChallenges([])), []);
  useEffect(() => { void loadChallenges(); }, [loadChallenges]);
  const matches = (title: string) => title.toLowerCase().includes(search.toLowerCase());
  const filtered = sessions.filter(session => matches(session.title) && (filter === "all" || session.kind === filter));
  const shownChallenges = filter === "all" || filter === "challenge" ? challenges.filter(challenge => matches(challenge.topicTitle)) : [];
  async function removeChallenge() {
    const response = await fetch(`/api/challenges/${removing!.id}`, { method: "DELETE", headers: { "x-neuroplast-client": "web" } });
    if (!response.ok) { setFailure("The challenge could not be deleted. Please try again."); return; }
    setRemoving(null); setFailure(""); await loadChallenges();
  }
  async function rename() {
    const response = await fetch(`/api/chats/${renaming!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!response.ok) { setFailure("The session could not be renamed. Please try again."); return; }
    setRenaming(null); setFailure(""); await refresh();
  }
  return <div className="integrated-scroll"><section className="settings-page"><h1>Sessions</h1>
    <Input aria-label="Search sessions" placeholder="Search sessions…" leftIcon={<Search size={16}/>} value={search} onChange={event => setSearch(event.target.value)}/>
    <div className="session-filters">{[{ id: "all", label: "All" }, { id: "teach", label: "Learning" }, { id: "practice", label: "Practice" }, { id: "challenge", label: "Challenges" }].map(item => <Button key={item.id} variant={filter === item.id ? "secondary" : "ghost"} size="sm" onClick={() => setFilter(item.id)}>{item.label}</Button>)}</div>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="sessions-grid">{filtered.map(session => <article className="saved-session" key={session.id}><Button variant="secondary" className="session-card" onClick={() => router.push(session.kind === "practice" ? `/chat/${session.id}` : `/sessions/${session.id}`)}><span className="small-label">{session.kind === "practice" ? "PRACTICE" : "LEARNING"} · {new Date(session.updatedAt).toLocaleDateString()}</span><strong>{session.title}</strong><span className="muted">{session.busy ? "Responding…" : session.pendingQuestion || session.pendingProblem ? "Waiting for your answer" : `${session.messageCount} messages`}<ArrowRight size={14}/></span></Button>
      <Button className="session-options" variant="ghost" size="icon" aria-label={`Actions for ${session.title}`} aria-expanded={menu === session.id} onClick={() => setMenu(menu === session.id ? null : session.id)}><Ellipsis size={16}/></Button>
      {menu === session.id && <><button className="menu-dismiss" aria-label="Close session menu" onClick={() => setMenu(null)}/><div className="dropdown" role="menu"><Button role="menuitem" variant="ghost" onClick={() => { setRenaming(session); setTitle(session.title); setMenu(null); }}>Rename</Button><a role="menuitem" className="export-link" href={`/api/chats/${session.id}/markdown`} download onClick={() => setMenu(null)}>Export Markdown</a><Button role="menuitem" variant="ghost" onClick={() => { setDeleting(session); setMenu(null); }}>Delete session</Button><CoverageMenuBlock chatId={session.id}/></div></>}
    </article>)}
    {shownChallenges.map(challenge => <article className="saved-session" key={challenge.id}><Button variant="secondary" className="session-card" onClick={() => router.push(`/challenge/${challenge.id}`)}><span className="small-label">CHALLENGE · {new Date(challenge.createdAt).toLocaleDateString()}</span><strong>{challenge.topicTitle}</strong><span className="muted">{challengeStatus(challenge)}<ArrowRight size={14}/></span></Button>
      <Button className="session-options" variant="ghost" size="icon" aria-label={`Actions for ${challenge.topicTitle}`} aria-expanded={menu === challenge.id} onClick={() => setMenu(menu === challenge.id ? null : challenge.id)}><Ellipsis size={16}/></Button>
      {menu === challenge.id && <><button className="menu-dismiss" aria-label="Close challenge menu" onClick={() => setMenu(null)}/><div className="dropdown" role="menu"><Button role="menuitem" variant="ghost" onClick={() => { setRemoving(challenge); setFailure(""); setMenu(null); }}>Delete challenge</Button></div></>}
    </article>)}
    {!filtered.length && !shownChallenges.length && <div className="empty-sessions"><BookOpen size={28}/><p>{loading ? "Loading sessions…" : search ? "No sessions match your search." : "No sessions yet."}</p></div>}</div>
    {removing && <div className="modal-scrim"><div className="confirm-dialog" role="dialog" aria-modal="true" aria-label="Delete challenge"><h2>Delete challenge?</h2><p>{removing.topicTitle} · {new Date(removing.createdAt).toLocaleDateString()}</p>{failure && <p className="error-text" role="alert">{failure}</p>}<div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="destructive" onClick={() => void removeChallenge().catch(() => setFailure("The challenge could not be deleted."))}>Delete</Button></div></div></div>}
    <DeleteSessionDialog chat={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); void refresh(); }}/>
    {renaming && <div className="modal-scrim"><form className="confirm-dialog" role="dialog" aria-modal="true" aria-label="Rename session" onSubmit={event => { event.preventDefault(); void rename().catch(() => setFailure("The session could not be renamed.")); }}><h2>Rename session</h2><Input aria-label="Session title" value={title} onChange={event => setTitle(event.target.value)} autoFocus/>{failure && <p className="error-text" role="alert">{failure}</p>}<div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button><Button type="submit" disabled={!title.trim()}>Save</Button></div></form></div>}
  </section></div>;
}
