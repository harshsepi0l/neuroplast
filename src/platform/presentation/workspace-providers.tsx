"use client";
import { SidebarProvider } from "./sidebar";
import { WorkspaceShell } from "./workspace-shell";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { ServerEventsProvider } from "@/domains/learning/presentation/tutoring/server-events";
import { ActivityProvider } from "@/domains/learning/presentation/tutoring/activity-dock";
import { AppearanceProvider } from "@/domains/preferences/presentation/appearance";
import { SettingsDialogProvider } from "@/domains/preferences/presentation/settings-dialog";
import { ConnectionProvider } from "@/domains/connections/presentation/connection-context";
import { SessionProvider } from "@/domains/learning/presentation/session-context";
import { DraftProvider } from "@/domains/learning/presentation/draft-context";
export function WorkspaceProviders({ children }: { children: React.ReactNode }) {
  return <ServerEventsProvider><AppearanceProvider><SidebarProvider><ActivityProvider><SettingsDialogProvider><ConnectionProvider><SessionProvider><DraftProvider><WorkspaceShell>{children}</WorkspaceShell><KeyboardShortcuts/></DraftProvider></SessionProvider></ConnectionProvider></SettingsDialogProvider></ActivityProvider></SidebarProvider></AppearanceProvider></ServerEventsProvider>;
}
