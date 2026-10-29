import { z } from "zod";
import { setVaultColors } from "@/features/vault/server/vault";
import { errorResponse, jsonBody, requireSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";

/** Save the vault's colors (null resets them). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = z.object({ colors: z.record(z.string(), hex).nullable() }).safeParse(await jsonBody(request));
    if (!parsed.success) throw new AppError("invalid_colors", "Pick colors as #rrggbb.", 400);
    return Response.json(setVaultColors(parsed.data.colors), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
