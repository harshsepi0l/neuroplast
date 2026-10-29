import { z } from "zod";
import { connectVault, disconnectVault, ensureVaultWatch, vaultStatus } from "@/features/vault/server/vault";
import { errorResponse, jsonBody, requireSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";

/** The Obsidian vault connection: status, connect (returns the local
 *  token once), disconnect (notes stay in the vault). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  ensureVaultWatch();
  return Response.json(vaultStatus(), noStore);
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = z.object({ path: z.string().min(1).max(1000) }).safeParse(await jsonBody(request));
    if (!parsed.success) throw new AppError("invalid_vault", "Enter the vault folder's path.", 400);
    ensureVaultWatch();
    return Response.json(connectVault(parsed.data.path), noStore);
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    disconnectVault();
    return Response.json(vaultStatus(), noStore);
  } catch (error) { return errorResponse(error); }
}
