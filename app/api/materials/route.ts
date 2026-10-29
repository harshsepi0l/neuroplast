import { saveMaterial } from "@/features/learning/server/materials";
import { errorResponse, requireSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upload a study file (PDF, text, Markdown) for the tutor to read. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError("missing_file", "Choose a file to attach.", 400);
    return Response.json(await saveMaterial(file), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
