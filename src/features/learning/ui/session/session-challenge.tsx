"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/ui/easyui/Button";

/** The session's challenge, when one was made (from the chat page). */
export interface SessionChallengeInfo {
	id: string;
	score?: number;
}

/**
 * Learn → challenge: once the session is teaching, a quiet line above the
 * composer offers a scored challenge on what the session covered. One
 * challenge per session; once it exists the line opens it instead.
 */
export function SessionChallenge({ chatId, challenge }: { chatId: string; challenge?: SessionChallengeInfo }) {
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
	return (
		<div data-testid="session-challenge" className="mb-3 flex flex-wrap items-center justify-between gap-3 border-y border-border/50 py-3 print:hidden">
			<div className="min-w-0">
				<div className="font-semibold">
					{challenge ? (challenge.score === undefined ? "Your challenge is in progress" : `Your challenge: ${challenge.score}/100`) : "Ready to test it?"}
				</div>
				<div className="text-sm text-muted-foreground">
					{busy
						? "Building ten questions from this session. This takes about a minute."
						: error || (challenge ? "Train what you missed, then retake it." : "Ten scored questions on what this session covered.")}
				</div>
			</div>
			<Button size="sm" variant={challenge ? "secondary" : "primary"} isLoading={busy} rightIcon={<ArrowRight size={15} />} onClick={() => void take()}>
				{challenge ? "Open challenge" : "Take the challenge"}
			</Button>
		</div>
	);
}
