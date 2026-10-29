"use client";
import { useEffect, useRef, useState } from "react";
import { SettingsRow } from "@/features/settings/ui/controls";

interface VaultStatus {
	connected: boolean;
	path?: string;
	obsidian?: boolean;
	lastSyncAt?: string;
	lastError?: string;
	notes?: number;
	colors: Record<string, string>;
	graphColors?: boolean;
}

const COLOR_LABELS: [string, string][] = [
	["learning", "Learning now"],
	["needs-practice", "Needs practice"],
	["solid", "Solid"],
	["ahead", "Ahead"],
	["topic", "Topics"],
	["session", "Sessions"],
	["challenge", "Challenges"],
	["home", "Home"],
];

const BUTTON = "rounded-sm border border-border bg-card px-3 py-1.5 font-ui text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50";
const headers = { "Content-Type": "application/json", "x-neuroplast-client": "web" };

/**
 * Settings › Obsidian: connect a vault folder. Neuroplast writes its topics,
 * steps, sessions and challenges there as notes and keeps them in sync.
 * Connecting shows the local token once, for tools on this machine.
 */
export function VaultSection() {
	const [status, setStatus] = useState<VaultStatus | null>(null);
	const [dir, setDir] = useState("");
	const [token, setToken] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [colored, setColored] = useState(false);
	const [colors, setColors] = useState<Record<string, string>>({});
	const [saved, setSaved] = useState("");
	const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	useEffect(() => {
		if (status) setColors(status.colors);
	}, [status]);
	// Dragging a color fires many changes: save once it settles.
	function pick(group: string, hex: string) {
		const next = { ...colors, [group]: hex };
		setColors(next);
		setSaved("");
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => void saveColors(next), 500);
	}
	async function saveColors(next: Record<string, string> | null) {
		const data = await call("PUT", "/api/vault/colors", { colors: next });
		if (data) {
			setStatus(data);
			setSaved(data.graphColors ? "Saved. Reopen Obsidian's graph view to see them." : "Saved. Use Color the graph to apply them to Obsidian's graph.");
		}
	}

	useEffect(() => {
		void fetch("/api/vault").then((r) => r.json()).then(setStatus).catch(() => setError("The vault status could not be loaded."));
	}, []);

	async function call(method: string, url: string, body?: unknown) {
		setBusy(true);
		setError("");
		try {
			const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
			const data = await response.json();
			if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "That did not work.");
			return data;
		} catch (failure) {
			setError((failure as Error).message);
			return null;
		} finally {
			setBusy(false);
		}
	}

	async function connect() {
		const data = await call("POST", "/api/vault", { path: dir });
		if (data) {
			setStatus(data.status);
			setToken(data.token);
		}
	}

	if (!status) return <p className="px-6 py-4 text-xs text-muted-foreground">{error || "Loading…"}</p>;

	return (
		<div data-testid="vault-section">
			{!status.connected ? (
				<SettingsRow label="Vault folder" hint="The folder of an Obsidian vault on this computer. Neuroplast writes into a Neuroplast folder inside it.">
					<div className="flex w-full max-w-md gap-2">
						<input
							aria-label="Vault folder"
							value={dir}
							onChange={(e) => setDir(e.target.value)}
							placeholder="/Users/you/Documents/Notes"
							className="min-w-0 flex-1 rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-xs"
						/>
						<button type="button" className={BUTTON} disabled={busy || !dir.trim()} onClick={() => void connect()}>
							Connect
						</button>
					</div>
				</SettingsRow>
			) : (
				<>
					<SettingsRow label="Vault" hint={status.obsidian ? "Obsidian vault" : "No .obsidian folder here: open this folder as a vault in Obsidian."}>
						<span className="break-all font-mono text-xs">{status.path}</span>
					</SettingsRow>
					<SettingsRow label="Notes" hint={status.lastError ? `Last sync failed: ${status.lastError}` : status.lastSyncAt ? `Synced ${new Date(status.lastSyncAt).toLocaleString()}` : "Not synced yet"}>
						<div className="flex items-center gap-2">
							<span className="text-xs">{status.notes ?? 0}</span>
							<button type="button" className={BUTTON} disabled={busy} onClick={() => void call("POST", "/api/vault/sync").then((s) => s && setStatus(s))}>
								Sync now
							</button>
							<button type="button" className={BUTTON} disabled={busy} onClick={() => void call("DELETE", "/api/vault").then((s) => { if (s) { setStatus(s); setToken(""); } })}>
								Disconnect
							</button>
						</div>
					</SettingsRow>
					<SettingsRow label="Graph colors" hint={colored ? "Added. Reopen Obsidian's graph view to see them." : status.graphColors ? "On. Color changes below apply to the graph too." : "Color Obsidian's graph by topic, session, challenge and step status. Your own color groups stay."}>
						<button type="button" className={BUTTON} disabled={busy || !status.obsidian} onClick={() => void call("POST", "/api/vault/graph").then((s) => { if (s) { setStatus(s); setColored(true); } })}>
							Color the graph
						</button>
					</SettingsRow>
					<SettingsRow label="Colors" hint={saved || "Used by the graph and by each topic's diagram."}>
						<div className="flex flex-col items-end gap-2">
							<div data-testid="vault-colors" className="grid grid-cols-2 gap-x-5 gap-y-1.5">
								{COLOR_LABELS.map(([group, label]) => (
									<label key={group} className="flex items-center gap-2 text-xs">
										<input
											type="color"
											aria-label={`${label} color`}
											value={colors[group] ?? "#000000"}
											onChange={(e) => pick(group, e.target.value)}
											className="size-6 cursor-pointer rounded-sm border border-border bg-transparent p-0"
										/>
										<span className="w-24">{label}</span>
										<span className="font-mono text-muted-foreground">{colors[group]}</span>
									</label>
								))}
							</div>
							<button type="button" className={BUTTON} disabled={busy} onClick={() => void saveColors(null)}>
								Reset colors
							</button>
						</div>
					</SettingsRow>
				</>
			)}
			{token && (
				<SettingsRow label="Local token" hint="For the Neuroplast CLI and other tools on this computer. It is shown only now; connect again for a new one.">
					<code data-testid="vault-token" className="break-all rounded-sm bg-muted px-2 py-1 font-mono text-xs">{token}</code>
				</SettingsRow>
			)}
			{error && <p role="alert" className="px-6 pb-3 text-xs text-[var(--danger)]">{error}</p>}
		</div>
	);
}
