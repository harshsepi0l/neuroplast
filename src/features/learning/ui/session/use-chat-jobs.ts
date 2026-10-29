"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JobRecord } from "@/features/artifacts/core/jobs";
import { useServerEvent, useServerResync } from "./server-events";

/** The chat's job feed: fetches /api/jobs on mount, on jobs-changed and on
 *  resync, and syncs the transcript when a job settles (deferring while a
 *  turn is streaming). Extracted from Chat; behavior unchanged. */
export function useChatJobs({ chatId, localStream, syncFromServer, adoptAppendOnly }: {
	chatId: string;
	localStream: boolean;
	syncFromServer: () => Promise<void>;
	adoptAppendOnly: () => Promise<void>;
}): JobRecord[] {
	// ── Central job observability (contracts.ts "THE ASYNC PROTOCOL" §4) ──
	// ONE fetch of /api/jobs drives every job surface (transcript dispatch
	// cards, the sub-agents panel) and re-syncs the transcript exactly once
	// when a job settles. PUSH (architecture S4, 2026-10-02): the store
	// announces every job write on the events channel; the interval poll and
	// its pollMs/jobPartCount gating are RETIRED. The view fetches once on
	// mount, once per jobs-changed announcement (trailing-debounced — a
	// sub-agent run writes activity-line bursts; 250ms coalesces them at or
	// below the old 1s poll cadence), and once on channel resync.
	//
	// A settle no longer implies the record is complete: CONTINUATION
	// COALESCING flips the job done at claim time — while the learner's own
	// answer turn is still streaming (and a settle can race a second job's
	// wake turn). Syncing mid-turn would swap in a stale snapshot
	// mid-stream, which breaks the SDK's in-place continuation merge
	// (duplicate message ids). So: a settle during a busy turn defers the
	// sync; the next idle fetch adopts the finished record.
	const [jobs, setJobs] = useState<JobRecord[]>([]);
	const localStreamRef = useRef(false);
	localStreamRef.current = localStream;
	const jobStatusRef = useRef<Map<string, string>>(new Map());
	// A settle seen during a busy turn — the sync is owed, not dropped.
	const pendingSyncRef = useRef(false);
	// (The dispatch nudge effect that lived here — refreshActivity per new
	// dispatch tool part — died at S5: the store announces jobs-changed at
	// the dispatch write; the dock subscribes.)
	// First-fetch guard (the old first-tick guard): the initial read adopts
	// existing history (jobs recorded before mount) without nudging — a
	// nudge is only owed for a running job the feed hasn't seen THIS session.
	const firstFetchRef = useRef(true);
	// The trailing debounce for jobs-changed announcements (one timer), and
	// the ref the timer fires through (a stale closure must never fetch an
	// old chatId).
	const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const fetchJobsRef = useRef<() => void>(() => {});
	const fetchJobs = useCallback(async () => {
		try {
			const res = await fetch(`/api/jobs?chatId=${encodeURIComponent(chatId)}`);
			if (!res.ok) return;
			const data = (await res.json()) as { jobs?: JobRecord[]; turnInFlight?: boolean };
			const list = data.jobs ?? [];
			for (const j of list) {
				const prev = jobStatusRef.current.get(j.id);
				if (prev === "running" && j.status !== "running") {
					// A settle — the blob leaves the dock via the store's jobs-changed
					// announce at this very write (S5); this handler owns the RECORD.
					// The record is only guaranteed complete when no turn is in
					// flight — locally or server-side (a coalesced settle fires
					// mid-turn by design), so the FULL sync waits for idle.
					// Ground rule (2026-09-15): delivered content shows
					// immediately anyway — adopt append-only NOW; the idle
					// sync still settles the record properly.
					if (localStreamRef.current || data.turnInFlight === true) {
						pendingSyncRef.current = true;
						void adoptAppendOnly();
					} else {
						void syncFromServer();
					}
				}
				jobStatusRef.current.set(j.id, j.status);
			}
			firstFetchRef.current = false;
			if (
				pendingSyncRef.current &&
				!localStreamRef.current &&
				data.turnInFlight !== true
			) {
				pendingSyncRef.current = false;
				void syncFromServer();
			}
			setJobs(list);
			// (Wake-turn adoption that lived here — the turnInFlight attach
			// line — died at S3: turn-started on the events channel owns
			// discovery now. turnInFlight is STILL READ above: the settle
			// logic's idle check needs it.)
		} catch {
			/* transient fetch failure — the next jobs-changed announcement re-fetches */
		}
	}, [chatId, syncFromServer, adoptAppendOnly]);
	fetchJobsRef.current = () => void fetchJobs();
	// Mount + chat switch: the IMMEDIATE (non-debounced) initial read. The
	// firstFetch guard resets with the old rule — true only when this
	// session has never seen a job (a chat switch keeps the map: job ids
	// are unique per chat, and a newly-seen running job may still nudge).
	useEffect(() => {
		firstFetchRef.current = jobStatusRef.current.size === 0;
		void fetchJobs();
	}, [fetchJobs]); // identity changes exactly on chatId
	useServerEvent("jobs-changed", (p) => {
		if (p.chatId != null && p.chatId !== chatId) return; // ours or unattributed
		if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
		fetchDebounceRef.current = setTimeout(() => {
			fetchDebounceRef.current = undefined;
			fetchJobsRef.current();
		}, 250);
	});
	// Reconnect catch-up: events missed while the channel was down.
	useServerResync(() => fetchJobsRef.current());
	useEffect(
		() => () => {
			if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
		},
		[],
	);
	return jobs;
}
