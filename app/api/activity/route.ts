import { withRequestOwner } from "@/platform/server/request-context";
/**
 * GET /api/activity — the dock's one poll: every running background
 * process, every view (chat, home, everywhere). Composition only — the
 * feed lives in server/observability.ts; costs are projected server-side
 * through Pi's catalog and public calculator. See that module's header for why /api/jobs stays
 * chat-scoped and untouched.
 */
import { activityFeed } from "@/domains/learning/application/observability";

export const dynamic = "force-dynamic";

async function handleGET() {
	return Response.json(activityFeed());
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestOwner(() => handleGET(...args)); }
