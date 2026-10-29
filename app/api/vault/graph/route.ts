import { applyGraphColors, vaultStatus } from "@/features/vault/server/vault";
import { errorResponse, requireSameOrigin } from "@/server/http";

/** Add Neuroplast's color groups to the vault's Obsidian graph settings. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    applyGraphColors();
    return Response.json(vaultStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
