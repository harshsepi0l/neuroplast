import { z } from "zod";
import { challengeView, readChallenge, saveResponse, submitChallenge } from "@/features/challenges/server/challenge-store";
import { errorResponse, jsonBody, requireSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try { return Response.json(challengeView(readChallenge((await context.params).id)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}

const responseSchema = z.object({ questionId: z.string().min(1).max(20), response: z.string().max(80) });
export async function PATCH(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const parsed = responseSchema.safeParse(await jsonBody(request));
    if (!parsed.success) throw new AppError("invalid_answer", "Choose or enter a valid answer.", 400);
    return Response.json(challengeView(saveResponse((await context.params).id, parsed.data.questionId, parsed.data.response)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const parsed = z.object({ action: z.literal("submit") }).safeParse(await jsonBody(request));
    if (!parsed.success) throw new AppError("invalid_action", "Choose a valid challenge action.", 400);
    return Response.json(challengeView(submitChallenge((await context.params).id)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
