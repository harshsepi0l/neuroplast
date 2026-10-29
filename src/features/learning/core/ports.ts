/** Persistence contracts owned by the learning domain. */
import type { NeuroplastMessage } from "@/features/learning/core/native-messages";
import type { ChatRecord, ChatSettings, ChatSummary, ExtractionRunUsage, TurnUsage } from "@/features/learning/core/chat";
import type { PlanTree } from "@/features/learning/core/plan";

export interface ChatStore {
	/** Create a session record (persisted immediately). */
	/** Create a session record; kind "practice" marks a practice session
	 *  (absent = teach, the default). */
	createChat(title: string, kind?: "practice"): ChatRecord;
	/** The full record, or null if unknown id / corrupt file. */
	getChat(id: string): ChatRecord | null;
	/** All sessions, newest activity first (the sidebar's list view). */
	listChats(): ChatSummary[];
	/** Persist the full native message list (the record IS the agent
	 * state — Wave B, owner-approved 2026-09-26). */
	saveMessages(id: string, messages: NeuroplastMessage[]): void;
	/** Persist the session plan tree (plan tools call this in execute). */
	saveTree(id: string, tree: PlanTree): void;
	/** Append one usage entry to the record's turn log (the money channel,
	 * 2026-09): idempotent per turn id — each request carries its own, so
	 * a turn persisted twice appends once while continuation turns (which
	 * share a response message id) each keep their usage. */
	appendTurnUsage(id: string, entry: TurnUsage): void;
	/** Append one extraction-run usage entry — idempotent per startedAt. */
	appendExtractionUsage(id: string, entry: ExtractionRunUsage): void;
	/** Persist the per-chat model/thinking settings (the model control).
	 *  Replace-whole: the picker sends the complete settings object. */
	saveSettings(id: string, settings: ChatSettings): void;
	/** Rename a session (the header's click-to-edit title, 2026-09-17).
	 * Like saveSettings: a rename is NOT conversation activity — updatedAt
	 * stays put, so sidebar order never churns on a rename. */
	renameChat(id: string, title: string): ChatRecord;
	/** Delete the session record entirely (session-deletion wave 6, owner
	 *  2026-09-22). False when the id is unknown. The graph-ledger purge and
	 *  job cleanup are the caller's choreography (core/graph-deletion.ts +
	 *  the DELETE route), not the store's. */
	deleteChat(id: string): boolean;
}
