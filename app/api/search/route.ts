import { withRequestOwner } from "@/server/request-context";
/**
 * GET /api/search — the search engines' status (search wave, 2026-09-20):
 * the honest availability signal the settings UI explains from (the
 * gray-out affordance) and any client surface can read.
 *
 * { available, engine, reason } — never a key, never a secret: `engine` is
 * the ACTIVE engine when live (auto-detection or the explicit pin), and
 * `reason` is the one-line state explanation ("set a Tavily or Brave
 * search API key", or the pinned-engine-key-missing case).
 */

import { searchStatus } from "@/features/learning/server/search";

export const dynamic = "force-dynamic";

async function handleGET() {
	return Response.json(searchStatus());
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestOwner(() => handleGET(...args)); }
