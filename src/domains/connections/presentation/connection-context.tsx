"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ConnectionView } from "../domain/connection";
import { notifySettingsSaved } from "@/platform/presentation/settings-signal";
async function requestConnection(command?: Record<string, string>, signal?: AbortSignal): Promise<ConnectionView> {
  const response = await fetch("/api/connections/grok", { method: command ? "POST" : "GET", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", "x-neuroplast-client": "web" }, ...(command ? { body: JSON.stringify(command) } : {}) });
  const body = await response.json(); if (!response.ok) throw new Error(body.error || "The connection request failed."); return body;
}
const ConnectionContext = createContext<{ connection: ConnectionView | null; busy: boolean; error: string; action: (command: Record<string, string>) => Promise<void> }>({ connection: null, busy: false, error: "", action: async () => {} });
export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<ConnectionView | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { const abort = new AbortController(); void requestConnection(undefined, abort.signal).then(setConnection).catch(failure => { if (!abort.signal.aborted) setError(failure.message); }); return () => abort.abort(); }, []);
  useEffect(() => {
    if (connection?.phase !== "pending" || !connection.attempt) return;
    const attempt = connection.attempt; const abort = new AbortController();
    const timer = setTimeout(() => {
      void requestConnection({ action: "poll", attemptId: attempt.id }, abort.signal).then(next => {
        setConnection(next); if (next.phase === "connected") { notifySettingsSaved("keys"); notifySettingsSaved("models"); }
      }).catch(failure => {
        if (abort.signal.aborted) return; setError(failure.message);
        setConnection(previous => previous?.attempt?.id === attempt.id ? { ...previous, attempt: { ...previous.attempt, nextPollAt: Date.now() + 5000 } } : previous);
      });
    }, Math.max(1000, attempt.nextPollAt - Date.now()));
    return () => { clearTimeout(timer); abort.abort(); };
  }, [connection]);
  const action = useCallback(async (command: Record<string, string>) => {
    setBusy(true); setError("");
    try { setConnection(await requestConnection(command)); notifySettingsSaved("keys"); notifySettingsSaved("models"); }
    catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }, []);
  return <ConnectionContext.Provider value={{ connection, busy, error, action }}>{children}</ConnectionContext.Provider>;
}
export function useConnection() { return useContext(ConnectionContext); }
