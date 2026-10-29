import { z } from "zod";
import { TOPIC } from "@/features/challenges/core/linear-equations";
import { challengeForSession, challengeView, createChallenge, createCustomChallenge, listChallenges, readChallenge } from "@/features/challenges/server/challenge-store";
import { sessionChallengeRequest } from "@/features/challenges/core/custom-quiz";
import { getChat } from "@/features/learning/server/chats";
import { errorResponse, jsonBody, requireSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";
import { withRequestOwner } from "@/server/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try { return Response.json({ topic: TOPIC, challenges: listChallenges() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}

const createSchema = z.object({ topicId: z.string().min(1).max(80), previousId: z.string().optional(), request: z.string().trim().min(8).max(500).optional(), sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(80).optional() });
export async function POST(request: Request) {
  return withRequestOwner(async () => { try {
    requireSameOrigin(request);
    const parsed = createSchema.safeParse(await jsonBody(request));
    if (!parsed.success) throw new AppError("invalid_challenge", "Choose an available topic.", 400);
    const { topicId, previousId } = parsed.data;
    let record;
    if (topicId === "custom" && parsed.data.sessionId && !previousId) {
      // A Learn session's challenge: one per session — asking again opens it.
      const existing = challengeForSession(parsed.data.sessionId);
      if (existing) return Response.json(challengeView(existing), { headers: { "Cache-Control": "no-store" } });
      const chat = getChat(parsed.data.sessionId);
      if (!chat) throw new AppError("session_not_found", "That session could not be found.", 404);
      const steps = (chat.tree?.nodes ?? []).map(node => node.title);
      record = await createCustomChallenge(sessionChallengeRequest(chat.title, steps), undefined, request.signal, chat.id);
    } else if (topicId === TOPIC.id) record = createChallenge(previousId);
    else if (topicId === "custom" && parsed.data.request && !previousId) record = await createCustomChallenge(parsed.data.request, undefined, request.signal);
    else if (previousId) {
      const previous = readChallenge(previousId);
      if (previous.topicId !== topicId || previous.kind !== "custom") throw new AppError("invalid_challenge", "Choose a matching custom topic for this retake.", 400);
      record = await createCustomChallenge(previous.request!, previousId, request.signal);
    } else throw new AppError("invalid_challenge", "Enter a topic or question for a new challenge.", 400);
    return Response.json(challengeView(record), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); } });
}
