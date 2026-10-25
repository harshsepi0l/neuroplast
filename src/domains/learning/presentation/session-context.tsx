"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ChatListItem } from "../domain/contracts/chat";
import { useServerEvent, useServerResync } from "./tutoring/server-events";
const SessionContext = createContext<{ sessions: ChatListItem[]; error: string; loading: boolean; refresh: () => Promise<void> }>({ sessions: [], error: "", loading: true, refresh: async () => {} });
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ChatListItem[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const refresh = useCallback(async () => {
    try { const response = await fetch("/api/chats", { cache: "no-store" }); if (!response.ok) throw new Error("Your sessions could not be loaded."); const body = await response.json(); setSessions(body.chats); setError(""); }
    catch (failure) { setError((failure as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [pathname, refresh]);
  useEffect(() => { const changed = () => { void refresh(); }; window.addEventListener("neuroplast:chat-renamed", changed); return () => window.removeEventListener("neuroplast:chat-renamed", changed); }, [refresh]);
  useServerEvent("chats-changed", () => void refresh()); useServerEvent("turn-started", () => void refresh()); useServerEvent("turn-settled", () => void refresh()); useServerEvent("compaction-changed", () => void refresh()); useServerResync(() => void refresh());
  return <SessionContext.Provider value={{ sessions, error, loading, refresh }}>{children}</SessionContext.Provider>;
}
export function useSessions() { return useContext(SessionContext); }
