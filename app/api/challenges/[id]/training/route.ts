import { z } from "zod";
import { answerTraining, readChallenge, startTraining, trainingView } from "@/features/challenges/server/challenge-store";
import { errorResponse, jsonBody, requireSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try { return Response.json(trainingView(readChallenge((await context.params).id)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("answer"), questionId: z.string().min(1).max(20), response: z.string().min(1).max(80) }),
]);
export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const parsed = command.safeParse(await jsonBody(request));
    if (!parsed.success) throw new AppError("invalid_action", "Choose a valid practice action.", 400);
    const id = (await context.params).id;
    return Response.json(parsed.data.action === "start" ? startTraining(id) : answerTraining(id, parsed.data.questionId, parsed.data.response), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
