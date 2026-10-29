"use client";
import Link from "next/link";
import { SOURCE_URL } from "./source";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, ChevronDown, ChevronRight, GitBranch, Home, MessageSquare, Settings2, Trophy } from "lucide-react";
import { Button } from "@/ui/easyui/Button";
import { useSidebar, SidebarToggle } from "./sidebar";
import { useSettingsDialog } from "@/features/settings/ui/settings-dialog";
import { useSessions } from "@/features/learning/ui/session-context";
import { useModelCatalog } from "@/features/learning/ui/composer/model-picker";

export function WorkspaceHeader({ title, modelLabel, modelReady, showModel = true }: { title: string; modelLabel: string; modelReady: boolean; showModel?: boolean }) {
  const router = useRouter();
  return <header className="topbar"><div className="row gap-3"><SidebarToggle/>{title === "Home" ? <span className="topbar-title">Home</span> : <><Link href="/" className="breadcrumb">Home</Link><ChevronRight size={12}/><span className="topbar-title">{title}</span></>}</div>
    {showModel && <Button variant="ghost" size="sm" onClick={() => router.push("/connections")} className="model-badge"><span className={`connection-dot ${modelReady ? "online" : ""}`}/>{modelLabel}<ChevronDown size={12}/></Button>}
  </header>;
}
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { open, toggle } = useSidebar();
  const { sessions, loading: sessionsLoading, error: sessionsError } = useSessions(); const { catalog } = useModelCatalog(); const settings = useSettingsDialog();
  const selected = catalog?.defaults?.model;
  const modelReady = Boolean(selected && catalog?.providers.some(provider => provider.id === selected.provider && provider.keyPresent));
  const modelLabel = modelReady ? catalog?.models.find(model => model.provider === selected?.provider && model.id === selected.id)?.name ?? selected?.id ?? "Model configured" : "Connect a model";
  function closeMobileNavigation() { if (window.innerWidth <= 760 && open) toggle(); }
  function navigate(href: string) { router.push(href); closeMobileNavigation(); }
  const navigation = [
    { href: "/", label: "Home", icon: Home, active: pathname === "/" },
    { href: "/chat/new", label: "Learn", icon: BookOpen, active: pathname.startsWith("/chat/") || pathname === "/practice" },
    { href: "/challenges", label: "Challenges", icon: Trophy, active: pathname === "/challenges" || pathname.startsWith("/challenges/") || pathname.startsWith("/challenge/") },
    { href: "/knowledge", label: "Knowledge", icon: GitBranch, active: pathname.startsWith("/knowledge") },
    { href: "/sessions", label: "Sessions", icon: MessageSquare, active: pathname.startsWith("/sessions") },
  ];
  const activeChat = (pathname.startsWith("/chat/") && pathname !== "/chat/new") || pathname.startsWith("/sessions/");
  const title = pathname === "/connections" ? "Connections" : pathname.startsWith("/sessions") ? "Sessions" : pathname.startsWith("/challenge/") ? "Challenge" : pathname === "/challenges/new" ? "New challenge" : pathname === "/challenges" ? "Challenges" : pathname === "/knowledge/legacy" ? "Notes graph" : pathname.startsWith("/knowledge") ? "Knowledge" : pathname === "/practice" ? "Practice" : pathname === "/settings" ? "Settings" : pathname === "/" ? "Home" : "Learn";
  const recentSession = sessions[0];
  return <div className={`workspace integrated-workspace ${open ? "navigation-open" : "navigation-closed"}`}>
    {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={toggle}/>}
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation" inert={!open}>
      <Button variant="ghost" className="brand" onClick={() => navigate("/")} aria-label="neuroplast home"><span className="sketch-brand-mark" aria-hidden="true"/><span>neuroplast</span></Button>
      <nav aria-label="Workspace navigation">{navigation.map(({ href, label, icon: Icon, active }) =>
        <Button key={href} variant="ghost" className={`nav-item ${active ? "selected" : ""}`} aria-current={active ? "page" : undefined} leftIcon={<Icon size={17}/>} onClick={() => navigate(href)}>{label}{href === "/sessions" && <span className="nav-count">{sessions.length}</span>}</Button>)}
        <Button variant="ghost" fullWidth className="nav-item" leftIcon={<Settings2 size={17}/>} onClick={() => { closeMobileNavigation(); settings.open("appearance"); }}>Settings</Button>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-recent">
          {recentSession ? <button className="sidebar-plan" onClick={() => navigate(`/chat/${recentSession.id}`)}><strong>{recentSession.title}</strong><span>{recentSession.busy ? "Responding…" : "Continue recent session"}</span></button> : <div className="sidebar-plan"><strong>Recent session</strong><span>{sessionsLoading ? "Loading sessions…" : sessionsError ? "Sessions unavailable" : "Your next session starts here."}</span></div>}
        </div>
        <Button variant="ghost" fullWidth className="connection-footer" onClick={() => navigate("/connections")} aria-label="Manage model connections"><span className={`connection-dot ${modelReady ? "online" : ""}`}/><span>{modelReady ? "Model configured" : "Connect a model"}</span><ChevronRight size={14}/></Button>
        <a className="source-link" href={SOURCE_URL} target="_blank" rel="noreferrer">Source code · AGPL-3.0</a>
      </div>
    </aside><main className="main-pane">{!activeChat && <WorkspaceHeader title={title} modelLabel={modelLabel} modelReady={modelReady}/>}<div className="integrated-content">{children}</div></main>
  </div>;
}
