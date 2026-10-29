import { withRequestOwner } from "@/server/request-context";
import { graphView } from "@/features/knowledge/server/graph";

/**
 * The home graph view's data endpoint (W4; vision §1 "Home page") — thin
 * transport: the server entry (src/features/knowledge/server/graph.ts) returns nodes, edges,
 * session provenance, and per-session understanding observations.
 */

export const dynamic = "force-dynamic";

async function handleGET() {
	return Response.json(graphView());
}

export async function GET(...args: Parameters<typeof handleGET>) { return withRequestOwner(() => handleGET(...args)); }
