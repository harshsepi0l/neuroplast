"use client";
import { SidebarProvider } from "./sidebar";
import { WorkspaceShell } from "./workspace-shell";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { ServerEventsProvider } from "@/features/learning/ui/session/server-events";
import { ActivityProvider } from "@/features/learning/ui/docks/activity-dock";
import { AppearanceProvider } from "@/features/settings/ui/appearance";
import { SettingsDialogProvider } from "@/features/settings/ui/settings-dialog";
import { ConnectionProvider } from "@/features/connections/ui/connection-context";
import { SessionProvider } from "@/features/learning/ui/session-context";
import { DraftProvider } from "@/features/learning/ui/draft-context";
export function WorkspaceProviders({ children }: { children: React.ReactNode }) {
  return <ServerEventsProvider><AppearanceProvider><SidebarProvider><ActivityProvider><SettingsDialogProvider><ConnectionProvider><SessionProvider><DraftProvider><WorkspaceShell>{children}</WorkspaceShell><KeyboardShortcuts/></DraftProvider></SessionProvider></ConnectionProvider></SettingsDialogProvider></ActivityProvider></SidebarProvider></AppearanceProvider></ServerEventsProvider>;
}
