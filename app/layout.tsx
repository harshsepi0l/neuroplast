import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProviders } from "@/platform/presentation/workspace-providers";
export const metadata: Metadata = { title: "neuroplast", description: "Take a challenge, train the skills you missed, and beat your score.", icons: { icon: "/neuroplast.svg" } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className="dark"><body><WorkspaceProviders>{children}</WorkspaceProviders></body></html>;
}
