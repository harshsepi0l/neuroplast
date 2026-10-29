import { ensureVaultWatch, syncVault } from "@/features/vault/server/vault";
import { errorResponse, requireSameOrigin } from "@/server/http";

/** Write the vault's notes now. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    ensureVaultWatch();
    return Response.json(syncVault(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
