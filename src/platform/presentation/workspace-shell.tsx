"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, GitBranch, MessageSquare, Plus, Settings2, Trophy, Unplug } from "lucide-react";
import { Button } from "@/shared/ui/easyui/Button";
import { NeuroplastLogo } from "@/shared/ui/neuroplast-logo";
import { useSidebar, SidebarToggle } from "./sidebar";
import { useSettingsDialog } from "@/domains/preferences/presentation/settings-dialog";
import { useSessions } from "@/domains/learning/presentation/session-context";
import { useModelCatalog } from "@/domains/learning/presentation/tutoring/model-picker";

export function WorkspaceHeader({ title, modelLabel, modelReady, showModel = true }: { title: string; modelLabel: string; modelReady: boolean; showModel?: boolean }) {
  const router = useRouter();
  return <header className="topbar"><div className="row gap-3"><SidebarToggle/><span className="breadcrumb">Workspace</span><ChevronRight size={12}/><span className="topbar-title">{title}</span></div>
    {showModel && <Button variant="ghost" size="sm" onClick={() => router.push("/connections")} className="model-badge"><span className={`connection-dot ${modelReady ? "online" : ""}`}/>{modelLabel}<ChevronDown size={12}/></Button>}
  </header>;
}
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { open, toggle } = useSidebar();
  const { sessions } = useSessions(); const { catalog } = useModelCatalog(); const settings = useSettingsDialog();
  const selected = catalog?.defaults?.model;
  const modelReady = Boolean(selected && catalog?.providers.some(provider => provider.id === selected.provider && provider.keyPresent));
  const modelLabel = modelReady ? catalog?.models.find(model => model.provider === selected?.provider && model.id === selected.id)?.name ?? selected?.id ?? "Model ready" : "Connect a model";
  function navigate(href: string) { router.push(href); if (window.innerWidth <= 760 && open) toggle(); }
  const navigation = [{ href: "/", label: "Challenges", icon: Trophy }, { href: "/knowledge", label: "Knowledge tree", icon: GitBranch }, { href: "/sessions", label: "Session history", icon: MessageSquare }, { href: "/connections", label: "Connections", icon: Unplug }];
  const activeChat = pathname.startsWith("/chat/") && pathname !== "/chat/new";
  const title = pathname === "/connections" ? "Connections" : pathname === "/sessions" ? "Session history" : pathname.startsWith("/challenge/") ? "Challenge" : pathname === "/challenges/new" ? "New challenge" : pathname === "/knowledge/legacy" ? "Notes graph" : pathname.startsWith("/knowledge") ? "Knowledge tree" : "Challenges";
  return <div className={`workspace integrated-workspace ${open ? "navigation-open" : "navigation-closed"}`}>
    {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={toggle}/>}
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation" inert={!open}>
      <Button variant="ghost" className="brand" onClick={() => navigate("/")} aria-label="neuroplast home"><NeuroplastLogo className="brand-mark"/><span>neuroplast</span></Button>
      <Button variant="secondary" fullWidth leftIcon={<Plus size={16}/>} className="new-session" onClick={() => navigate("/challenges/new")}>New challenge</Button>
      <div className="nav-label">WORKSPACE</div><nav aria-label="Workspace navigation">{navigation.map(({ href, label, icon: Icon }) =>
        <Button key={href} variant="ghost" className={`nav-item ${pathname === href || (href === "/" && (pathname.startsWith("/challenge/") || pathname.startsWith("/challenges/"))) || (href === "/knowledge" && pathname.startsWith("/knowledge/")) ? "selected" : ""}`} leftIcon={<Icon size={17}/>} onClick={() => navigate(href)}>{label}{href === "/sessions" && <span className="nav-count">{sessions.length}</span>}</Button>)}</nav>
      <div className="between nav-label"><span>OLDER SESSIONS</span><span>{sessions.length ? String(sessions.length).padStart(2, "0") : ""}</span></div>
      <div className="recent-list">{sessions.slice(0, 12).map(session => <Button key={session.id} variant="ghost" className={`session-row ${pathname === `/chat/${session.id}` ? "selected" : ""}`} leftIcon={<MessageSquare size={14}/>} onClick={() => navigate(`/chat/${session.id}`)}><span>{session.title}</span>{session.busy && <span className="session-working" aria-label="Responding"/>}</Button>)}
        {!sessions.length && <p className="empty-sidebar">Your previous tutor sessions will appear here.</p>}</div>
      <div className="sidebar-footer"><Button variant="ghost" fullWidth className="nav-item" leftIcon={<Settings2 size={17}/>} onClick={() => settings.open("appearance")}>Preferences</Button>
        <Button variant="ghost" fullWidth className="connection-footer" onClick={() => navigate("/connections")}><span className={`connection-dot ${modelReady ? "online" : ""}`}/><span>{modelReady ? "Model ready" : "Connect a model"}</span><ChevronRight size={14}/></Button></div>
    </aside><main className="main-pane">{!activeChat && <WorkspaceHeader title={title} modelLabel={modelLabel} modelReady={modelReady} showModel={pathname !== "/" && !pathname.startsWith("/challenge/") && pathname !== "/knowledge"}/>}<div className="integrated-content">{children}</div></main>
  </div>;
}
