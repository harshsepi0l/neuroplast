import { z } from "zod";
import { TOPIC } from "@/features/challenges/core/linear-equations";
import { challengeView, createChallenge, createCustomChallenge, listChallenges, readChallenge } from "@/features/challenges/server/challenge-store";
import { errorResponse, jsonBody, requireSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";
import { withRequestOwner } from "@/server/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try { return Response.json({ topic: TOPIC, challenges: listChallenges() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}

const createSchema = z.object({ topicId: z.string().min(1).max(80), previousId: z.string().optional(), request: z.string().trim().min(8).max(500).optional() });
export async function POST(request: Request) {
  return withRequestOwner(async () => { try {
    requireSameOrigin(request);
    const parsed = createSchema.safeParse(await jsonBody(request));
    if (!parsed.success) throw new AppError("invalid_challenge", "Choose an available topic.", 400);
    const { topicId, previousId } = parsed.data;
    let record;
    if (topicId === TOPIC.id) record = createChallenge(previousId);
    else if (topicId === "custom" && parsed.data.request && !previousId) record = await createCustomChallenge(parsed.data.request, undefined, request.signal);
    else if (previousId) {
      const previous = readChallenge(previousId);
      if (previous.topicId !== topicId || previous.kind !== "custom") throw new AppError("invalid_challenge", "Choose a matching custom topic for this retake.", 400);
      record = await createCustomChallenge(previous.request!, previousId, request.signal);
    } else throw new AppError("invalid_challenge", "Enter a topic or question for a new challenge.", 400);
    return Response.json(challengeView(record), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); } });
}
