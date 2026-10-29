"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** The session's challenge, when one was made (from the chat page). */
export interface SessionChallengeInfo {
	id: string;
	score?: number;
}

/** Open this session's challenge, building it first when there is none. */
export function useSessionChallenge(chatId: string, challenge?: SessionChallengeInfo) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	async function take() {
		if (challenge) {
			router.push(`/challenge/${challenge.id}`);
			return;
		}
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/challenges", {
				method: "POST",
				headers: { "Content-Type": "application/json", "x-neuroplast-client": "web" },
				body: JSON.stringify({ topicId: "custom", sessionId: chatId }),
			});
			const body = (await response.json()) as { id?: string; error?: string };
			if (!response.ok || !body.id) throw new Error(body.error || "The challenge could not be built.");
			router.push(`/challenge/${body.id}`);
		} catch (failure) {
			setError((failure as Error).message);
			setBusy(false);
		}
	}
	return { take, busy, error };
}
