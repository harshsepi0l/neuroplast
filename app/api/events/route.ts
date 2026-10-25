import { withRequestOwner } from "@/platform/server/request-context";
/**
 * THE NOTIFICATION CHANNEL ROUTE (push-architecture slice 1, 2026-10-02):
 * one SSE connection per open window over the core event bus — the
 * endpoint every future consumer (chat view, sidebar, activity dock)
 * subscribes to as the polls retire. The response plumbing lives in the
 * server seam (events-stream.ts); the framework route stays a thin
 * wrapper (the import law; tests drive the seam directly).
 */
import { eventsResponse } from "@/domains/learning/application/events-stream";

export const dynamic = "force-dynamic";

function handleGET(): Response {
	return eventsResponse();
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestOwner(() => handleGET(...args)); }
