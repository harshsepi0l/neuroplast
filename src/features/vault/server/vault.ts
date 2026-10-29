import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PATHS } from "@/server/workspace-config";
import { stores } from "@/server/workspace-stores";
import { AppError } from "@/lib/errors";
import { subscribe } from "@/features/learning/core/events";
import { challengeTopic, learnTopic, type SkillTreeTopic } from "@/features/knowledge/core/skill-trees";
import { challengeView, knowledgeTrees, listChallenges, readChallenge, score } from "@/features/challenges/server/challenge-store";
import { renderNote, ROOT, userText, vaultNotes, withGraphColors, type VaultChallenge, type VaultSession } from "@/features/vault/core/notes";

/**
 * The Obsidian vault connection: Neuroplast's records written as Markdown
 * notes under <vault>/Neuroplast, kept in sync as sessions, plans and
 * challenges change. The app's own records stay the source of truth; the
 * notes are a mirror the learner can annotate (their text below each
 * note's generated block is never touched).
 *
 * Connecting mints a local token for tools on this machine (the CLI and
 * other harnesses); only its hash is stored.
 */

interface VaultConfig {
	path: string;
	connectedAt: string;
	tokenHash: string;
	lastSyncAt?: string;
	lastError?: string;
	notes?: number;
}

export interface VaultStatus {
	connected: boolean;
	path?: string;
	/** The folder has an .obsidian directory (it is an Obsidian vault). */
	obsidian?: boolean;
	connectedAt?: string;
	lastSyncAt?: string;
	lastError?: string;
	notes?: number;
}

const configFile = () => path.join(PATHS.data, "vault.json");
/** Inside the vault: which note each record was written to (renames and removals). */
const MANIFEST = ".neuroplast-vault.json";

function readConfig(): VaultConfig | null {
	try {
		return JSON.parse(fs.readFileSync(configFile(), "utf8")) as VaultConfig;
	} catch {
		return null;
	}
}

function writeAtomic(file: string, text: string, mode?: number): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const temporary = `${file}.${randomUUID()}.tmp`;
	fs.writeFileSync(temporary, text, mode ? { mode } : undefined);
	fs.renameSync(temporary, file);
}

function writeConfig(config: VaultConfig): void {
	writeAtomic(configFile(), JSON.stringify(config, null, "\t"), 0o600);
}

export function vaultStatus(): VaultStatus {
	const config = readConfig();
	if (!config) return { connected: false };
	return {
		connected: true,
		path: config.path,
		obsidian: fs.existsSync(path.join(config.path, ".obsidian")),
		connectedAt: config.connectedAt,
		lastSyncAt: config.lastSyncAt,
		lastError: config.lastError,
		notes: config.notes,
	};
}

/** Whether a token is this vault's local token. */
export function vaultTokenValid(token: string): boolean {
	const config = readConfig();
	return !!config && createHash("sha256").update(token).digest("hex") === config.tokenHash;
}

/**
 * Connect a vault: an existing folder (absolute path). Writes the notes
 * at once and returns the local token, shown to the learner only now.
 */
export function connectVault(dir: string): { status: VaultStatus; token: string } {
	const expanded = dir.trim().replace(/^~(?=$|\/)/, process.env.HOME ?? "~");
	if (!path.isAbsolute(expanded)) throw new AppError("invalid_vault", "Use the vault's full path, e.g. /Users/you/Documents/Notes.", 400);
	const resolved = path.resolve(expanded);
	let stat: fs.Stats;
	try {
		stat = fs.statSync(resolved);
	} catch {
		throw new AppError("invalid_vault", "That folder does not exist.", 400);
	}
	if (!stat.isDirectory()) throw new AppError("invalid_vault", "That path is a file, not a folder.", 400);
	const data = path.resolve(PATHS.data);
	if (resolved === data || resolved.startsWith(data + path.sep)) {
		throw new AppError("invalid_vault", "Pick a folder outside Neuroplast's own data.", 400);
	}
	const token = randomBytes(32).toString("base64url");
	writeConfig({ path: resolved, connectedAt: new Date().toISOString(), tokenHash: createHash("sha256").update(token).digest("hex") });
	syncVault();
	return { status: vaultStatus(), token };
}

/** Stop syncing. The notes already written stay in the vault. */
export function disconnectVault(): void {
	fs.rmSync(configFile(), { force: true });
}

/** Everything the notes are built from, read from the workspace stores. */
export function vaultInput(): { sessions: VaultSession[]; topics: SkillTreeTopic[]; challenges: VaultChallenge[] } {
	const sessions: VaultSession[] = [];
	const topics: SkillTreeTopic[] = [];
	for (const summary of stores.chatStore.listChats()) {
		const record = stores.chatStore.getChat(summary.id);
		if (!record) continue;
		const kind = record.kind === "practice" ? "practice" : "teach";
		sessions.push({ id: record.id, title: record.title, kind, createdAt: record.createdAt, updatedAt: record.updatedAt, messages: record.messages });
		if (kind === "teach" && record.tree && record.tree.nodes.length > 0) {
			topics.push(learnTopic({ id: record.id, title: record.title, updatedAt: record.updatedAt, tree: record.tree, messages: record.messages }));
		}
	}
	const challenges: VaultChallenge[] = [];
	const tested = new Set<string>();
	for (const summary of listChallenges()) {
		try {
			const record = readChallenge(summary.id);
			const view = challengeView(record);
			tested.add(record.topicId);
			challenges.push({
				id: record.id,
				title: view.topic.title,
				createdAt: record.createdAt,
				submittedAt: record.submittedAt,
				sessionId: record.sessionId,
				previousId: record.previousId,
				skills: view.skills.map((s) => ({ id: s.id, name: s.name })),
				questions: record.questions.map((q) => ({ id: q.id, skillId: q.skillId, prompt: q.prompt })),
				responses: record.responses,
				result: score(record),
			});
		} catch {
			/* an unreadable record is skipped, never fatal */
		}
	}
	// Challenge topics only once something was tested on them; a session's
	// challenge already shows in its Learn topic.
	for (const tree of knowledgeTrees()) {
		if (!tested.has(tree.topic.id)) continue;
		if (challenges.some((c) => c.title === tree.topic.title && c.sessionId)) continue;
		topics.push(challengeTopic(tree, false));
	}
	return { sessions, topics, challenges };
}

/** Write every note whose text changed; move renamed ones; remove notes
 *  whose record is gone unless the learner wrote in them. */
export function syncVault(): VaultStatus {
	const config = readConfig();
	if (!config) return { connected: false };
	try {
		const root = path.join(config.path, ROOT);
		fs.mkdirSync(root, { recursive: true });
		let manifest: Record<string, string> = {};
		try {
			manifest = JSON.parse(fs.readFileSync(path.join(root, MANIFEST), "utf8")) as Record<string, string>;
		} catch {
			/* first sync */
		}
		const notes = vaultNotes(vaultInput());
		const next: Record<string, string> = {};
		for (const note of notes) {
			const target = path.join(config.path, note.path);
			if (!target.startsWith(root + path.sep)) continue;
			const previous = manifest[note.key] ? path.join(config.path, manifest[note.key]!) : undefined;
			let existing: string | undefined;
			if (fs.existsSync(target)) existing = fs.readFileSync(target, "utf8");
			else if (previous && previous !== target && previous.startsWith(root + path.sep) && fs.existsSync(previous)) {
				existing = fs.readFileSync(previous, "utf8");
				fs.rmSync(previous);
			}
			const text = renderNote(note, existing);
			if (text !== existing) writeAtomic(target, text);
			next[note.key] = note.path;
		}
		for (const [key, rel] of Object.entries(manifest)) {
			if (next[key]) continue;
			const file = path.join(config.path, rel);
			if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) continue;
			if (userText(fs.readFileSync(file, "utf8")).trim()) next[key] = rel; // keep: the learner wrote in it
			else fs.rmSync(file);
		}
		pruneEmpty(root, root);
		writeAtomic(path.join(root, MANIFEST), JSON.stringify(next, null, "\t"));
		writeConfig({ ...config, lastSyncAt: new Date().toISOString(), lastError: undefined, notes: notes.length });
	} catch (error) {
		writeConfig({ ...config, lastError: (error as Error).message });
	}
	return vaultStatus();
}

/**
 * Color Obsidian's graph by note kind and step status: Neuroplast's color
 * groups go first in <vault>/.obsidian/graph.json; the learner's own groups
 * and settings stay. Obsidian reads it when the graph view next opens.
 */
export function applyGraphColors(): void {
	const config = readConfig();
	if (!config) throw new AppError("vault_not_connected", "Connect a vault first.", 400);
	const dir = path.join(config.path, ".obsidian");
	if (!fs.existsSync(dir)) throw new AppError("not_obsidian", "This folder has no .obsidian settings yet: open it as a vault in Obsidian first.", 400);
	const file = path.join(dir, "graph.json");
	let graph: Record<string, unknown> = {};
	try {
		graph = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch {
		/* no graph settings yet */
	}
	writeAtomic(file, JSON.stringify(withGraphColors(graph), null, 2));
}

/** Remove folders left empty by moved or removed notes (never the root). */
function pruneEmpty(dir: string, root: string): void {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) pruneEmpty(path.join(dir, entry.name), root);
	}
	if (dir !== root && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

// ─── keeping it in sync ──────────────────────────────────────────────────────

const SYNC_DELAY_MS = 1500;
const key = Symbol.for("neuroplast.vault.watch");
type Watch = { timer?: ReturnType<typeof setTimeout>; stop?: () => void };

/** Sync shortly after the last change (changes come in bursts). */
export function scheduleVaultSync(): void {
	const watch = ((globalThis as Record<symbol, Watch>)[key] ??= {});
	if (watch.timer) clearTimeout(watch.timer);
	watch.timer = setTimeout(() => {
		watch.timer = undefined;
		if (readConfig()) syncVault();
	}, SYNC_DELAY_MS);
	watch.timer.unref?.();
}

/** Start listening for record changes (once per process). */
export function ensureVaultWatch(): void {
	const watch = ((globalThis as Record<symbol, Watch>)[key] ??= {});
	if (watch.stop) return;
	watch.stop = subscribe((event) => {
		if (event.type === "turn-settled" || event.type === "record-changed" || event.type === "chats-changed" || event.type === "challenges-changed") {
			scheduleVaultSync();
		}
	});
}
