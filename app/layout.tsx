import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProviders } from "@/app-shell/workspace-providers";

export const metadata: Metadata = {
	title: "neuroplast",
	description: "Take a challenge, train the skills you missed, and beat your score.",
	icons: { icon: "/neuroplast.svg" },
};

// No-flash theme script: apply the stored mode BEFORE the app paints, so
// light-mode users don't see a dark flash. <html> ships with the dark
// factory default; the AppearanceProvider re-syncs the class from the
// settings record after load — localStorage is only the fast cache here.
const themeInit = `(function(){try{var m=localStorage.getItem("neuroplast:mode");if(m==="light"){document.documentElement.classList.remove("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark" suppressHydrationWarning>
			<body>
				<script dangerouslySetInnerHTML={{ __html: themeInit }} />
				<WorkspaceProviders>{children}</WorkspaceProviders>
			</body>
		</html>
	);
}
