import { notFound } from "next/navigation";
import { Chat } from "@/features/learning/ui/session/chat";
import { slotsConfigured } from "@/features/settings/core/settings";
import { compactionInFlight } from "@/features/learning/server/compaction";
import { getChat } from "@/features/learning/server/chats";
import { isTurnRunning } from "@/features/learning/server/turn-liveness";
import { readSettings as readSettingsRecord } from "@/features/settings/server/settings-store";
import { challengeForSession, score } from "@/features/challenges/server/challenge-store";

/** Sessions: the whole record of one session, every stage and its
 *  challenge. Learn (/chat/<id>) is where the lesson happens. */
export const dynamic = "force-dynamic";

export default async function SessionRecordPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const chat = getChat(id);
	if (!chat) notFound();
	// The persistent setup CTA's seed (BYOK, owner 2026-09-22): slotsConfigured
	// over the settings record, server-read — the same gate home/new read. The
	// server's 503 stays the truth; this only decides whether the pill rides.
	const record = readSettingsRecord();
	const challenge = challengeForSession(chat.id);
	return (
		<Chat
			key={chat.id}
			chatId={chat.id}
			title={chat.title}
			kind={chat.kind ?? "teach"}
			// Wave D: the record IS native agent history — the client view is
				// derived app-side (core/view.ts projectView; GET serves the same
				// native messages).
				initialMessages={chat.messages}
			initialConfigured={slotsConfigured(record?.models)}
			// A teacher turn that outlived its client: the remounted view must
			// attach (busy shimmer + poll), never resurrect the stale record.
			initiallyInFlight={isTurnRunning(chat.id)}
			initiallyCompacting={compactionInFlight(chat.id)}
			challenge={challenge ? { id: challenge.id, score: score(challenge)?.points } : undefined}
			space="record"
		/>
	);
}
