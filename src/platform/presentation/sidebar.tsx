"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { PanelLeftOpenIcon } from "lucide-react";
import { Button } from "@/shared/ui/easyui/Button";
import { kbdEventForAction } from "@/domains/preferences/domain/keyboard";
import type { ChatGPTControlBridge } from "@/domains/connections/domain/contracts/chatgpt";
import type { NativeSubscriptionControlBridge } from "@/domains/connections/domain/contracts/subscriptions";
declare global {
	interface Window {
		/** Preload bridge (electron/preload.cjs) — Electron only, absent in the browser. */
		neuroplast?: {
			/** Read-only host OS; determines the native-control gutter. */
			platform?: string;
			chatgpt?: ChatGPTControlBridge;
			subscriptions?: NativeSubscriptionControlBridge;
			expandWindow: () => void;
			/** The zoom truth (owner round 7): subscribes to "neuroplast:zoom" pushes; returns unsubscribe. */
			onZoom?: (cb: (factor: number) => void) => () => void;
			getZoom?: () => Promise<number>;
			/** Auto-update channel (Wave C, 2026-10-10): "neuroplast:update-status" pushes once a staged update exists. */
			onUpdateStatus?: (cb: (status: { status: string; version: string | null }) => void) => () => void;
			installUpdate?: () => void;
		};
	}
}

const STORAGE_KEY = "neuroplast:sidebar-open";
const SidebarContext = createContext({ open: false, toggle: () => {} });
export function useSidebar() { return useContext(SidebarContext); }
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const saved = localStorage.getItem(STORAGE_KEY); setOpen(window.innerWidth > 760 && saved !== "0"); }, []);
  const toggle = useCallback(() => setOpen(previous => { localStorage.setItem(STORAGE_KEY, previous ? "0" : "1"); return !previous; }), []);
  useEffect(() => { const event = kbdEventForAction("toggle-sidebar"); window.addEventListener(event, toggle); return () => window.removeEventListener(event, toggle); }, [toggle]);
  return <SidebarContext.Provider value={{ open, toggle }}><div className="flex h-dvh w-full">{children}</div></SidebarContext.Provider>;
}
export function SidebarToggle() {
  const { open, toggle } = useSidebar();
  if (open) return null;
  return <Button size="icon" variant="ghost" aria-label="Open navigation" onClick={toggle}><PanelLeftOpenIcon size={18}/></Button>;
}
